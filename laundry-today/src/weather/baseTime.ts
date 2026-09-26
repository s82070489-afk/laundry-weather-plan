import { addDays, toKst } from './kst';

/** 단기예보 발표시각 (KST). 각 발표 후 약 10분 뒤부터 조회 가능. */
export const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23] as const;
export const AVAILABLE_AFTER_MINUTES = 10;

export interface BaseDateTime {
  /** YYYYMMDD */
  baseDate: string;
  /** HHMM */
  baseTime: string;
}

/**
 * 현재 시각 기준으로 조회 가능한 가장 최근 발표시각.
 * 예) 11:09 → 08시 발표, 11:10 → 11시 발표, 00:00~02:09 → 전날 23시 발표.
 */
export function getLatestBaseDateTime(now: Date): BaseDateTime {
  const { date, hour, minute } = toKst(now);
  const minutesOfDay = hour * 60 + minute;

  for (let i = BASE_HOURS.length - 1; i >= 0; i--) {
    const baseHour = BASE_HOURS[i];
    if (minutesOfDay >= baseHour * 60 + AVAILABLE_AFTER_MINUTES) {
      return { baseDate: date, baseTime: `${String(baseHour).padStart(2, '0')}00` };
    }
  }
  return { baseDate: addDays(date, -1), baseTime: '2300' };
}

export function baseKey({ baseDate, baseTime }: BaseDateTime): string {
  return `${baseDate}${baseTime}`;
}
