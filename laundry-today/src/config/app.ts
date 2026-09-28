/** 앱 전역 상수. appName은 ./appName.ts 한 곳에서만 관리한다. */
export { APP_NAME } from './appName';

/** 한국어 앱 이름 (콘솔 등록명과 같게) */
export const APP_DISPLAY_NAME = '오늘의 빨래지수';

/**
 * 설정 화면 "개인정보처리방침" 링크. 비어 있으면 설정 화면에서 해당 줄을 숨긴다.
 * TODO: Notion 공개 페이지를 만든 뒤 URL을 넣는다 (원문: laundry-today/PRIVACY_POLICY.md).
 */
export const PRIVACY_POLICY_URL = '';

export const WEATHER_PROXY_URL = (import.meta.env.VITE_WEATHER_PROXY_URL ?? '').replace(/\/$/, '');

/**
 * 라이브 배너 광고 그룹 ID — 이 앱(laundry-index) 콘솔에서 발급받은 값(배출일 앱 ID 재사용 금지).
 * 운영 빌드(VITE_USE_LIVE_ADS=true)에서만 쓰인다. 비우면 운영 빌드에서 광고 영역을 렌더링하지 않는다.
 */
export const LIVE_BANNER_AD_GROUP_ID = 'ait.v2.live.955d97e13e9846a0';

/** 개발·QR 테스트용 공식 테스트 광고 ID (실 광고 ID로 테스트하면 정책 위반) */
export const TEST_BANNER_AD_GROUP_ID = 'ait-ad-test-banner-id';

/**
 * 운영 빌드(VITE_USE_LIVE_ADS=true)면 라이브 ID, 그 외엔 테스트 ID.
 * 운영 빌드인데 라이브 ID가 비어 있으면 null → 광고 영역 없음(테스트 ID로 대체하지 않음).
 */
export function resolveBannerAdGroupId(useLiveAds: boolean, liveId: string): string | null {
  if (!useLiveAds) return TEST_BANNER_AD_GROUP_ID;
  return liveId.trim() || null;
}

export const BANNER_AD_GROUP_ID = resolveBannerAdGroupId(
  import.meta.env.VITE_USE_LIVE_ADS === 'true',
  LIVE_BANNER_AD_GROUP_ID,
);

export const WEATHER_SOURCE_TEXT = '날씨 정보 출처: 기상청';
export const REFERENCE_NOTICE_TEXT = '기상청 예보 기반 참고 정보예요';
export const FINE_DUST_NOTICE_TEXT =
  '미세먼지는 판정에 포함되지 않아요. 황사·미세먼지가 걱정되면 에어코리아에서 확인하세요.';
