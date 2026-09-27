import { NEXT_YEAR_FAILED_TEXT, NEXT_YEAR_PENDING_TEXT, STALE_NOTICE_TEXT } from '../config/app';
import type { NextYearStatus } from '../hooks/useHolidays';

/** 이전 데이터로 보여주는 중(STALE)·내년 공휴일 미발표/실패 안내 */
export default function StatusNotices({ stale, nextYearStatus, detail }: { stale: boolean; nextYearStatus?: NextYearStatus; detail?: string }) {
  const nextYearText =
    nextYearStatus === 'pending' ? NEXT_YEAR_PENDING_TEXT : nextYearStatus === 'failed' ? NEXT_YEAR_FAILED_TEXT : null;
  return (
    <>
      {stale && <p className="stale-notice">{STALE_NOTICE_TEXT}</p>}
      {nextYearText && (
        <p className="info-notice">
          {nextYearText}
          {detail && <span className="info-notice-sub">{detail}</span>}
        </p>
      )}
    </>
  );
}
