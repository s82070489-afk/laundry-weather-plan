import { useEffect, useState } from 'react';
import { Screen, graniteEvent } from '@apps-in-toss/web-framework';
import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import Detail from './screens/Detail';
import Settings from './screens/Settings';
import { useForecast } from './hooks/useForecast';
import type { Activity } from './scoring/judge';
import { loadSelectedRegion, type SelectedRegion } from './storage/selectedRegion';

type ScreenName = 'onboarding' | 'home' | 'detail' | 'settings';

interface NavigationState {
  screen: ScreenName;
}

function pushScreen(screen: ScreenName) {
  window.history.pushState({ screen } satisfies NavigationState, '', '');
}

function replaceScreen(screen: ScreenName) {
  window.history.replaceState({ screen } satisfies NavigationState, '', '');
}

function App() {
  const [region, setRegion] = useState<SelectedRegion | null>(() => loadSelectedRegion());
  const [screen, setScreen] = useState<ScreenName>(() => {
    const initial: ScreenName = loadSelectedRegion() ? 'home' : 'onboarding';
    replaceScreen(initial);
    return initial;
  });
  const [detail, setDetail] = useState<{ activity: Activity; date: string } | null>(null);
  const { state: forecast, reload } = useForecast(region);

  // 토스 앱이 웹뷰를 살려둔 채 다음 날 다시 열 수도 있어서, 화면에 다시 보일 때마다
  // 판정 기준 시각을 새로 잡고 예보를 확인한다(발표시각이 같으면 기기 캐시라 네트워크 호출 없음).
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [reload]);

  // 앱 자체 헤더/뒤로가기 버튼은 그리지 않는다(배출일 앱 심사 반려 사례) — 토스 내비게이션 바의
  // 뒤로가기에 맡기고, 화면 전환을 브라우저 히스토리와 동기화해 이전 화면으로 이어지게 한다.
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as NavigationState | null;
      setScreen(state?.screen ?? 'home');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // graniteEvent.backEvent: 토스 내비게이션 바(시스템) 뒤로가기. 홈(및 동네 미설정 온보딩)은
  // 최상위라 Screen.close()로 미니앱을 닫고, 그 외에는 history.back()으로 popstate를 일으킨다.
  // 웹뷰 환경이 아니면(로컬 브라우저 등) 구독 자체가 동기적으로 throw하므로 무시한다.
  useEffect(() => {
    const isRoot = screen === 'home' || (screen === 'onboarding' && !region);
    try {
      return graniteEvent.addEventListener('backEvent', {
        onEvent: () => {
          if (isRoot) {
            Screen.close().catch(() => {});
          } else {
            window.history.back();
          }
        },
      });
    } catch {
      return undefined;
    }
  }, [screen, region]);

  if (screen === 'onboarding' || !region) {
    return (
      <Onboarding
        onComplete={() => {
          setRegion(loadSelectedRegion());
          replaceScreen('home');
          setScreen('home');
        }}
      />
    );
  }

  if (screen === 'detail' && detail) {
    return <Detail activity={detail.activity} date={detail.date} forecast={forecast} />;
  }

  if (screen === 'settings') {
    return (
      <Settings
        region={region}
        onChangeRegion={() => {
          replaceScreen('onboarding');
          setScreen('onboarding');
        }}
        onSaved={() => window.history.back()}
      />
    );
  }

  return (
    <Home
      region={region}
      forecast={forecast}
      onReload={reload}
      onOpenDetail={(activity, date) => {
        setDetail({ activity, date });
        pushScreen('detail');
        setScreen('detail');
      }}
      onOpenSettings={() => {
        pushScreen('settings');
        setScreen('settings');
      }}
      onChangeRegion={() => {
        pushScreen('onboarding');
        setScreen('onboarding');
      }}
    />
  );
}

export default App;
