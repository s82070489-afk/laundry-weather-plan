import { APP_NAME } from '../config/appName';
import { WEATHER_PROXY_URL } from '../config/app';
import { baseKey, getLatestBaseDateTime } from './baseTime';
import { KMA_ERROR_LABELS, KmaApiError, parseForecast } from './parse';
import type { ForecastData } from './types';

/**
 * 기상청 단기예보는 Cloudflare Worker 프록시(../worker)를 통해서만 부른다 — 서비스키는
 * Worker 비밀값으로만 존재하고 클라이언트 번들에는 들어가지 않는다.
 * Worker가 격자+발표시각 단위로 공유 캐시를 하고, 여기서는 기기별로 한 번 더 캐싱해서
 * 같은 격자는 다음 발표시각 전까지 네트워크 요청 자체를 하지 않는다.
 */
export const FORECAST_PATH = '/kma/vilage-fcst';

export interface ForecastResult {
  data: ForecastData;
  /** true면 최신 발표분을 못 받아 이전 데이터를 보여주는 중 → "최신 예보를 불러오지 못했어요" */
  stale: boolean;
}

interface CachedForecast extends ForecastData {
  savedAt: number;
}

export interface ForecastDeps {
  fetchFn?: typeof fetch;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  proxyUrl?: string;
  now?: Date;
}

const cacheKey = (nx: number, ny: number) => `${APP_NAME}:forecast:${nx},${ny}`;

function loadCached(storage: ForecastDeps['storage'], nx: number, ny: number): CachedForecast | null {
  try {
    const raw = storage?.getItem(cacheKey(nx, ny));
    return raw ? (JSON.parse(raw) as CachedForecast) : null;
  } catch {
    return null;
  }
}

function saveCached(storage: ForecastDeps['storage'], data: ForecastData) {
  try {
    storage?.setItem(cacheKey(data.nx, data.ny), JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    // 저장 공간 부족 등은 무시 — 다음 실행에서 다시 받으면 된다
  }
}

function logFetchError(error: unknown) {
  if (error instanceof KmaApiError) {
    const label = KMA_ERROR_LABELS[error.resultCode] ?? '기타';
    console.warn(`[forecast] KMA resultCode=${error.resultCode} ${label}`);
  } else {
    console.warn('[forecast] 요청 실패', error);
  }
}

/** 같은 격자에 대한 동시 요청은 하나로 합친다 (화면 여러 곳/StrictMode 이중 실행) */
const inFlight = new Map<string, Promise<ForecastResult>>();

export function getForecast(nx: number, ny: number, deps: ForecastDeps = {}): Promise<ForecastResult> {
  const key = `${nx},${ny}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const promise = fetchForecast(nx, ny, deps).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

async function fetchForecast(nx: number, ny: number, deps: ForecastDeps): Promise<ForecastResult> {
  const {
    fetchFn = fetch,
    storage = typeof localStorage === 'undefined' ? undefined : localStorage,
    proxyUrl = WEATHER_PROXY_URL,
    now = new Date(),
  } = deps;

  const latest = getLatestBaseDateTime(now);
  const cached = loadCached(storage, nx, ny);
  if (cached && baseKey(cached) >= baseKey(latest)) {
    return { data: cached, stale: false };
  }

  try {
    if (!proxyUrl) throw new Error('VITE_WEATHER_PROXY_URL이 설정되지 않았어요. .env를 확인해주세요.');
    const res = await fetchFn(`${proxyUrl}${FORECAST_PATH}?nx=${nx}&ny=${ny}`);
    if (!res.ok) {
      // Worker는 기상청 에러코드를 { code }로 전달한다 (22 한도 초과, 30 미등록 키 등)
      const code = await res
        .json()
        .then((body: { code?: string }) => body?.code)
        .catch(() => undefined);
      if (code) throw new KmaApiError(code, `날씨 프록시 응답 오류 (status: ${res.status})`);
      throw new Error(`날씨 프록시 응답 오류 (status: ${res.status})`);
    }
    const data = parseForecast(await res.json(), nx, ny);
    // Worker가 기상청 호출에 실패해 자기 캐시의 마지막 데이터를 돌려준 경우
    const proxyStale = res.headers.get('X-Proxy-Cache') === 'STALE';

    if (!cached || baseKey(data) >= baseKey(cached)) saveCached(storage, data);
    if (cached && baseKey(cached) > baseKey(data)) return { data: cached, stale: true };
    return { data, stale: proxyStale };
  } catch (error) {
    logFetchError(error);
    if (cached) return { data: cached, stale: true };
    throw error;
  }
}
