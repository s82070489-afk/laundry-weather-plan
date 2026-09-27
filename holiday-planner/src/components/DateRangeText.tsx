import { formatMonthDay, yearOf } from '../lib/date';

/**
 * formatRange와 같은 표기를 날짜 단위로 줄바꿈되게("10월 3일(토) ~" / "10월 5일(월)") 그린다.
 * baseYear(올해)와 다른 해면 연도를 붙인다.
 */
export default function DateRangeText({ start, end, baseYear }: { start: string; end: string; baseYear: number }) {
  const startLabel = <span className="nowrap">{formatMonthDay(start, baseYear)}</span>;
  if (start === end) return startLabel;
  return (
    <>
      {startLabel} ~ <span className="nowrap">{formatMonthDay(end, yearOf(start))}</span>
    </>
  );
}
