import { useMemo, useState } from 'react';
import { searchRegions, type RegionOption } from '../utils/grid';
import { saveSelectedRegion } from '../storage/selectedRegion';
import './Onboarding.css';

interface OnboardingProps {
  onComplete: () => void;
}

/**
 * 동네 설정 — 배출일 앱과 같은 흐름(검색 → 목록에서 선택 → CTA).
 * 동 목록은 앱에 내장된 기상청 격자 매핑표에서 찾으므로 네트워크 호출이 없다.
 */
export default function Onboarding({ onComplete }: OnboardingProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<RegionOption | null>(null);

  const trimmed = query.trim();
  const options = useMemo(() => searchRegions(trimmed), [trimmed]);
  const showEmptyState = trimmed.length > 0 && options.length === 0;

  const handleSubmit = () => {
    if (!selected) return;
    saveSelectedRegion(selected);
    onComplete();
  };

  return (
    <main className="onboarding">
      <h1 className="onboarding-title">동네를 설정해주세요</h1>
      <p className="onboarding-subtitle">우리 동네 날씨로 빨래·이불·세차하기 좋은 날을 알려드려요</p>

      <label className="onboarding-field-label" htmlFor="dong-search">
        동네 검색
      </label>
      <input
        id="dong-search"
        className="onboarding-search"
        type="text"
        placeholder="동 이름이나 시/군/구를 검색해보세요"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
        }}
      />

      {showEmptyState && (
        <div className="onboarding-empty">
          <SearchEmptyIcon />
          <p className="onboarding-empty-title">검색 결과가 없어요</p>
          <p className="onboarding-empty-sub">예) 역삼동, 해운대구, 제주시 노형</p>
        </div>
      )}

      <ul className="onboarding-list">
        {options.map((option) => {
          const isSelected = selected?.code === option.code;
          return (
            <li key={option.code}>
              <button
                type="button"
                className={`onboarding-option${isSelected ? ' is-selected' : ''}`}
                onClick={() => setSelected(option)}
              >
                <span>{option.label}</span>
                {isSelected && <CheckIcon />}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="onboarding-spacer" />

      <button type="button" className="onboarding-cta" disabled={!selected} onClick={handleSubmit}>
        이 동네로 설정하기
      </button>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10.5l3.5 3.5L16 5" stroke="#3182F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchEmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="21" cy="21" r="13" stroke="#8B95A1" strokeWidth="2" />
      <path d="M30.5 30.5L40 40" stroke="#8B95A1" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 21h8" stroke="#8B95A1" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
