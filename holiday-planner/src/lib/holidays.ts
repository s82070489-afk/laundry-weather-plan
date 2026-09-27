import { isValidDate } from './date';

export interface Holiday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
}

/** Worker(/holidays?year=) 응답을 앱에서 쓰는 형태 */
export interface HolidayYear {
  year: number;
  holidays: Holiday[];
  /** 한국천문연구원 API에서 받은 시각 (ISO) */
  fetchedAt: string;
}

export type ProxyCacheStatus = 'HIT' | 'MISS' | 'STALE';

/**
 * Worker 응답 { year, holidays: [{ date, name }], fetchedAt, cache } 검증·정규화.
 * Worker가 이미 배열로 정규화해 주지만, 원본 API처럼 1건이 객체로·0건이 빈 문자열로 와도 받아 준다.
 * 형식이 맞지 않는 항목은 버린다. 응답 자체가 객체가 아니면 throw.
 */
export function parseHolidaysResponse(json: unknown, year: number): HolidayYear & { cache?: ProxyCacheStatus } {
  if (!json || typeof json !== 'object') throw new Error('공휴일 응답 형식이 아니에요');
  const body = json as { year?: unknown; holidays?: unknown; fetchedAt?: unknown; cache?: unknown };
  if (body.year !== undefined && Number(body.year) !== year) throw new Error(`요청한 연도(${year})와 응답 연도가 달라요`);

  const raw = body.holidays;
  const list = raw === undefined || raw === null || raw === '' ? [] : Array.isArray(raw) ? raw : [raw];
  const holidays: Holiday[] = [];
  for (const entry of list) {
    const h = entry as { date?: unknown; name?: unknown } | null;
    const name = typeof h?.name === 'string' ? h.name.trim() : '';
    if (!isValidDate(h?.date) || !name) continue;
    holidays.push({ date: h.date, name });
  }
  holidays.sort((a, b) => a.date.localeCompare(b.date));

  const cache = body.cache === 'HIT' || body.cache === 'MISS' || body.cache === 'STALE' ? body.cache : undefined;
  return { year, holidays, fetchedAt: typeof body.fetchedAt === 'string' ? body.fetchedAt : '', cache };
}

/** API는 대체공휴일 이름을 "대체공휴일(개천절)"처럼 준다 — "대체공휴일"로 시작하면 대체공휴일(배지 표시) */
export function isSubstituteName(name: string): boolean {
  return name.startsWith('대체공휴일');
}

/** 화면 표기용 이름: API는 신정을 "1월1일"로 준다 */
export function displayHolidayName(name: string): string {
  return name.replace(/\s/g, '') === '1월1일' ? '신정' : name;
}
