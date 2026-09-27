import type { DayInfo } from '../lib/calendar';
import { formatRange, parts, weekdayLabel } from '../lib/date';

interface CalendarStripProps {
  days: DayInfo[];
  leaveDates: string[];
}

/** 쉬는 구간을 가로 한 줄로: 블루 = 연차 쓸 날, 그레이 = 원래 쉬는 날(주말·공휴일, 공휴일은 점 표시) */
export default function CalendarStrip({ days, leaveDates }: CalendarStripProps) {
  const leave = new Set(leaveDates);
  const label = `${formatRange(days[0].date, days[days.length - 1].date)}, 연차 ${leaveDates.length}일 포함`;
  return (
    <div className="strip" role="img" aria-label={label}>
      {days.map((day, index) => {
        const { m, d } = parts(day.date);
        const showMonth = index === 0 || d === 1;
        const kind = leave.has(day.date) ? 'leave' : 'off';
        return (
          <div key={day.date} className={`strip-cell is-${kind}${day.holiday ? ' is-holiday' : ''}`}>
            <span className="strip-month">{showMonth ? `${m}월` : ''}</span>
            <span className="strip-box">
              <span className="strip-day">{d}</span>
              <span className="strip-dow">{weekdayLabel(day.date)}</span>
            </span>
            <span className="strip-dot" />
          </div>
        );
      })}
    </div>
  );
}

export function CalendarStripLegend() {
  return (
    <p className="strip-legend">
      <span className="strip-legend-swatch is-leave" /> 연차 쓸 날
      <span className="strip-legend-swatch is-off" /> 원래 쉬는 날
      <span className="strip-legend-dot" /> 공휴일
    </p>
  );
}
