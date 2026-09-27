import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { isAllowedOrigin } from '../src/lib/cors';
import { clearMemoryCache, handleRoute } from '../src/lib/proxy';
import type { Env } from '../src/lib/types';
import { parseXml } from '../src/lib/xml';
import { holidaysRoute, normalizeHolidays, parseJsonOrXml, toIsoDate } from '../src/routes/holidays';

/** KST 시각으로 Date 만들기 */
const kst = (iso: string) => new Date(`${iso}+09:00`);
const HOUR = 60 * 60 * 1000;

function fakeKv() {
  const store = new Map<string, string>();
  return {
    store,
    kv: {
      get: vi.fn(async (key: string) => (store.has(key) ? JSON.parse(store.get(key)!) : null)),
      put: vi.fn(async (key: string, value: string) => void store.set(key, value)),
    } as unknown as KVNamespace,
  };
}

function envWith(kv: KVNamespace): Env {
  return { PROXY_CACHE: kv, HOLIDAY_SERVICE_KEY: 'test-key', ALLOW_DEV_ORIGINS: 'true' };
}

const item = (locdate: number, dateName: string, isHoliday = 'Y') => ({ dateKind: '01', dateName, isHoliday, locdate, seq: 1 });

/** 실제 응답처럼: 여러 건이면 item 배열, 1건이면 객체, 0건이면 items가 "" */
function jsonBody(items: ReturnType<typeof item>[]): string {
  const itemsField = items.length === 0 ? '' : { item: items.length === 1 ? items[0] : items };
  return JSON.stringify({
    response: {
      header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
      body: { items: itemsField, numOfRows: 100, pageNo: 1, totalCount: items.length },
    },
  });
}

