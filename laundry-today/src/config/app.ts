/** 앱 전역 상수. appName은 ./appName.ts 한 곳에서만 관리한다. */
export { APP_NAME } from './appName';

export const APP_DISPLAY_NAME = '오늘 빨래해도 될까';

/** 콘솔에 등록할 개인정보처리방침 공개 URL — 호스팅 위치 확정 후 교체 */
export const PRIVACY_POLICY_URL =
  'https://github.com/s82070489-afk/laundry-weather-plan/blob/main/laundry-today/PRIVACY_POLICY.md';

export const WEATHER_PROXY_URL = (import.meta.env.VITE_WEATHER_PROXY_URL ?? '').replace(/\/$/, '');

/**
 * 개발 단계에서는 반드시 테스트 광고 ID를 써야 함 — 실 광고 ID로 테스트하면
 * 앱인토스 정책 위반으로 불이익을 받을 수 있음. VITE_USE_LIVE_ADS=true일 때만 라이브 ID.
 * 라이브 ID는 이 앱 콘솔에서 새로 발급받아 채운다(배출일 앱 ID 재사용 금지).
 */
const LIVE_BANNER_AD_GROUP_ID = '';
const TEST_BANNER_AD_GROUP_ID = 'ait-ad-test-banner-id';
export const BANNER_AD_GROUP_ID =
  import.meta.env.VITE_USE_LIVE_ADS === 'true' && LIVE_BANNER_AD_GROUP_ID
    ? LIVE_BANNER_AD_GROUP_ID
    : TEST_BANNER_AD_GROUP_ID;

export const WEATHER_SOURCE_TEXT = '날씨 정보 출처: 기상청';
export const REFERENCE_NOTICE_TEXT = '기상청 예보 기반 참고 정보예요';
export const FINE_DUST_NOTICE_TEXT =
  '미세먼지는 판정에 포함되지 않아요. 황사·미세먼지가 걱정되면 에어코리아에서 확인하세요.';
