import { useCallback, useEffect, useState } from 'react';
import { getForecast } from '../weather/forecastApi';
import type { ForecastData } from '../weather/types';

export type ForecastState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ForecastData; stale: boolean };

const LOADING: ForecastState = { status: 'loading' };

/** grid가 null이면(동네 미설정) 아무것도 부르지 않는다 */
export function useForecast(grid: { nx: number; ny: number } | null): { state: ForecastState; reload: () => void } {
  const nx = grid?.nx;
  const ny = grid?.ny;
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${nx},${ny},${attempt}`;
  // 동네를 바꾸거나 다시 불러오면 이전 결과를 보여주지 않도록 요청 키와 함께 저장한다
  const [result, setResult] = useState<{ key: string; state: ForecastState } | null>(null);

  useEffect(() => {
    if (nx === undefined || ny === undefined) return;
    let cancelled = false;
    const key = `${nx},${ny},${attempt}`;
    getForecast(nx, ny)
      .then(({ data, stale }) => !cancelled && setResult({ key, state: { status: 'ready', data, stale } }))
      .catch(() => !cancelled && setResult({ key, state: { status: 'error', message: '예보를 불러오지 못했어요' } }));
    return () => {
      cancelled = true;
    };
  }, [nx, ny, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { state: result?.key === requestKey ? result.state : LOADING, reload };
}
