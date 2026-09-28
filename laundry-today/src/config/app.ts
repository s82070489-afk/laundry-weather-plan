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
 * 빌드(npm run build) 결과물은 항상 이 값을 쓴다. 비우면 광고 영역을 렌더링하지 않는다.
 */
export const LIVE_BANNER_AD_GROUP_ID = 'ait.v2.live.955d97e13e9846a0';

/** 라이브 ID가 비어 있으면 null → 광고 영역 없음 */
export function liveBannerAdGroupId(liveId: string): string | null {
  return liveId.trim() || null;
}

/**
 * 개발 서버(npm run dev, import.meta.env.DEV)에서만 공식 테스트 광고 ID를 쓴다.
 * 심사 기준상 출시 번들에 테스트 광고 ID가 있으면 반려되므로, 테스트 ID 문자열은
 * 이 DEV 분기 안에만 직접 적는다 — 빌드 때 DEV가 false로 치환되고 죽은 분기째 제거된다.
 * (빌드 후 scripts/check-bundle-ads.mjs가 dist에 테스트 ID가 없는지 검사)
 */
export const BANNER_AD_GROUP_ID: string | null = import.meta.env.DEV
  ? 'ait-ad-test-banner-id'
  : liveBannerAdGroupId(LIVE_BANNER_AD_GROUP_ID);

export const WEATHER_SOURCE_TEXT = '날씨 정보 출처: 기상청';
export const REFERENCE_NOTICE_TEXT = '기상청 예보 기반 참고 정보예요';
export const FINE_DUST_NOTICE_TEXT =
  '미세먼지는 판정에 포함되지 않아요. 황사·미세먼지가 걱정되면 에어코리아에서 확인하세요.';
