/**
 * CORS 허용 Origin 설정. 새 앱인토스 미니앱이 이 프록시를 쓰게 되면 APP_NAMES에 appName만 추가한다.
 *
 * 앱인토스 미니앱이 서빙되는 호스트 (같은 번들을 여러 호스트로 서비스함):
 *   - SDK 3.x: {appName}.web.tossmini.com (출시 후), {appName}.private-web.tossmini.com (QR/테스트)
 *   - SDK 2.x: {appName}.apps.tossmini.com (출시 후), {appName}.private-apps.tossmini.com (QR/테스트)
 * 전환기라 네 가지를 모두 허용한다.
 */
export const APP_NAMES: readonly string[] = [
  'laundry-index', // 오늘의 빨래지수 (appName 확정, 앱 폴더는 laundry-today/)
  'holiday-planner', // 연휴계산기 (appName 미정 — 후보 holiday-planner / long-weekend. 확정 시 앱 src/config/appName.ts와 함께 수정)
];

export const TOSS_MINIAPP_HOST_TEMPLATES: readonly string[] = [
  '{appName}.web.tossmini.com',
  '{appName}.private-web.tossmini.com',
  '{appName}.apps.tossmini.com',
  '{appName}.private-apps.tossmini.com',
];

/** 추가로 허용할 고정 Origin (예: 자체 웹 미리보기 도메인) */
export const EXTRA_ORIGINS: readonly string[] = [];

/** ALLOW_DEV_ORIGINS="true"일 때만 허용되는 로컬 개발 Origin (포트 무관) */
export const DEV_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