function xmlBody(items: ReturnType<typeof item>[]): string {
  const itemXml = items
    .map(
      (it) =>
        `<item><dateKind>${it.dateKind}</dateKind><dateName>${it.dateName}</dateName><isHoliday>${it.isHoliday}</isHoliday><locdate>${it.locdate}</locdate><seq>${it.seq}</seq></item>`,
    )
    .join('\n      ');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<response>
  <header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>
  <body>
    <items>${itemXml ? `\n      ${itemXml}\n    ` : ''}</items>
    <numOfRows>100</numOfRows><pageNo>1</pageNo><totalCount>${items.length}</totalCount>
  </body>
</response>`;
}

const AUTH_ERROR_XML = `<OpenAPI_ServiceResponse>
  <cmmMsgHeader>
    <errMsg>SERVICE ERROR</errMsg>
    <returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>
    <returnReasonCode>30</returnReasonCode>
  </cmmMsgHeader>
</OpenAPI_ServiceResponse>`;

const OCT_2026 = [item(20261003, '개천절'), item(20261005, '대체공휴일'), item(20261009, '한글날')];
const NOW = kst('2026-09-27T10:00');
const q = (year: string) => new URLSearchParams({ year });
const fetchReturning = (text: string) => vi.fn(async (_url: string) => new Response(text));
const asFetch = (fn: unknown) => fn as typeof fetch;

describe('정규화 (normalizeHolidays)', () => {
  it('여러 건(배열): locdate → YYYY-MM-DD, 공휴일(isHoliday=Y)만, 날짜순', () => {
    const json = JSON.parse(jsonBody([item(20261009, '한글날'), item(20261003, '개천절'), item(20261225, '어떤기념일', 'N')]));
    expect(normalizeHolidays(json, 2026, NOW)).toEqual({
      year: 2026,
      holidays: [
        { date: '2026-10-03', name: '개천절' },
        { date: '2026-10-09', name: '한글날' },
      ],
      fetchedAt: NOW.toISOString(),
    });
  });

  it('1건이면 item이 객체로 온다 → 배열 1개', () => {
    const json = JSON.parse(jsonBody([item(20261225, '기독탄신일')]));
    expect(json.response.body.items.item).not.toBeInstanceOf(Array);
    expect(normalizeHolidays(json, 2026, NOW).holidays).toEqual([{ date: '2026-12-25', name: '기독탄신일' }]);
  });

  it('0건이면 items가 빈 문자열 → 빈 배열', () => {
    const json = JSON.parse(jsonBody([]));
    expect(json.response.body.items).toBe('');
    expect(normalizeHolidays(json, 2027, NOW).holidays).toEqual([]);
    expect(normalizeHolidays({ response: { body: {} } }, 2027, NOW).holidays).toEqual([]);
  });

  it('한 날짜에 이름이 둘이면 둘 다, 같은 날짜·이름 중복은 하나로', () => {
    const json = JSON.parse(jsonBody([item(20250505, '어린이날'), item(20250505, '부처님오신날'), item(20250505, '어린이날')]));
    expect(normalizeHolidays(json, 2025, NOW).holidays).toEqual([
      { date: '2025-05-05', name: '어린이날' },
      { date: '2025-05-05', name: '부처님오신날' },
    ]);
  });

  it('locdate 형식', () => {
    expect(toIsoDate(20261003)).toBe('2026-10-03');
    expect(toIsoDate('20261003')).toBe('2026-10-03');
    expect(toIsoDate('2026-10-03')).toBeNull();
    expect(toIsoDate(undefined)).toBeNull();
  });
});

describe('XML 응답도 같은 형식으로', () => {
  it.each([
    ['여러 건', OCT_2026],
    ['1건', [item(20261225, '기독탄신일')]],
    ['0건', []],
  ])('%s', (_label, items) => {
    const fromJson = normalizeHolidays(parseJsonOrXml(jsonBody(items)), 2026, NOW);
    const fromXml = normalizeHolidays(parseJsonOrXml(xmlBody(items)), 2026, NOW);
    expect(fromXml).toEqual(fromJson);
  });

  it('빈 요소(<items/>), 엔티티, CDATA, 주석', () => {
    expect(parseXml('<a><items/><b>x &amp; y &#44053;</b><!-- memo --><c><![CDATA[<raw>]]></c></a>')).toEqual({
      a: { items: '', b: 'x & y 강', c: '<raw>' },
    });
  });

  it('잘못된 XML·일반 텍스트는 throw', () => {
    expect(() => parseXml('<a><b></a>')).toThrow();
    expect(() => parseJsonOrXml('Unauthorized')).toThrow();
  });
});

describe('handleRoute (holidays)', () => {
  beforeEach(() => clearMemoryCache());
  afterEach(() => vi.restoreAllMocks());

  it('연 단위로 호출하고(serviceKey·pageNo·numOfRows·solYear·_type) 정규화 결과를 저장(MISS)', async () => {
    const { kv, store } = fakeKv();
    const fetchFn = fetchReturning(jsonBody(OCT_2026));
    const r = await handleRoute(holidaysRoute, q('2026'), envWith(kv), NOW, asFetch(fetchFn));
    expect(r.status).toBe(200);
    expect(r.cache).toBe('MISS');
    expect(JSON.parse(r.body)).toEqual({
      year: 2026,
      holidays: [
        { date: '2026-10-03', name: '개천절' },
        { date: '2026-10-05', name: '대체공휴일' },
        { date: '2026-10-09', name: '한글날' },
      ],
      fetchedAt: NOW.toISOString(),
      cache: 'MISS',
    });
    const url = new URL(fetchFn.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      serviceKey: 'test-key',
      pageNo: '1',
      numOfRows: '100',
      solYear: '2026',
      _type: 'json',
    });
    expect(url.searchParams.has('solMonth')).toBe(false);
    // 저장본에는 cache 상태를 넣지 않는다
    expect(JSON.parse(JSON.parse(store.get('holidays:2026')!).body).cache).toBeUndefined();
  });

  it('_type=json인데 XML로 와도 같은 형식으로 응답·저장', async () => {
    const { kv, store } = fakeKv();
    const r = await handleRoute(holidaysRoute, q('2026'), envWith(kv), NOW, asFetch(fetchReturning(xmlBody(OCT_2026))));
    expect(r.cache).toBe('MISS');
    expect(JSON.parse(r.body).holidays).toHaveLength(3);
    expect(JSON.parse(JSON.parse(store.get('holidays:2026')!).body).holidays[0]).toEqual({ date: '2026-10-03', name: '개천절' });
  });

  it('24시간 안에는 업스트림을 부르지 않는다(HIT), 받은 시각은 처음 그대로', async () => {
    const { kv } = fakeKv();
    const env = envWith(kv);
    await handleRoute(holidaysRoute, q('2026'), env, NOW, asFetch(fetchReturning(jsonBody(OCT_2026))));
    clearMemoryCache(); // 다른 isolate에서도 KV로 HIT
    const fetchFn = vi.fn();
    const r = await handleRoute(holidaysRoute, q('2026'), env, new Date(NOW.getTime() + 23 * HOUR), asFetch(fetchFn));
    expect(r.cache).toBe('HIT');
    expect(fetchFn).not.toHaveBeenCalled();
    expect(JSON.parse(r.body)).toMatchObject({ cache: 'HIT', fetchedAt: NOW.toISOString() });
  });

  it('24시간이 지나면 다시 받는다(MISS) — 임시공휴일 추가 반영', async () => {
    const { kv } = fakeKv();
    const env = envWith(kv);
    await handleRoute(holidaysRoute, q('2026'), env, NOW, asFetch(fetchReturning(jsonBody(OCT_2026))));
    const later = new Date(NOW.getTime() + 24 * HOUR);
    const added = [...OCT_2026, item(20261002, '임시공휴일')];
    const r = await handleRoute(holidaysRoute, q('2026'), env, later, asFetch(fetchReturning(jsonBody(added))));
    expect(r.cache).toBe('MISS');
    expect(JSON.parse(r.body).holidays[0]).toEqual({ date: '2026-10-02', name: '임시공휴일' });
    expect(JSON.parse(r.body).fetchedAt).toBe(later.toISOString());
  });

  it('원본이 실패하면 만료된 캐시라도 돌려준다(STALE)', async () => {
    const { kv } = fakeKv();
    const env = envWith(kv);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await handleRoute(holidaysRoute, q('2026'), env, NOW, asFetch(fetchReturning(jsonBody(OCT_2026))));
    const threeDaysLater = new Date(NOW.getTime() + 72 * HOUR);
    for (const failing of [
      fetchReturning(AUTH_ERROR_XML),
      vi.fn(async () => new Response('', { status: 500 })),
      vi.fn(async () => Promise.reject(new Error('timeout'))),
    ]) {
      const r = await handleRoute(holidaysRoute, q('2026'), env, threeDaysLater, asFetch(failing));
      expect(r.cache).toBe('STALE');
      expect(JSON.parse(r.body)).toMatchObject({ year: 2026, cache: 'STALE', fetchedAt: NOW.toISOString() });
      expect(JSON.parse(r.body).holidays).toHaveLength(3);
    }
  });

  it('캐시도 없고 원본도 실패하면 502와 에러코드 (XML 인증 오류 → 30)', async () => {
    const { kv } = fakeKv();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await handleRoute(holidaysRoute, q('2026'), envWith(kv), NOW, asFetch(fetchReturning(AUTH_ERROR_XML)));
    expect(r.status).toBe(502);
    expect(JSON.parse(r.body).code).toBe('30');
  });

  it('0건(내년 발표 전)은 저장하지 않고 holidays: [] — 다음 요청은 다시 원본을 부른다', async () => {
    const { kv, store } = fakeKv();
    const env = envWith(kv);
    const fetchFn = fetchReturning(jsonBody([]));
    const r = await handleRoute(holidaysRoute, q('2027'), env, NOW, asFetch(fetchFn));
    expect(r.status).toBe(200);
    expect(r.cache).toBe('MISS');
    expect(JSON.parse(r.body)).toMatchObject({ year: 2027, holidays: [], cache: 'MISS' });
    expect(store.has('holidays:2027')).toBe(false);
    await handleRoute(holidaysRoute, q('2027'), env, NOW, asFetch(fetchFn));
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('XML 0건(<items/>)도 같게 처리', async () => {
    const { kv, store } = fakeKv();
    const r = await handleRoute(holidaysRoute, q('2027'), envWith(kv), NOW, asFetch(fetchReturning(xmlBody([]).replace('<items></items>', '<items/>'))));
    expect(JSON.parse(r.body).holidays).toEqual([]);
    expect(store.has('holidays:2027')).toBe(false);
  });

  it('예전에 받은 데이터가 있는데 0건이 오면 일시적 이상으로 보고 이전 데이터(STALE)', async () => {
    const { kv, store } = fakeKv();
    const env = envWith(kv);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await handleRoute(holidaysRoute, q('2026'), env, NOW, asFetch(fetchReturning(jsonBody(OCT_2026))));
    const r = await handleRoute(holidaysRoute, q('2026'), env, new Date(NOW.getTime() + 25 * HOUR), asFetch(fetchReturning(jsonBody([]))));
    expect(r.cache).toBe('STALE');
    expect(JSON.parse(r.body).holidays).toHaveLength(3);
    expect(JSON.parse(JSON.parse(store.get('holidays:2026')!).body).holidays).toHaveLength(3);
  });

  it('year는 KST 기준 올해-1 ~ 올해+1만, 그 외 400', async () => {
    const { kv } = fakeKv();
    const ok = fetchReturning(jsonBody(OCT_2026));
    for (const year of ['2025', '2026', '2027']) {
      const r = await handleRoute(holidaysRoute, q(year), envWith(kv), NOW, asFetch(ok));
      expect(r.status, year).toBe(200);
    }
    const never = vi.fn();
    for (const query of ['year=2024', 'year=2028', 'year=abc', 'year=', '', 'year=20266', 'year=2026.0']) {
      const r = await handleRoute(holidaysRoute, new URLSearchParams(query), envWith(kv), NOW, asFetch(never));
      expect(r.status, query).toBe(400);
      expect(JSON.parse(r.body).error).toContain('2025~2027');
    }
    expect(never).not.toHaveBeenCalled();
  });

  it('연도 경계는 UTC가 아니라 KST — 1월 1일 00:10(KST)이면 새해 기준', async () => {
    const { kv } = fakeKv();
    const newYearKst = kst('2027-01-01T00:10'); // UTC로는 아직 2026-12-31
    const ok = fetchReturning(jsonBody(OCT_2026));
    expect((await handleRoute(holidaysRoute, q('2028'), envWith(kv), newYearKst, asFetch(ok))).status).toBe(200);
    expect((await handleRoute(holidaysRoute, q('2025'), envWith(kv), newYearKst, asFetch(ok))).status).toBe(400);
  });

  it('비밀값 HOLIDAY_SERVICE_KEY가 없으면 500', async () => {
    const { kv } = fakeKv();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await handleRoute(holidaysRoute, q('2026'), { PROXY_CACHE: kv }, NOW, asFetch(vi.fn()));
    expect(r.status).toBe(500);
  });
});

describe('fetch 핸들러 (holidays)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearMemoryCache();
  });

  it('연휴계산기 appName의 앱인토스 호스트 4종 허용', () => {
    for (const host of ['web', 'private-web', 'apps', 'private-apps']) {
      expect(isAllowedOrigin(`https://holiday-planner.${host}.tossmini.com`, false)).toBe(true);
    }
  });

  it('GET /holidays?year= → JSON 본문과 X-Proxy-Cache 헤더', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(jsonBody(OCT_2026))));
    const { kv } = fakeKv();
    const origin = 'https://holiday-planner.private-web.tossmini.com';
    const res = await worker.fetch(new Request('https://proxy.test/holidays?year=2026', { headers: { Origin: origin } }), envWith(kv));
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(res.headers.get('X-Proxy-Cache')).toBe('MISS');
    const body = (await res.json()) as { year: number; holidays: unknown[]; cache: string };
    expect(body).toMatchObject({ year: 2026, cache: 'MISS' });
    expect(body.holidays).toHaveLength(3);

    const bad = await worker.fetch(new Request('https://proxy.test/holidays?year=1999', { headers: { Origin: origin } }), envWith(kv));
    expect(bad.status).toBe(400);
  });
});
