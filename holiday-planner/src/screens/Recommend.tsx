import { useMemo, useState } from 'react';
import AppFooter from '../components/AppFooter';
import BannerAd from '../components/BannerAd';
import CalendarStrip, { CalendarStripLegend } from '../components/CalendarStrip';
import DateRangeText from '../components/DateRangeText';
import LoadError from '../components/LoadError';
import StatusNotices from '../components/StatusNotices';
import { BANNER_AD_GROUP_ID } from '../config/app';
import { plannerConfig } from '../config/planner';
import type { HolidaysState } from '../hooks/useHolidays';
import { formatShort, formatYmd, yearOf } from '../lib/date';
import { daysPerLeave, planRangeEnd, recommend, type Recommendation } from '../lib/recommend';
import './Recommend.css';

interface RecommendProps {
  today: string;
  holidays: HolidaysState;
  onReload: () => void;
}

const LEAVE_COUNTS = Array.from({ length: plannerConfig.maxLeaveDays }, (_, i) => i + 1);

export default function Recommend({ today, holidays, onReload }: RecommendProps) {
  const [leaveCount, setLeaveCount] = useState(1);

  return (
    <main className="screen recommend-screen">
      <h1 className="screen-title">연차 추천</h1>
      <p className="screen-subtitle">연차 몇 개로 가장 길게 쉴 수 있는지 골라 드려요</p>

      <div className="segmented" role="tablist" aria-label="쓸 연차 개수">
        {LEAVE_COUNTS.map((count) => (
          <button
            key={count}
            type="button"
            role="tab"
            aria-selected={count === leaveCount}
            className={`segmented-item${count === leaveCount ? ' is-active' : ''}`}
            onClick={() => setLeaveCount(count)}
          >
            연차 {count}개
          </button>
        ))}
      </div>

      {holidays.status === 'loading' && <p className="status-text">공휴일 정보를 불러오는 중이에요...</p>}
      {holidays.status === 'error' && <LoadError onRetry={onReload} />}
      {holidays.status === 'ready' && (
        <>
          <RecommendList today={today} holidays={holidays} leaveCount={leaveCount} />
          {/* 광고는 추천 결과 아래 배너 1개만 */}
          <BannerAd adGroupId={BANNER_AD_GROUP_ID} />
        </>
      )}

      <AppFooter />
    </main>
  );
}

function RecommendList({
  today,
  holidays,
  leaveCount,
}: {
  today: string;
  holidays: Extract<HolidaysState, { status: 'ready' }>;
  leaveCount: number;
}) {
  const { thisYear, nextYear, nextYearStatus, stale } = holidays;
  const nextYearAvailable = nextYearStatus === 'available';
  const results = useMemo(
    () =>
      recommend({
        today,
        holidays: [...thisYear.holidays, ...(nextYear?.holidays ?? [])],
        nextYearAvailable,
        leaveCount,
      }),
    [today, thisYear, nextYear, nextYearAvailable, leaveCount],
  );
  const rangeEnd = planRangeEnd(today, nextYearAvailable);

  return (
    <>
      <StatusNotices stale={stale} nextYearStatus={nextYearStatus} detail="올해 12월 31일까지만 추천해요" />
      <p className="recommend-range">내일부터 {formatYmd(rangeEnd)}까지 중에서 골랐어요</p>

      {results.length === 0 ? (
        <p className="recommend-empty card">추천할 만한 날이 없어요</p>
      ) : (
        <>
          <CalendarStripLegend />
          <ol className="recommend-list">
            {results.map((r) => (
              <RecommendationCard key={r.leaveDates.join()} recommendation={r} baseYear={yearOf(today)} />
            ))}
          </ol>
        </>
      )}
    </>
  );
}

/** baseYear(올해)와 다른 해의 구간은 연도를 붙여 보여준다 */
function RecommendationCard({ recommendation: r, baseYear }: { recommendation: Recommendation; baseYear: number }) {
  return (
    <li className="card rec-card">
      <div className="rec-top">
        <p className="rec-total">
          <strong>{r.totalDays}일</strong> 연속
        </p>
        <span className="rec-efficiency">연차 1개당 {daysPerLeave(r)}일</span>
      </div>
      <p className="rec-period">
        <DateRangeText start={r.start} end={r.end} baseYear={baseYear} />
      </p>
      {r.holidayNames.length > 0 && <p className="rec-holidays">{r.holidayNames.join(' · ')}</p>}
      <CalendarStrip days={r.days} leaveDates={r.leaveDates} />
      <p className="rec-leave">
        <span className="rec-leave-label">연차 쓸 날</span>
        <span>{r.leaveDates.map(formatShort).join(', ')}</span>
      </p>
    </li>
  );
}
