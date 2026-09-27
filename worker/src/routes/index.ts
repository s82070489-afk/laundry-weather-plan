import type { ProxyRoute } from '../lib/types';
import { holidaysRoute } from './holidays';
import { kmaVilageFcstRoute } from './kmaVilageFcst';

/**
 * 라우트 등록부. 다음 공공데이터 앱에서 새 API가 필요하면:
 *   1) routes/<이름>.ts에 ProxyRoute 구현
 *   2) 아래 배열에 추가
 *   3) `npx wrangler secret put <secretName>`으로 서비스키 등록
 *   4) config/allowedOrigins.ts의 APP_NAMES에 새 앱 appName 추가
 */
export const ROUTES: readonly ProxyRoute[] = [
  kmaVilageFcstRoute, // 오늘의 빨래지수 — 기상청 단기예보
  holidaysRoute, // 연휴계산기 — 한국천문연구원 공휴일
];
