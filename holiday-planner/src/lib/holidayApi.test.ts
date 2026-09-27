import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHolidays, HolidayApiError } from './holidayApi';
import { parseHolidaysResponse } from './holidays';

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-09-27T01:00:00Z');

function memoryStorage() {
  const m = new Map<string, string>();
  return { map: m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

const OCT = [
  { date: '2026-10-03', name: '개천절' },
  { date: '2026-10-09', name: '한글날' },
];

const workerBody = (holidays: unknown, cache = 'MISS', year = 2026) =>
  JSON.stringify({ year, holidays, fetchedAt: '2026-09-27T00:00:00.000Z', cache });

describe('parseHolidaysResponse', () => {
  it('배열 응답', () => {
    expect(parseHolidaysResponse(JSON.parse(workerBody(OCT, 'HIT')), 2026)).toEqual({
      year: 2026,
      holidays: OCT,
      fetchedAt: '2026-09-27T00:00:00.000Z',
      cache: 'HIT',
    });
  });

  it('1건이 객체로 와도 배열 1개', () => {
    expect(parseHolidaysResponse({ year: 2026, holidays: { date: '2026-12-25', name: '기독탄신일' } }, 2026).holidays).toEqual([
      { date: '2026-12-25', name: '기독탄신일' },
    ]);
  });

  it('0건(빈 배열·빈 문자열·없음)이면 빈 배열', () => {
    for (const holidays of [[], '', null, undefined]) {
      expect(parseHolidaysResponse({ year: 2027, holidays }, 2027).holidays).toEqual([]);
    }
  });

  it('형식이 틀린 항목은 버리고 날짜순 정렬', () => {
    const parsed = parseHolidaysResponse(
      { holidays: [OCT[1], { date: '20261003', name: 'x' }, { date: '2026-02-30', name: 'y' }, { date: '2026-10-05' }, OCT[0]] },
      2026,
    );
    expect(parsed.holidays).toEqual(OCT);
  });

  it('응답이 객체가 아니거나 연도가 다르면 throw', () => {
    expect(() => parseHolidaysResponse('oops', 2026)).toThrow();
    expect(() => parseHolidaysResponse({ year: 2025, holidays: [] }, 2026)).toThrow();
  });
});

describe('getHolidays (기기 캐시)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const deps = (storage: ReturnType<typeof memoryStorage>, fetchFn: unknown, now = NOW) => ({
    storage,
    fetchFn: fetchFn as typeof fetch,
    proxyUrl: 'https://p',
    now,
  });

  it('/holidays?year= 로 부르고, 6시간 안에는 다시 부르지 않는다', async () => {
    const storage = memoryStorage();
    const fetchFn = vi.fn(async () => new Response(workerBody(OCT)));
    const first = await getHolidays(2026, deps(storage, fetchFn));
    expect(first).toEqual({ data: { year: 2026, holidays: OCT, fetchedAt: '2026-09-27T00:00:00.000Z' }, stale: false });
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe('https://p/holidays?year=2026');
    await getHolidays(2026, deps(storage, fetchFn, new Date(NOW.getTime() + 5 * HOUR)));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await getHolidays(2026, deps(storage, fetchFn, new Date(NOW.getTime() + 7 * HOUR)));
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('0건(내년 발표 전)도 기기에 저장해 6시간 동안 다시 부르지 않는다', async () => {
    const storage = memoryStorage();
    const fetchFn = vi.fn(async () => new Response(workerBody([], 'MISS', 2027)));
    expect((await getHolidays(2027, deps(storage, fetchFn))).data.holidays).toEqual([]);
    await getHolidays(2027, deps(storage, fetchFn, new Date(NOW.getTime() + HOUR)));
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('Worker가 STALE이면 stale 표시, 다음에는 캐시를 쓰지 않고 다시 확인한다', async () => {
    const storage = memoryStorage();
    const fetchFn = vi.fn(async () => new Response(workerBody(OCT, 'STALE'), { headers: { 'X-Proxy-Cache': 'STALE' } }));
    expect((await getHolidays(2026, deps(storage, fetchFn))).stale).toBe(true);
    await getHolidays(2026, deps(storage, fetchFn, new Date(NOW.getTime() + HOUR)));
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('실패하면 기기에 남은 이전 데이터를 stale로', async () => {
    const storage = memoryStorage();
    await getHolidays(2026, deps(storage, vi.fn(async () => new Response(workerBody(OCT)))));
    const later = new Date(NOW.getTime() + 30 * HOUR);
    const r = await getHolidays(2026, deps(storage, vi.fn(async () => new Response('', { status: 502 })), later));
    expect(r).toMatchObject({ stale: true, data: { holidays: OCT } });
  });

  it('받아 둔 공휴일이 있는데 0건이 오면 이전 데이터(stale), 저장본은 그대로', async () => {
    const storage = memoryStorage();
    await getHolidays(2026, deps(storage, vi.fn(async () => new Response(workerBody(OCT)))));
    const later = new Date(NOW.getTime() + 30 * HOUR);
    const r = await getHolidays(2026, deps(storage, vi.fn(async () => new Response(workerBody([]))), later));
    expect(r).toMatchObject({ stale: true, data: { holidays: OCT } });
    expect(JSON.parse(storage.map.get('holiday-planner:holidays:2026')!).data.holidays).toEqual(OCT);
  });

  it('캐시도 없고 실패하면 Worker 에러코드를 담아 throw', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ error: '공공데이터 API 호출에 실패했어요', code: '30' }), { status: 502 }));
    const error = await getHolidays(2026, deps(memoryStorage(), fetchFn)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HolidayApiError);
    expect((error as HolidayApiError).code).toBe('30');
  });

  it('프록시 주소가 없으면 throw', async () => {
    await expect(getHolidays(2026, { storage: memoryStorage(), fetchFn: vi.fn() as unknown as typeof fetch, proxyUrl: '', now: NOW })).rejects.toThrow(
      'VITE_HOLIDAY_PROXY_URL',
    );
  });
});
