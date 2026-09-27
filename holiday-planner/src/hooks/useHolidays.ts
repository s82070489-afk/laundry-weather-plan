import { useCallback, useEffect, useState } from 'react';
import { getHolidays } from '../lib/holidayApi';
import type { HolidayYear } from '../lib/holidays';

/** 내년 공휴일: 발표돼서 있음 / 아직 발표 전(0건) / 불러오기 실패 */
export type NextYearStatus = 'available' | 'pending' | 'failed';

export type HolidaysState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      thisYear: HolidayYear;
      /** nextYearStatus가 'available'일 때만 있음 */
      nextYear: HolidayYear | null;
      nextYearStatus: NextYearStatus;
      /** 최신 데이터를 못 받아 이전 데이터를 보여주는 중 */
      stale: boolean;
    };

const LOADING: HolidaysState = { status: 'loading' };

/**
 * 올해·내년 공휴일을 함께 불러온다. 올해가 실패하거나 비어 있으면 error(재시도),
 * 내년은 실패해도 올해만으로 계산한다. reload 중에는 같은 연도의 이전 결과를 계속 보여준다.
 */
export function useHolidays(year: number): { state: HolidaysState; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${year},${attempt}`;
  const [result, setResult] = useState<{ key: string; year: number; state: HolidaysState } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = `${year},${attempt}`;
    Promise.allSettled([getHolidays(year), getHolidays(year + 1)]).then(([current, next]) => {
      if (cancelled) return;
      // 올해 공휴일이 0건인 건 정상이 아니다 — 주말만으로 계산하지 않고 에러로 보여준다
      if (current.status === 'rejected' || current.value.data.holidays.length === 0) {
        setResult({ key, year, state: { status: 'error' } });
        return;
      }
      const nextValue = next.status === 'fulfilled' ? next.value : null;
      const nextYearStatus: NextYearStatus = !nextValue ? 'failed' : nextValue.data.holidays.length > 0 ? 'available' : 'pending';
      setResult({
        key,
        year,
        state: {
          status: 'ready',
          thisYear: current.value.data,
          nextYear: nextYearStatus === 'available' && nextValue ? nextValue.data : null,
          nextYearStatus,
          stale: current.value.stale || (nextYearStatus === 'available' && !!nextValue?.stale),
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [year, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  if (result?.key === requestKey) return { state: result.state, reload };
  const previous = result?.year === year && result.state.status === 'ready' ? result.state : null;
  return { state: previous ?? LOADING, reload };
}
