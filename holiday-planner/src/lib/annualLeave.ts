import { daysInMonth, isValidDate, parts } from './date';

const pad = (n: number) => String(n).padStart(2, '0');

/** 가산휴가를 포함한 연차 한도 (근로기준법 제60조 ④) */
export const MAX_ANNUAL_LEAVE = 25;
/** 1년 미만 근로자: 1개월 개근마다 1일, 최대 11일 (제60조 ②) */
export const FIRST_YEAR_MAX = 11;

/** 근속 n년(n≥1)일 때 연차: 15일 + 최초 1년을 넘는 근속 2년마다 1일, 최대 25일 (제60조 ①·④) */
export function leaveDaysForYears(years: number): number {
  return Math.min(MAX_ANNUAL_LEAVE, 15 + Math.floor((years - 1) / 2));
}

/**
 * 입사일부터 n개월을 다 채운 다음 날 = 개근 시 그만큼의 연차가 생기는 날.
 * 민법 제160조: 기간은 마지막 달에서 기산일에 해당하는 날의 전날에 끝나고, 해당일이 없으면 그 달 말일에 끝난다.
 *   → 해당일이 있으면 그날, 없으면 다음 달 1일
 * 예) 3/2 입사 → 1개월 4/2, 1/31 입사 → 1개월 3/1 (2/28에 기간 만료), 2/29 입사 → 1년 다음 해 3/1
 * (JS Date로 1/31에 한 달을 더하면 3/3이 되는 문제를 피한다)
 */
export function accrualDate(hireDate: string, months: number): string {
  const { y, m, d } = parts(hireDate);
  const index = m - 1 + months;
  const ty = y + Math.floor(index / 12);
  const tm = (index % 12) + 1;
  if (d <= daysInMonth(ty, tm)) return `${ty}-${pad(tm)}-${pad(d)}`;
  return tm === 12 ? `${ty + 1}-01-01` : `${ty}-${pad(tm + 1)}-01`;
}

/** 입사일부터 today까지 다 채운 개월 수 */
export function completedMonths(hireDate: string, today: string): number {
  if (today < hireDate) return 0;
  const h = parts(hireDate);
  const t = parts(today);
  let months = (t.y - h.y) * 12 + (t.m - h.m);
  while (months > 0 && accrualDate(hireDate, months) > today) months--;
  while (accrualDate(hireDate, months + 1) <= today) months++;
  return months;
}

export interface AnnualLeave {
  /** 다 채운 근속 개월 수 (전체) */
  months: number;
  /** 다 채운 근속 연수 */
  years: number;
  /** 오늘 기준 발생 연차(일). 1년 미만은 1개월 개근마다 1일(최대 11일), 1년 이상은 그해 발생분 */
  days: number;
  /** 다음에 늘어나는 날과 늘어난 뒤 개수. 25일 한도에 닿았으면 null */
  next: { date: string; days: number } | null;
}

/**
 * 입사일 기준 연차 (출근율 80% 이상 가정, 참고용).
 *   - 근속 1년 미만: 다 채운 개월 수 (최대 11)
 *   - 근속 n년(n≥1): min(25, 15 + floor((n - 1) / 2))
 * 입사일이 형식에 안 맞거나 오늘보다 뒤면 null.
 */
export function calculateAnnualLeave(hireDate: string, today: string): AnnualLeave | null {
  if (!isValidDate(hireDate) || !isValidDate(today) || hireDate > today) return null;
  const months = completedMonths(hireDate, today);
  const years = Math.floor(months / 12);

  if (years < 1) {
    const days = Math.min(FIRST_YEAR_MAX, months);
    const next =
      months < FIRST_YEAR_MAX
        ? { date: accrualDate(hireDate, months + 1), days: months + 1 }
        : { date: accrualDate(hireDate, 12), days: leaveDaysForYears(1) };
    return { months, years, days, next };
  }

  const days = leaveDaysForYears(years);
  let next: AnnualLeave['next'] = null;
  for (let n = years + 1; days < MAX_ANNUAL_LEAVE && !next; n++) {
    if (leaveDaysForYears(n) > days) next = { date: accrualDate(hireDate, n * 12), days: leaveDaysForYears(n) };
  }
  return { months, years, days, next };
}
