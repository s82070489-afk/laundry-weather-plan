import { APP_NAME } from '../config/appName';
import { HOLIDAY_CACHE_HOURS, HOLIDAY_PROXY_URL } from '../config/app';
import { parseHolidaysResponse, type HolidayYear } from './holidays';

/**
 * 공휴일은 Cloudflare Worker 프록시(../worker)의 /holidays?year= 로만 받는다 — 서비스키는
 * Worker 비밀값으로만 있고 앱 번들에는 들어가지 않는다.
 * Worker가 연도별로 24시간 공유 캐시를 하고, 여기서는 기기별로 HOLIDAY_CACHE_HOURS만큼 한 번 더 캐싱한다.
 * 실패하면 기기에 남은 이전 데이터를 stale로 보여준다.
 */
export const HOLIDAYS_PATH = '/holidays';

export interface HolidayYearResult {
  data: HolidayYear;
  /** true면 최신 데이터를 못 받아 이전 데이터를 보여주는 중 (Worker STALE 또는 기기 캐시) */
  stale: boolean;
}

interface CachedHolidayYear {
  data: HolidayYear;
  savedAt: number;
  /** Worker가 STALE로 준 데이터면 다음에 다시 확인한다 */
  stale: boolean;
}

export interface HolidayDeps {
  fetchFn?: typeof fetch;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  proxyUrl?: string;
  now?: Date;
}

export class HolidayApiError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

const cacheKey = (year: number) => `${APP_NAME}:holidays:${year}`;

function loadCached(storage: HolidayDeps['storage'], year: number): CachedHolidayYear | null {
  try {
    const raw = storage?.getItem(cacheKey(year));
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedHolidayYear;
    return { ...cached, data: parseHolidaysResponse(cached.data, year) };
  } catch {
    return null;
  }
}

function saveCached(storage: HolidayDeps['storage'], entry: CachedHolidayYear) {
  try {
    storage?.setItem(cacheKey(entry.data.year), JSON.stringify(entry));
  } catch {
    // 저장 공간 부족 등은 무시 — 다음 실행에서 다시 받으면 된다
  }
}

/** 같은 연도 동시 요청은 하나로 합친다 (StrictMode 이중 실행 등) */
const inFlight = new Map<number, Promise<HolidayYearResult>>();

export function getHolidays(year: number, deps: HolidayDeps = {}): Promise<HolidayYearResult> {
  const pending = inFlight.get(year);
  if (pending) return pending;
  const promise = fetchHolidays(year, deps).finally(() => inFlight.delete(year));
  inFlight.set(year, promise);
  return promise;
}

async function fetchHolidays(year: number, deps: HolidayDeps): Promise<HolidayYearResult> {
  const {
    fetchFn = fetch,
    storage = typeof localStorage === 'undefined' ? undefined : localStorage,
    proxyUrl = HOLIDAY_PROXY_URL,
    now = new Date(),
  } = deps;

  const cached = loadCached(storage, year);
  if (cached && !cached.stale && now.getTime() - cached.savedAt < HOLIDAY_CACHE_HOURS * 60 * 60 * 1000) {
    return { data: cached.data, stale: false };
  }

  try {
    if (!proxyUrl) throw new HolidayApiError('VITE_HOLIDAY_PROXY_URL이 설정되지 않았어요. .env를 확인해주세요.');
    const res = await fetchFn(`${proxyUrl}${HOLIDAYS_PATH}?year=${year}`);
    if (!res.ok) {
      // Worker는 원본 에러코드를 { code }로 전달한다 (20 활용신청 안 됨, 22 한도 초과, 30 미등록 키 등)
      const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
      throw new HolidayApiError(`공휴일 프록시 응답 오류 (status: ${res.status}) ${body?.error ?? ''}`.trim(), body?.code);
    }
    const parsed = parseHolidaysResponse(await res.json(), year);
    // 받아 둔 공휴일이 있는데 0건이 오면 일시적 이상으로 보고 이전 데이터를 쓴다 (Worker와 같은 규칙)
    if (parsed.holidays.length === 0 && cached && cached.data.holidays.length > 0) {
      return { data: cached.data, stale: true };
    }
    const stale = parsed.cache === 'STALE' || res.headers.get('X-Proxy-Cache') === 'STALE';
    const data: HolidayYear = { year: parsed.year, holidays: parsed.holidays, fetchedAt: parsed.fetchedAt };
    saveCached(storage, { data, savedAt: now.getTime(), stale });
    return { data, stale };
  } catch (error) {
    console.warn(`[holidays] ${year} 요청 실패`, error);
    if (cached) return { data: cached.data, stale: true };
    throw error;
  }
}
