export type Tab = 'home' | 'recommend' | 'leave';

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: '홈' },
  { id: 'recommend', label: '연차 추천' },
  { id: 'leave', label: '내 연차' },
];

interface TabBarProps {
  current: Tab;
  onChange: (tab: Tab) => void;
}

/** 하단 탭 3개. 뒤로가기 버튼은 그리지 않는다(토스 내비게이션 바에 맡김) */
export default function TabBar({ current, onChange }: TabBarProps) {
  return (
    <nav className="tab-bar" aria-label="메뉴">
      {TABS.map((tab) => {
        const active = tab.id === current;
        return (
          <button
            key={tab.id}
            type="button"
            className={`tab-bar-item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(tab.id)}
          >
            <TabIcon tab={tab.id} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function TabIcon({ tab }: { tab: Tab }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true } as const;
  const stroke = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  if (tab === 'home') {
    return (
      <svg {...common}>
        <path d="M4 10.2L12 4l8 6.2V19a1 1 0 01-1 1h-4.5v-5.5h-5V20H5a1 1 0 01-1-1v-8.8z" {...stroke} />
      </svg>
    );
  }
  if (tab === 'recommend') {
    return (
      <svg {...common}>
        <rect x="4" y="5.5" width="16" height="14.5" rx="2" {...stroke} />
        <path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" {...stroke} />
        <path d="M9 14.8l2 2 4-4" {...stroke} />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="8.5" r="3.5" {...stroke} />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" {...stroke} />
    </svg>
  );
}
