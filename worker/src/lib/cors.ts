import {
  APP_NAMES,
  DEV_ORIGIN_PATTERN,
  EXTRA_ORIGINS,
  TOSS_MINIAPP_HOST_TEMPLATES,
} from '../config/allowedOrigins';

const PRODUCTION_ORIGINS = new Set<string>([
  ...APP_NAMES.flatMap((appName) =>
    TOSS_MINIAPP_HOST_TEMPLATES.map((t) => `https://${t.replace('{appName}', appName)}`),
  ),
  ...EXTRA_ORIGINS,
]);

export function isAllowedOrigin(origin: string | null, allowDevOrigins: boolean): boolean {
  if (!origin) return false;
  if (PRODUCTION_ORIGINS.has(origin)) return true;
  return allowDevOrigins && DEV_ORIGIN_PATTERN.test(origin);
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Expose-Headers': 'X-Proxy-Cache, X-Proxy-Version',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
