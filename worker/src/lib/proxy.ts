import type { CachedEntry, Env, ProxyRoute } from './types';

const UPSTREAM_TIMEOUT_MS = 8000;

export type ProxyCacheStatus = 'HIT' | 'MISS' | 'STALE';

export interface ProxyResult {
  status: number;
  body: string;
  cache?: ProxyCacheStatus;
  version?: string;
}

function jsonError(status: number, error: string, code?: string): ProxyResult {
  return { status, body: JSON.stringify({ error, code }) };
}

async function readCache(env: Env, key: string): Promise<CachedEntry | null> {
  try {
    return await env.PROXY_CACHE.get<CachedEntry>(key, 'json');
  } catch (e) {
    console.warn(`[cache] read failed ${key}`, e);
    return null;
  }
}

async function writeCache(env: Env, key: string, entry: CachedEntry, ttl: number): Promise<void> {
  try {
    await env.PROXY_CACHE.put(key, JSON.stringify(entry), { expirationTtl: ttl });
  } catch (e) {
    // KV 무료 한도(쓰기 1,000회/일) 초과 등 — 응답은 그대로 돌려준다
    console.warn(`[cache] write failed ${key}`, e);
  }
}

/**
 * 공통 프록시 흐름:
 *   1) 캐시에 현재 최신 버전이 있으면 그대로 (HIT) — 업스트림 호출 없음
 *   2) 없으면 후보 버전을 최신순으로 호출, 처음 성공한 응답을 저장하고 반환 (MISS)
 *   3) 전부 실패하면 캐시의 마지막 정상 응답을 반환 (STALE), 그것도 없으면 502
 */
export async function handleRoute(
  route: ProxyRoute,
  query: URLSearchParams,
  env: Env,
  now: Date,
  fetchFn: typeof fetch = fetch,
): Promise<ProxyResult> {
  const params = route.parseParams(query);
  if (typeof params === 'string') return jsonError(400, params);

  const serviceKey = env[route.secretName];
  if (typeof serviceKey !== 'string' || !serviceKey) {
    console.error(`[config] secret ${route.secretName} is not set`);
    return jsonError(500, '프록시 설정 오류');
  }

  const key = route.cacheKey(params);
  const candidates = route.candidates(params, serviceKey, now);
  const cached = await readCache(env, key);

  if (cached && cached.version >= candidates[0].version) {
    return { status: 200, body: cached.body, cache: 'HIT', version: cached.version };
  }

  let lastCode = 'UPSTREAM_ERROR';
  for (const candidate of candidates) {
    // 이미 가진 버전 이하를 다시 받아올 필요는 없다
    if (cached && cached.version >= candidate.version) break;
    try {
      const res = await fetchFn(candidate.url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
      if (!res.ok) {
        lastCode = `HTTP_${res.status}`;
        console.warn(`[upstream] ${route.path} v=${candidate.version} HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        // 공공데이터포털은 인증 오류 등을 XML로 줄 때가 있다
        lastCode = 'NON_JSON';
        console.warn(`[upstream] ${route.path} v=${candidate.version} non-JSON: ${text.slice(0, 200)}`);
        continue;
      }
      const check = route.check(json);
      if (!check.ok) {
        lastCode = check.code;
        const label = route.errorLabels?.[check.code] ?? check.message;
        console.warn(`[upstream] ${route.path} v=${candidate.version} resultCode=${check.code} ${label}`);
        continue;
      }
      await writeCache(env, key, { version: candidate.version, savedAt: now.getTime(), body: text }, route.retentionSeconds);
      return { status: 200, body: text, cache: 'MISS', version: candidate.version };
    } catch (e) {
      lastCode = 'FETCH_FAILED';
      console.warn(`[upstream] ${route.path} v=${candidate.version} fetch failed`, e);
    }
  }

  if (cached) {
    return { status: 200, body: cached.body, cache: 'STALE', version: cached.version };
  }
  return jsonError(502, '공공데이터 API 호출에 실패했어요', lastCode);
}
