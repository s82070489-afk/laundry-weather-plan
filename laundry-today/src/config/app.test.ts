import { describe, expect, it } from 'vitest';
import { TEST_BANNER_AD_GROUP_ID, resolveBannerAdGroupId } from './app';

describe('resolveBannerAdGroupId', () => {
  it('개발·QR 테스트에서는 항상 테스트 광고 ID', () => {
    expect(resolveBannerAdGroupId(false, '')).toBe(TEST_BANNER_AD_GROUP_ID);
    expect(resolveBannerAdGroupId(false, 'ait.v2.live.x')).toBe(TEST_BANNER_AD_GROUP_ID);
  });
  it('운영 빌드에서는 라이브 ID, 비어 있으면 null(광고 영역 없음)', () => {
    expect(resolveBannerAdGroupId(true, 'ait.v2.live.x')).toBe('ait.v2.live.x');
    expect(resolveBannerAdGroupId(true, '')).toBeNull();
    expect(resolveBannerAdGroupId(true, '  ')).toBeNull();
  });
});
