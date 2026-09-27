import { useState } from 'react';
import { ANNUAL_LEAVE_NOTICE_TEXT, LABOR_LAW_ARTICLE_60_URL } from '../config/app';
import { calculateAnnualLeave, MAX_ANNUAL_LEAVE, type AnnualLeave } from '../lib/annualLeave';
import { formatYmd, isValidDate } from '../lib/date';
import { loadHireDate, saveHireDate } from '../storage/hireDate';
import { openExternal } from '../utils/openExternal';
import './MyLeave.css';

export default function MyLeave({ today }: { today: string }) {
  const [hireDate, setHireDate] = useState<string | null>(() => loadHireDate());
  const result = hireDate ? calculateAnnualLeave(hireDate, today) : null;

  const handleChange = (value: string) => {
    const next = isValidDate(value) ? value : null;
    setHireDate(next);
    saveHireDate(next);
  };

  return (
    <main className="screen leave-screen">
      <h1 className="screen-title">내 연차</h1>
      <p className="screen-subtitle">입사일을 넣으면 오늘 기준으로 생긴 연차를 계산해 드려요</p>

      <label className="field-label" htmlFor="hire-date">
        입사일
      </label>
      <input
        id="hire-date"
        className="date-input"
        type="date"
        value={hireDate ?? ''}
        max={today}
        onChange={(e) => handleChange(e.target.value)}
      />
      {hireDate && !result && <p className="field-error">입사일은 오늘이나 그 전 날짜로 넣어주세요</p>}
      {/* 안드로이드 날짜 선택기에는 지우기 버튼이 없어서 따로 둔다 (입사일은 기기에만 저장) */}
      {hireDate && (
        <button type="button" className="text-link leave-clear" onClick={() => handleChange('')}>
          입사일 지우기
        </button>
      )}

      {result && hireDate && <LeaveResult result={result} />}

      <section className="leave-notice">
        <p>{ANNUAL_LEAVE_NOTICE_TEXT}</p>
        <button type="button" className="text-link" onClick={() => openExternal(LABOR_LAW_ARTICLE_60_URL)}>
          근로기준법 제60조 보기 ›
        </button>
      </section>
    </main>
  );
}

function LeaveResult({ result }: { result: AnnualLeave }) {
  const { years, months, days, next } = result;
  const tenure = years === 0 ? `${months}개월` : `${years}년 ${months % 12}개월`;
  return (
    <section className="card leave-card" aria-live="polite">
      <p className="leave-label">오늘 기준 발생 연차</p>
      <p className="leave-days">
        <strong>{days}</strong>일
      </p>
      <p className="leave-tenure">
        근속 {tenure} ·{' '}
        {years === 0 ? '1년 미만은 1개월 개근마다 1일씩 생겨요 (최대 11일)' : `1년 이상은 해마다 ${days}일이 생겨요`}
      </p>
      <div className="leave-next">
        {next ? (
          <>
            <span className="leave-next-label">다음 증가</span>
            <span>
              <strong>{formatYmd(next.date)}</strong>부터 <strong>{next.days}일</strong>
              {years === 0 && next.days > 11 ? ' (입사 1년)' : ''}
            </span>
          </>
        ) : (
          <span>법정 최대인 {MAX_ANNUAL_LEAVE}일이에요</span>
        )}
      </div>
    </section>
  );
}
