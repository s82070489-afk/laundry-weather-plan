/**
 * appName(앱인토스 고유 ID, 등록 후 수정 불가) — 확정: laundry-today (한국어 앱 이름 "오늘의 빨래지수").
 * apps-in-toss.config.ts와 localStorage 키 prefix가 모두 이 값을 참조한다.
 * Worker CORS 허용 목록(worker/src/config/allowedOrigins.ts)에도 같은 값이 있어야 한다.
 * (config 로더에서도 읽히므로 import.meta.env 등 Vite 전용 문법을 쓰지 않는다)
 */
export const APP_NAME = 'laundry-today';
