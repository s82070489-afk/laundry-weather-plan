import { useCallback, useEffect, useState } from 'react';
import { Screen, graniteEvent } from '@apps-in-toss/web-framework';
import TabBar, { type Tab } from './components/TabBar';
import { useHolidays } from './hooks/useHolidays';
import { todayKst, yearOf } from './lib/date';
import Home from './screens/Home';
import MyLeave from './screens/MyLeave';
import Recommend from './screens/Recommend';
import Settings from './screens/Settings';
import { loadSettings, saveSettings, type PlannerSettings } from './storage/settings';

type ScreenName = 'tabs' | 'settings';

interface NavigationState {
  screen: ScreenName;
  tab: Tab;
}

const HOME: NavigationState = { screen: 'tabs', tab: 'home' };

function isNavigationState(value: unknown): value is NavigationState {
  const v = value as NavigationState | null;
  return (v?.screen === 'tabs' || v?.screen === 'settings') && (v.tab === 'home' || v.tab === 'recommend' || v.tab === 'leave');
}

function App() {
  // 날짜는 렌더마다 KST로 다시 계산한다 (웹뷰를 살려둔 채 다음 날 다시 여는 경우)
  const today = todayKst();
  const { state: holidays, reload } = useHolidays(yearOf(today));
  const [settings, setSettings] = useState<PlannerSettings>(() => loadSettings());
  const [nav, setNav] = useState<NavigationState>(() => {
    window.history.replaceState(HOME, '', '');
    return HOME;
  });

  // 탭 전환은 히스토리를 쌓지 않는다(replace). 설정만 push해서 뒤로가기로 돌아온다.
  const switchTab = useCallback((tab: Tab) => {
    const next: NavigationState = { screen: 'tabs', tab };
    window.history.replaceState(next, '', '');
    setNav(next);
    window.scrollTo(0, 0);
  }, []);

  const openSettings = () => {
    const next: NavigationState = { screen: 'settings', tab: nav.tab };
    window.history.pushState(next, '', '');
    setNav(next);
    window.scrollTo(0, 0);
  };

  // 화면에 다시 보일 때마다 공휴일을 확인한다(기기 캐시가 신선하면 네트워크 호출 없음). 날짜도 이때 다시 잡힌다.
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
      setNav(isNavigationState(event.state) ? event.state : HOME);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // graniteEvent.backEvent: 토스 내비게이션 바(시스템) 뒤로가기.
  // 설정 → history.back(), 홈이 아닌 탭 → 홈 탭, 홈 → Screen.close()로 미니앱 닫기.
  // 웹뷰 환경이 아니면(로컬 브라우저 등) 구독 자체가 동기적으로 throw하므로 무시한다.
  useEffect(() => {
    try {
      return graniteEvent.addEventListener('backEvent', {
        onEvent: () => {
          if (nav.screen === 'settings') {
            window.history.back();
          } else if (nav.tab !== 'home') {
            switchTab('home');
          } else {
            Screen.close().catch(() => {});
          }
        },
      });
    } catch {
      return undefined;
    }
  }, [nav, switchTab]);

  const changeSettings = (next: PlannerSettings) => {
    setSettings(next);
    saveSettings(next);
  };

  if (nav.screen === 'settings') {
    return <Settings settings={settings} onChange={changeSettings} />;
  }

  return (
    <>
      {nav.tab === 'home' && (
        <Home
          today={today}
          holidays={holidays}
          laborDayOff={settings.laborDayOff}
          onReload={reload}
          onOpenSettings={openSettings}
        />
      )}
      {nav.tab === 'recommend' && (
        <Recommend today={today} holidays={holidays} laborDayOff={settings.laborDayOff} onReload={reload} />
      )}
      {nav.tab === 'leave' && <MyLeave today={today} />}
      <TabBar current={nav.tab} onChange={switchTab} />
    </>
  );
}

export default App;
