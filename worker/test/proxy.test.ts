import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { isAllowedOrigin } from '../src/lib/cors';
import { clearMemoryCache, handleRoute, normalizeServiceKey } from '../src/lib/proxy';
import type { Env } from '../src/lib/types';
import { kmaVilageFcstRoute, recentBaseTimes } from '../src/routes/kmaVilageFcst';

/** KST 시각으로 Date 만들기 */
const kst = (iso: string) => new Date(`${iso}+09:00`);

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

const okBody = (baseTime: string) =>
  JSON.stringify({ response: { header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' }, body: { items: { item: [{ baseTime }] } } } });
const errBody = (code: string) => JSON.stringify({ response: { header: { resultCode: code, resultMsg: 'ERR' } } });

function envWith(kv: KVNamespace): Env {
  return { PROXY_CACHE: kv, KMA_SERVICE_KEY: 'test-key', ALLOW_DEV_ORIGINS: 'true' };
}

const query = new URLSearchParams({ nx: '60', ny: '127' });

describe('recentBaseTimes', () => {
  it('발표 10분 뒤부터 해당 발표시각을 쓴다', () => {
    expect(recentBaseTimes(kst('2026-09-26T11:09'), 1)[0]).toEqual({ baseDate: '20260926', baseTime: '0800' });
    expect(recentBaseTimes(kst('2026-09-26T11:10'), 1)[0]).toEqual({ baseDate: '20260926', baseTime: '1100' });
  });
  it('자정~02:09는 전날 23시, 그 직전은 전날 20시', () => {
    expect(recentBaseTimes(kst('2026-09-26T02:09'), 2)).toEqual([
      { baseDate: '20260925', baseTime: '2300' },
      { baseDate: '20260925', baseTime: '2000' },
    ]);
  });
  it('02:10 직전 후보는 전날 23시', () => {
    expect(recentBaseTimes(kst('2026-09-26T02:10'), 2)).toEqual([
      { baseDate: '20260926', baseTime: '0200' },
      { baseDate: '20260925', baseTime: '2300' },
    ]);
  });
});

describe('handleRoute (kma vilage-fcst)', () => {
  const now = kst('2026-09-26T11:30');
  beforeEach(() => clearMemoryCache());

  it('캐시가 없으면 호출 후 저장(MISS), 서비스키·발표시각을 넣어 호출한다', async () => {
    const { kv, store } = fakeKv();
    const fetchFn = vi.fn(async () => new Response(okBody('1100')));
    const r = await handleRoute(kmaVilageFcstRoute, query, envWith(kv), now, fetchFn as unknown as typeof fetch);
    expect(r.cache).toBe('MISS');
    expect(r.version).toBe('202609261100');
    const url = new URL((fetchFn.mock.calls[0] as unknown as [string])[0]);
    expect(url.searchParams.get('serviceKey')).toBe('test-key');
    expect(url.searchParams.get('base_time')).toBe('1100');
    expect(url.searchParams.get('numOfRows')).toBe('1000');
    expect(store.has('kma-vilage-fcst:60:127')).toBe(true);
  });

  it('같은 발표시각 캐시가 있으면 업스트림을 부르지 않는다(HIT)', async () => {
    const { kv } = fakeKv();
    const env = envWith(kv);
    await handleRoute(kmaVilageFcstRoute, query, env, now, (async () => new Response(okBody('1100'))) as unknown as typeof fetch);
    const fetchFn = vi.fn();
    const r = await handleRoute(kmaVilageFcstRoute, query, env, now, fetchFn as unknown as typeof fetch);
    expect(r.cache).toBe('HIT');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('최신 발표분이 NO_DATA면 직전 발표분을 받는다', async () => {
    const { kv } = fakeKv();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(errBody('03')))
      .mockResolvedValueOnce(new Response(okBody('0800')));
    const r = await handleRoute(kmaVilageFcstRoute, query, envWith(kv), now, fetchFn as unknown as typeof fetch);
    expect(r.cache).toBe('MISS');
    expect(r.version).toBe('202609260800');
  });

  it('업스트림 실패(한도 초과 등) 시 마지막 정상 응답을 돌려준다(STALE)', async () => {
    const { kv } = fakeKv();
    const env = envWith(kv);
    await handleRoute(kmaVilageFcstRoute, query, env, kst('2026-09-26T09:00'), (async () => new Response(okBody('0800'))) as unknown as typeof fetch);
    const r = await handleRoute(kmaVilageFcstRoute, query, env, now, (async () => new Response(errBody('22'))) as unknown as typeof fetch);
    expect(r.cache).toBe('STALE');
    expect(r.version).toBe('202609260800');
    expect(r.body).toBe(okBody('0800'));
  });

  it('캐시도 없고 업스트림도 실패하면 502와 에러코드', async () => {
    const { kv } = fakeKv();
    const r = await handleRoute(kmaVilageFcstRoute, query, envWith(kv), now, (async () => new Response(errBody('30'))) as unknown as typeof fetch);
    expect(r.status).toBe(502);
    expect(JSON.parse(r.body).code).toBe('30');
  });

  it('XML 에러 응답/네트워크 오류도 실패로 처리', async () => {
    const { kv } = fakeKv();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('<OpenAPI_ServiceResponse>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</OpenAPI_ServiceResponse>'))
      .mockRejectedValueOnce(new Error('timeout'));
    const r = await handleRoute(kmaVilageFcstRoute, query, envWith(kv), now, fetchFn as unknown as typeof fetch);
    expect(r.status).toBe(502);
  });

  it('KV 쓰기가 실패해도 응답은 돌려준다', async () => {
    const { kv } = fakeKv();
    (kv.put as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('KV put limit'));
    const r = await handleRoute(kmaVilageFcstRoute, query, envWith(kv), now, (async () => new Response(okBody('1100'))) as unknown as typeof fetch);
    expect(r.status).toBe(200);
  });

  it('KV 쓰기가 막혀도 같은 isolate에서는 메모리 캐시로 업스트림을 다시 부르지 않는다', async () => {
    const { kv } = fakeKv();
    (kv.put as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('KV put limit'));
    const env = envWith(kv);
    const fetchFn = vi.fn(async () => new Response(okBody('1100')));
    await handleRoute(kmaVilageFcstRoute, query, env, now, fetchFn as unknown as typeof fetch);
    const r = await handleRoute(kmaVilageFcstRoute, query, env, now, fetchFn as unknown as typeof fetch);
    expect(r.cache).toBe('HIT');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('Encoding 형태로 등록한 서비스키도 한 번만 인코딩되어 나간다', async () => {
    expect(normalizeServiceKey('abc%2Bdef%3D%3D')).toBe('abc+def==');
    expect(normalizeServiceKey('abc+def==')).toBe('abc+def==');
    const { kv } = fakeKv();
    const fetchFn = vi.fn(async () => new Response(okBody('1100')));
    await handleRoute(kmaVilageFcstRoute, query, { ...envWith(kv), KMA_SERVICE_KEY: 'abc%2Bdef%3D%3D' }, now, fetchFn as unknown as typeof fetch);
    const url = (fetchFn.mock.calls[0] as unknown as [string])[0];
    expect(url).toContain('serviceKey=abc%2Bdef%3D%3D');
    expect(new URL(url).searchParams.get('serviceKey')).toBe('abc+def==');
  });

  it('격자 좌표 검증', async () => {
    const { kv } = fakeKv();
    for (const q of ['nx=0&ny=10', 'nx=60', 'nx=abc&ny=1', 'nx=150&ny=1', 'nx=60&ny=254']) {
      const r = await handleRoute(kmaVilageFcstRoute, new URLSearchParams(q), envWith(kv), now, vi.fn() as unknown as typeof fetch);
      expect(r.status).toBe(400);
    }
  });
});

describe('CORS', () => {
  it('앱인토스 호스트 4종 허용, 다른 앱/도메인 거부', () => {
    for (const host of ['web', 'private-web', 'apps', 'private-apps']) {
      expect(isAllowedOrigin(`https://laundry-today.${host}.tossmini.com`, false)).toBe(true);
    }
    expect(isAllowedOrigin('https://other-app.web.tossmini.com', false)).toBe(false);
    expect(isAllowedOrigin('https://evil.example.com', true)).toBe(false);
    expect(isAllowedOrigin(null, true)).toBe(false);
  });
  it('로컬 개발 Origin은 ALLOW_DEV_ORIGINS일 때만', () => {
    expect(isAllowedOrigin('http://localhost:5173', true)).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173', false)).toBe(false);
  });

  it('fetch 핸들러: 허용 안 된 Origin은 403, 프리플라이트는 204', async () => {
    const { kv } = fakeKv();
    const env = envWith(kv);
    const denied = await worker.fetch(new Request('https://proxy.test/kma/vilage-fcst?nx=60&ny=127', { headers: { Origin: 'https://evil.example.com' } }), env);
    expect(denied.status).toBe(403);
    const pre = await worker.fetch(
      new Request('https://proxy.test/kma/vilage-fcst', { method: 'OPTIONS', headers: { Origin: 'https://laundry-today.web.tossmini.com' } }),
      env,
    );
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('https://laundry-today.web.tossmini.com');
    const notFound = await worker.fetch(new Request('https://proxy.test/nope', { headers: { Origin: 'http://localhost:5173' } }), env);
    expect(notFound.status).toBe(404);
  });
});
