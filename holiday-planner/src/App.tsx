import { useCallback, useEffect, useState } from 'react';
import { Screen, graniteEvent } from '@apps-in-toss/web-framework';
import TabBar, { type Tab } from './components/TabBar';
import { useHolidays } from './hooks/useHolidays';
import { todayKst, yearOf } from './lib/date';
import Home from './screens/Home';
import MyLeave from './screens/MyLeave';
import Recommend from './screens/Recommend';

function App() {
  // 날짜는 렌더마다 KST로 다시 계산한다 (웹뷰를 살려둔 채 다음 날 다시 여는 경우)
  const today = todayKst();
  const { state: holidays, reload } = useHolidays(yearOf(today));
  const [tab, setTab] = useState<Tab>('home');

  const switchTab = useCallback((next: Tab) => {
    setTab(next);
    window.scrollTo(0, 0);
  }, []);

  // 화면에 다시 보일 때마다 공휴일을 확인한다(기기 캐시가 신선하면 네트워크 호출 없음). 날짜도 이때 다시 잡힌다.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [reload]);

  // 앱 자체 헤더/뒤로가기 버튼은 그리지 않는다(배출일 앱 심사 반려 사례) — 토스 내비게이션 바(시스템)
  // 뒤로가기(graniteEvent.backEvent)를 받아 홈이 아닌 탭이면 홈 탭으로, 홈이면 Screen.close()로 미니앱을 닫는다.
  // 화면이 탭 세 개뿐이라 브라우저 히스토리는 쌓지 않는다.
  // 웹뷰 환경이 아니면(로컬 브라우저 등) 구독 자체가 동기적으로 throw하므로 무시한다.
  useEffect(() => {
    try {
      return graniteEvent.addEventListener('backEvent', {
        onEvent: () => {
          if (tab !== 'home') {
            switchTab('home');
          } else {
            Screen.close().catch(() => {});
          }
        },
      });
    } catch {
      return undefined;
    }
  }, [tab, switchTab]);

  return (
    <>
      {tab === 'home' && <Home today={today} holidays={holidays} onReload={reload} />}
      {tab === 'recommend' && <Recommend today={today} holidays={holidays} onReload={reload} />}
      {tab === 'leave' && <MyLeave today={today} />}
      <TabBar current={tab} onChange={switchTab} />
    </>
  );
}

export default App;
