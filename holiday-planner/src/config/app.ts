/** 앱 전역 상수. appName은 ./appName.ts 한 곳에서만 관리한다. */
export { APP_NAME } from './appName';

export const APP_DISPLAY_NAME = '연휴계산기';

/** 콘솔에 등록할 개인정보처리방침 공개 URL — 호스팅 위치 확정 후 교체 */
export const PRIVACY_POLICY_URL =
  'https://github.com/s82070489-afk/laundry-weather-plan/blob/main/holiday-planner/PRIVACY_POLICY.md';

/** 근로기준법 제60조(연차 유급휴가) — 국가법령정보센터 */
export const LABOR_LAW_ARTICLE_60_URL = 'https://www.law.go.kr/법령/근로기준법/제60조';

/** Cloudflare Worker 프록시 주소 (../worker). 한국천문연구원 API 서비스키는 Worker에만 있다. */
export const HOLIDAY_PROXY_URL = (import.meta.env.VITE_HOLIDAY_PROXY_URL ?? '').replace(/\/$/, '');

/**
 * 기기 캐시 신선도(시간). Worker가 24시간 캐시하므로 앱은 짧게 두어 임시공휴일 반영이 크게 늦지 않게 하고,
 * 내년 공휴일 발표 전(0건, Worker가 저장하지 않음)에도 원본 호출이 몰리지 않게 한다.
 */
export const HOLIDAY_CACHE_HOURS = 6;

/**
 * 개발 단계에서는 반드시 테스트 광고 ID를 써야 함 — 실 광고 ID로 테스트하면
 * 앱인토스 정책 위반으로 불이익을 받을 수 있음. VITE_USE_LIVE_ADS=true일 때만 라이브 ID.
 * 라이브 ID는 이 앱 콘솔에서 새로 발급받아 채운다(다른 앱 ID 재사용 금지).
 */
const LIVE_BANNER_AD_GROUP_ID = '';
const TEST_BANNER_AD_GROUP_ID = 'ait-ad-test-banner-id';
export const BANNER_AD_GROUP_ID =
  import.meta.env.VITE_USE_LIVE_ADS === 'true' && LIVE_BANNER_AD_GROUP_ID
    ? LIVE_BANNER_AD_GROUP_ID
    : TEST_BANNER_AD_GROUP_ID;

export const HOLIDAY_SOURCE_TEXT = '공휴일 정보 출처: 한국천문연구원 특일 정보(공공데이터포털)';
/** 근무 요일은 주 5일(토·일 휴무) 고정 — 따로 설정하지 않는다 */
export const CALC_BASIS_TEXT = '주 5일(토·일 휴무) 기준으로 계산한 참고용 정보예요. 회사 규정과 다를 수 있어요.';
export const STALE_NOTICE_TEXT = '최신 공휴일 정보를 불러오지 못했어요. 이전에 받은 정보로 보여드려요.';
export const NEXT_YEAR_PENDING_TEXT = '내년 공휴일은 아직 발표 전이에요';
export const NEXT_YEAR_FAILED_TEXT = '내년 공휴일 정보를 불러오지 못했어요';
export const ANNUAL_LEAVE_NOTICE_TEXT =
  '입사일 기준, 출근율 80% 이상을 가정한 참고용이에요. 회계연도 기준인 회사는 실제와 다를 수 있어요.';
