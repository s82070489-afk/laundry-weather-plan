import { describe, expect, it, vi } from 'vitest';
import { getLatestBaseDateTime } from './baseTime';
import { getForecast } from './forecastApi';
import { KmaApiError, parseForecast } from './parse';

const kst = (iso: string) => new Date(`${iso}+09:00`);

describe('getLatestBaseDateTime', () => {
  it.each([
    ['2026-09-26T00:00', '20260925', '2300'],
    ['2026-09-26T02:09', '20260925', '2300'],
    ['2026-09-26T02:10', '20260926', '0200'],
    ['2026-09-26T05:09', '20260926', '0200'],
    ['2026-09-26T05:10', '20260926', '0500'],
    ['2026-09-26T14:30', '20260926', '1400'],
    ['2026-09-26T23:09', '20260926', '2000'],
    ['2026-09-26T23:59', '20260926', '2300'],
    ['2026-01-01T01:00', '20251231', '2300'],
  ])('%s → %s %s', (iso, baseDate, baseTime) => {
    expect(getLatestBaseDateTime(kst(iso))).toEqual({ baseDate, baseTime });
  });
});

const item = (category: string, fcstTime: string, fcstValue: string, fcstDate = '20260926') => ({
  baseDate: '20260926',
  baseTime: '1100',
  category,
  fcstDate,
  fcstTime,
  fcstValue,
  nx: 60,
  ny: 127,
});

const okJson = (items: ReturnType<typeof item>[]) => ({
  response: { header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' }, body: { items: { item: items } } },
});

describe('parseForecast', () => {
  it('카테고리를 시각별로 묶고 숫자로 변환, PCP/SNO 문자열은 무시', () => {
    const data = parseForecast(
      okJson([
        item('TMP', '1200', '23'),
        item('REH', '1200', '60'),
        item('POP', '1200', '0'),
        item('WSD', '1200', '1.4'),
        item('SKY', '1200', '3'),
        item('PTY', '1200', '0'),
        item('PCP', '1200', '강수없음'),
        item('SNO', '1200', '적설없음'),
        item('TMP', '1300', '24'),
      ]),
      60,
      127,
    );
    expect(data.baseTime).toBe('1100');
    expect(data.hours).toEqual([
      { date: '20260926', hour: 12, tmp: 23, reh: 60, pop: 0, wsd: 1.4, sky: 3, pty: 0 },
      { date: '20260926', hour: 13, tmp: 24, reh: null, pop: null, wsd: null, sky: null, pty: null },
    ]);
  });

  it('resultCode ≠ 00 이면 KmaApiError', () => {
    expect(() => parseForecast({ response: { header: { resultCode: '22', resultMsg: 'LIMIT' } } }, 60, 127)).toThrow(
      KmaApiError,
    );
  });
});

describe('getForecast (기기 캐시)', () => {
  function memoryStorage() {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  }
  const response = (baseTime: string, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(okJson([{ ...item('TMP', '1200', '20'), baseTime }])), { headers });

  it('같은 발표시각 캐시가 있으면 다시 부르지 않는다', async () => {
    const storage = memoryStorage();
    const fetchFn = vi.fn(async () => response('1100'));
    const deps = { storage, fetchFn: fetchFn as unknown as typeof fetch, proxyUrl: 'https://p', now: kst('2026-09-26T11:30') };
    await getForecast(60, 127, deps);
    const second = await getForecast(60, 127, deps);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(second.stale).toBe(false);
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe('https://p/kma/vilage-fcst?nx=60&ny=127');
  });

  it('새 발표시각이 되면 다시 부른다', async () => {
    const storage = memoryStorage();
    const fetchFn = vi.fn().mockResolvedValueOnce(response('1100')).mockResolvedValueOnce(response('1400'));
    const base = { storage, fetchFn: fetchFn as unknown as typeof fetch, proxyUrl: 'https://p' };
    await getForecast(60, 127, { ...base, now: kst('2026-09-26T11:30') });
    const r = await getForecast(60, 127, { ...base, now: kst('2026-09-26T14:15') });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(r.data.baseTime).toBe('1400');
  });

  it('실패하면 캐시된 이전 데이터를 stale로 돌려준다', async () => {
    const storage = memoryStorage();
    const ok = vi.fn(async () => response('1100'));
    await getForecast(60, 127, { storage, fetchFn: ok as unknown as typeof fetch, proxyUrl: 'https://p', now: kst('2026-09-26T11:30') });
    const fail = vi.fn(async () => new Response(JSON.stringify({ response: { header: { resultCode: '22' } } })));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await getForecast(60, 127, { storage, fetchFn: fail as unknown as typeof fetch, proxyUrl: 'https://p', now: kst('2026-09-26T14:15') });
    expect(r.stale).toBe(true);
    expect(r.data.baseTime).toBe('1100');
  });

  it('프록시가 STALE로 응답하면 stale 표시', async () => {
    const fetchFn = vi.fn(async () => response('1100', { 'X-Proxy-Cache': 'STALE' }));
    const r = await getForecast(60, 127, { storage: memoryStorage(), fetchFn: fetchFn as unknown as typeof fetch, proxyUrl: 'https://p', now: kst('2026-09-26T14:15') });
    expect(r.stale).toBe(true);
  });

  it('캐시도 없고 실패하면 에러', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchFn = vi.fn(async () => new Response('', { status: 502 }));
    await expect(
      getForecast(60, 127, { storage: memoryStorage(), fetchFn: fetchFn as unknown as typeof fetch, proxyUrl: 'https://p', now: kst('2026-09-26T14:15') }),
    ).rejects.toThrow();
  });
});
