/** 기기 시간대와 무관하게 한국 표준시(UTC+9) 기준 날짜·시각을 다룬다. */
export interface KstParts {
  /** YYYYMMDD */
  date: string;
  hour: number;
  minute: number;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function toKst(now: Date): KstParts {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return { date: `${y}${m}${d}`, hour: kst.getUTCHours(), minute: kst.getUTCMinutes() };
}

/** YYYYMMDD에 days를 더한 YYYYMMDD */
export function addDays(yyyymmdd: string, days: number): string {
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6));
  const d = Number(yyyymmdd.slice(6, 8));
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('');
}
