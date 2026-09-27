import { useEffect, useRef, useState } from 'react';
import { TossAds } from '@apps-in-toss/web-framework';
import { useTossAdsReady } from '../hooks/useTossAdsReady';

interface BannerAdProps {
  adGroupId: string;
}

/**
 * 앱인토스 배너 광고(TossAds.attachBanner)를 지정한 위치에 렌더링한다.
 * useTossAdsReady로 TossAds.initialize()가 완료될 때까지 기다린 뒤에만
 * attachBanner를 호출한다 — 초기화 전에 호출하면 "SDK가 초기화되지
 * 않았습니다"(code 1007) 에러가 난다(실기기에서 실제 확인됨).
 * 광고 미지원/no-fill/렌더 실패 시에는 아무것도 렌더링하지 않아(null 반환)
 * 레이아웃에 빈 공간이 남지 않는다 — .banner-ad의 min-height는 광고가
 * 실제로 붙어있는 동안에만 적용된다.
 */
export default function BannerAd({ adGroupId }: BannerAdProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const readyState = useTossAdsReady();
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    if (readyState !== 'ready' || !containerRef.current) return;

    try {
      const { destroy } = TossAds.attachBanner(adGroupId, containerRef.current, {
        theme: 'light',
        variant: 'card',
        callbacks: {
          onNoFill: () => setHasFailed(true),
          onAdFailedToRender: () => setHasFailed(true),
        },
      });
      return () => destroy();
    } catch {
      setHasFailed(true);
      return undefined;
    }
  }, [adGroupId, readyState]);

  if (readyState !== 'ready' || hasFailed) return null;

  return <div ref={containerRef} className="banner-ad" />;
}
