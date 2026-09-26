import { useEffect, useState } from 'react';
import { TossAds } from '@apps-in-toss/web-framework';

export type TossAdsReadyState = 'initializing' | 'ready' | 'unsupported';

/**
 * TossAds.initialize()를 앱 생애주기에서 딱 한 번만 호출하고 완료를 기다린다
 * (모듈 레벨 Promise로 캐시 — 화면을 오가며 광고 컴포넌트가 반복 mount/unmount
 * 되어도 재호출하지 않는다).
 *
 * attachBanner 등 다른 TossAds 광고 API는 initialize가 완료되기 전에 호출하면
 * "SDK가 초기화되지 않았습니다"(code 1007) 에러로 조용히 실패한다 — 실제 실기기
 * 테스트에서 확인된 문제. 반드시 이 훅이 'ready'를 반환한 뒤에만 호출해야 한다.
 */
let initPromise: Promise<boolean> | null = null;

function ensureInitialized(): Promise<boolean> {
  if (!initPromise) {
    initPromise = new Promise((resolve) => {
      if (!TossAds.initialize.isSupported()) {
        resolve(false);
        return;
      }
      TossAds.initialize({
        callbacks: {
          onInitialized: () => resolve(true),
          onInitializationFailed: () => resolve(false),
        },
      });
    });
  }
  return initPromise;
}

export function useTossAdsReady(): TossAdsReadyState {
  const [state, setState] = useState<TossAdsReadyState>('initializing');

  useEffect(() => {
    let cancelled = false;
    ensureInitialized().then((ok) => {
      if (!cancelled) setState(ok ? 'ready' : 'unsupported');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
