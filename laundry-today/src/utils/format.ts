const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** 20260926 → "9월 26일 (토)" */
export function formatDateLabel(yyyymmdd: string): string {
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6));
  const d = Number(yyyymmdd.slice(6, 8));
  const dow = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${dow})`;
}

/** 발표시각 표기: "9월 26일 11시 발표" */
export function formatBaseLabel(baseDate: string, baseTime: string): string {
  return `${formatDateLabel(baseDate).replace(/ \(.\)$/, '')} ${Number(baseTime.slice(0, 2))}시 발표`;
}

/** 기준일 대비 상대 표현 */
export function relativeDayLabel(date: string, today: string, addDays: (d: string, n: number) => string): string {
  if (date === today) return '오늘';
  if (date === addDays(today, 1)) return '내일';
  if (date === addDays(today, 2)) return '모레';
  if (date === addDays(today, 3)) return '글피';
  return formatDateLabel(date);
}
