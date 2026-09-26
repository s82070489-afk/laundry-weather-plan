import { corsHeaders, isAllowedOrigin } from './lib/cors';
import { handleRoute } from './lib/proxy';
import type { Env } from './lib/types';
import { ROUTES } from './routes';

/**
 * 공공데이터 공통 프록시. 서비스키를 Worker 비밀값으로 숨기고, 파라미터 단위로 KV에 캐싱한다.
 * 라우트 추가는 src/routes/index.ts, 허용 Origin은 src/config/allowedOrigins.ts.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = isAllowedOrigin(origin, env.ALLOW_DEV_ORIGINS === 'true');

    // 브라우저 밖에서의 무단 호출을 줄이기 위해 허용된 Origin만 받는다
    // (Origin 헤더는 브라우저 밖에서 위조할 수 있으니 완전한 차단 수단은 아님)
    if (!allowed || !origin) {
      return new Response(JSON.stringify({ error: 'origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: cors });

    const route = ROUTES.find((r) => r.path === url.pathname);
    if (!route) {
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const result = await handleRoute(route, url.searchParams, env, new Date());
    const headers: Record<string, string> = {
      ...cors,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    };
    if (result.cache) headers['X-Proxy-Cache'] = result.cache;
    if (result.version) headers['X-Proxy-Version'] = result.version;
    return new Response(result.body, { status: result.status, headers });
  },
} satisfies ExportedHandler<Env>;
