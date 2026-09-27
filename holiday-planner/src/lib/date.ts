/**
 * 날짜는 전부 한국 표준시(KST) 기준 "YYYY-MM-DD" 문자열로 다룬다.
 * 기기 시간대와 무관하게 계산하려고 Date는 UTC 자정으로만 만들고(getUTC*), 비교는 문자열로 한다.
 * (zero-padding된 YYYY-MM-DD는 문자열 비교 = 날짜 비교)
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fromUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function parts(date: string): { y: number; m: number; d: number } {
  return { y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)), d: Number(date.slice(8, 10)) };
}

function toUtcMs(date: string): number {
  const { y, m, d } = parts(date);
  return Date.UTC(y, m - 1, d);
}

/** 실제로 있는 날짜인 YYYY-MM-DD인지 (2026-02-30 같은 값은 false) */
export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  return fromUtc(new Date(toUtcMs(value))) === value;
}

/** 지금(기본값: 현재 시각)의 KST 날짜 */
export function todayKst(now: Date = new Date()): string {
  return fromUtc(new Date(now.getTime() + KST_OFFSET_MS));
}

export function addDays(date: string, days: number): string {
  const { y, m, d } = parts(date);
  return fromUtc(new Date(Date.UTC(y, m - 1, d + days)));
}

/** b - a (일). 같은 날이면 0 */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

/** 0 = 일요일 … 6 = 토요일 */
export function dayOfWeek(date: string): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/** "10월 2일(금)". baseYear(보통 올해)와 다른 해면 "2027년 9월 10일(금)" */
export function formatMonthDay(date: string, baseYear?: number): string {
  const { y, m, d } = parts(date);
  const year = baseYear !== undefined && y !== baseYear ? `${y}년 ` : '';
  return `${year}${m}월 ${d}일(${DOW[dayOfWeek(date)]})`;
}

/** "10/2(금)" */
export function formatShort(date: string): string {
  const { m, d } = parts(date);
  return `${m}/${d}(${DOW[dayOfWeek(date)]})`;
}

/** "2027년 3월 2일" */
export function formatYmd(date: string): string {
  const { y, m, d } = parts(date);
  return `${y}년 ${m}월 ${d}일`;
}

/**
 * "10월 3일(토) ~ 10월 5일(월)", 같은 날이면 "10월 3일(토)".
 * 시작이 baseYear와 다른 해면 시작에, 끝이 시작과 다른 해면 끝에 연도를 붙인다
 * ("2027년 9월 10일(금) ~ 9월 19일(일)", "12월 29일(화) ~ 2027년 1월 3일(일)")
 */
export function formatRange(start: string, end: string, baseYear?: number): string {
  const startLabel = formatMonthDay(start, baseYear);
  return start === end ? startLabel : `${startLabel} ~ ${formatMonthDay(end, yearOf(start))}`;
}

export function weekdayLabel(date: string): string {
  return DOW[dayOfWeek(date)];
}
