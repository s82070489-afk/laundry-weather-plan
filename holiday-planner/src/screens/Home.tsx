import { useMemo } from 'react';
import AppFooter from '../components/AppFooter';
import DateRangeText from '../components/DateRangeText';
import LoadError from '../components/LoadError';
import StatusNotices from '../components/StatusNotices';
import type { HolidaysState } from '../hooks/useHolidays';
import {
  buildCalendar,
  findHolidayPeriods,
  holidayRows,
  periodsAround,
  type HolidayPeriod,
  type HolidayRow,
} from '../lib/calendar';
import { addDays, diffDays, formatMonthDay, parts, weekdayLabel, yearOf } from '../lib/date';
import { planRangeEnd } from '../lib/recommend';
import './Home.css';

interface HomeProps {
  today: string;
  holidays: HolidaysState;
  onReload: () => void;
}

export default function Home({ today, holidays, onReload }: HomeProps) {
  return (
    <main className="screen home-screen">
      <header className="home-header">
        <p className="home-today">오늘 {formatMonthDay(today)}</p>
      </header>

      {holidays.status === 'loading' && <p className="status-text">공휴일 정보를 불러오는 중이에요...</p>}
      {holidays.status === 'error' && <LoadError onRetry={onReload} />}
      {holidays.status === 'ready' && <HomeContent today={today} holidays={holidays} />}

      <AppFooter />
    </main>
  );
}

function HomeContent({ today, holidays }: { today: string; holidays: Extract<HolidaysState, { status: 'ready' }> }) {
  const { thisYear, nextYear, nextYearStatus, stale } = holidays;
  const yearEnd = `${yearOf(today)}-12-31`;

  const { current, next, rows } = useMemo(() => {
    const all = [...thisYear.holidays, ...(nextYear?.holidays ?? [])];
    // 오늘이 연휴 중이면 그 연휴의 시작일을 찾을 수 있게 2주 앞부터
    const days = buildCalendar(addDays(today, -14), planRangeEnd(today, nextYearStatus === 'available'), all);
    return { ...periodsAround(findHolidayPeriods(days), today), rows: holidayRows(days, today, yearEnd) };
  }, [thisYear, nextYear, nextYearStatus, today, yearEnd]);

  return (
    <>
      <StatusNotices stale={stale} />

      <section className="card home-hero" aria-label={current ? '지금 연휴' : '다음 연휴'}>
        {current ? (
          <CurrentPeriod today={today} period={current} next={next} />
        ) : next ? (
          <NextPeriod today={today} period={next} />
        ) : (
          <>
            <p className="home-hero-label">다음 연휴</p>
            <p className="home-hero-empty">올해 남은 연휴가 없어요</p>
            {nextYearStatus !== 'available' && (
              <p className="home-hero-sub">
                {nextYearStatus === 'pending' ? '내년 공휴일은 아직 발표 전이에요' : '내년 공휴일 정보를 불러오지 못했어요'}
              </p>
            )}
          </>
        )}
      </section>

      <section className="card home-section">
        <h2 className="section-title">
          올해 남은 공휴일 {rows.length > 0 && <span className="section-title-sub">{countDays(rows)}일</span>}
        </h2>
        {rows.length === 0 ? (
          <p className="home-empty">올해 남은 공휴일이 없어요</p>
        ) : (
          <ul className="holiday-list">
            {rows.map((row) => (
              <li key={row.start} className="holiday-row">
                <span className="holiday-row-date">{formatRowDate(row)}</span>
                <span className="holiday-row-name">
                  <span>{row.name}</span>
                  {row.substitute && <span className="badge">대체</span>}
                </span>
                <span className="holiday-row-dday">{ddayLabel(diffDays(today, row.start))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function CurrentPeriod({ today, period, next }: { today: string; period: HolidayPeriod; next: HolidayPeriod | null }) {
  const remaining = diffDays(today, period.end) + 1;
  return (
    <>
      <p className="home-hero-label">지금 연휴 중이에요</p>
      <p className="home-hero-big">{remaining === 1 ? '오늘이 마지막 날' : `${remaining}일 남음`}</p>
      {remaining > 1 && <p className="home-hero-caption">오늘 포함</p>}
      <p className="home-hero-period">
        <DateRangeText start={period.start} end={period.end} baseYear={yearOf(today)} /> · 총 {period.totalDays}일
      </p>
      <HolidayChips names={period.holidayNames} />
      {next && (
        <p className="home-hero-next">
          다음 연휴 {formatMonthDay(next.start, yearOf(today))}부터 {next.totalDays}일 · {ddayLabel(diffDays(today, next.start))}
        </p>
      )}
    </>
  );
}

function NextPeriod({ today, period }: { today: string; period: HolidayPeriod }) {
  return (
    <>
      <p className="home-hero-label">다음 연휴까지</p>
      <p className="home-hero-big">{ddayLabel(diffDays(today, period.start))}</p>
      <p className="home-hero-period">
        <DateRangeText start={period.start} end={period.end} baseYear={yearOf(today)} />
      </p>
      <p className="home-hero-total">
        {period.totalDays === 1 ? (
          <>
            <strong>하루</strong> 쉬어요
          </>
        ) : (
          <>
            <strong>{period.totalDays}일</strong> 연속 쉬어요
          </>
        )}
      </p>
      <HolidayChips names={period.holidayNames} />
    </>
  );
}

function HolidayChips({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <p className="chips">
      {names.map((name) => (
        <span key={name} className="chip">
          {name}
        </span>
      ))}
    </p>
  );
}

function ddayLabel(days: number): string {
  return days === 0 ? '오늘' : `D-${days}`;
}

function countDays(rows: HolidayRow[]): number {
  return rows.reduce((sum, row) => sum + diffDays(row.start, row.end) + 1, 0);
}

/** "10월 3일(토)", 이어지면 "9월 24일(목) ~ 26일(토)" */
function formatRowDate(row: HolidayRow): string {
  if (row.start === row.end) return formatMonthDay(row.start);
  const sameMonth = row.start.slice(0, 7) === row.end.slice(0, 7);
  return `${formatMonthDay(row.start)} ~ ${sameMonth ? `${parts(row.end).d}일(${weekdayLabel(row.end)})` : formatMonthDay(row.end)}`;
}
