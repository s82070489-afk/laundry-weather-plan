import { describe, expect, it } from 'vitest';
import { BANNER_AD_GROUP_ID, LIVE_BANNER_AD_GROUP_ID, liveBannerAdGroupId } from './app';

describe('배너 광고 ID', () => {
  it('라이브 ID는 발급받은 값이고, 비어 있으면 null(광고 영역 없음)', () => {
    expect(liveBannerAdGroupId(LIVE_BANNER_AD_GROUP_ID)).toBe('ait.v2.live.955d97e13e9846a0');
    expect(liveBannerAdGroupId('')).toBeNull();
    expect(liveBannerAdGroupId('  ')).toBeNull();
  });

  it('테스트 실행(DEV)에서는 라이브 ID를 쓰지 않는다', () => {
    // vitest는 import.meta.env.DEV=true로 돌아서 개발 서버와 같은 분기를 탄다.
    // 빌드 결과물 쪽은 scripts/check-bundle-ads.mjs가 dist를 직접 검사한다.
    expect(import.meta.env.DEV).toBe(true);
    expect(BANNER_AD_GROUP_ID).not.toBe(LIVE_BANNER_AD_GROUP_ID);
  });
});
