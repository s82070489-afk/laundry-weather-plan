import { plannerConfig, type PlannerConfig } from '../config/planner';
import { buildCalendar, uniqueHolidayNames, type DayInfo } from './calendar';
import { addDays, yearOf } from './date';
import type { Holiday } from './holidays';

export interface RecommendInput {
  /** 오늘 (KST, YYYY-MM-DD) */
  today: string;
  /** 올해(+ 발표됐으면 내년) 공휴일 */
  holidays: readonly Holiday[];
  /** 내년 공휴일이 발표돼 있으면 내년 12/31까지, 아니면 올해 12/31까지만 본다 (주말만으로 계산하지 않음) */
  nextYearAvailable: boolean;
  /** 쓸 연차 개수 (탭) */
  leaveCount: number;
}

export interface Recommendation {
  /** 쉬는 구간 첫날·마지막 날 (YYYY-MM-DD) */
  start: string;
  end: string;
  totalDays: number;
  /** 연차 쓸 날 = 구간 안의 근무일 */
  leaveDates: string[];
  /** 구간 안 공휴일 날짜 수 (주말과 겹친 공휴일도 1) */
  holidayCount: number;
  /** 구간 안 공휴일 이름 (표기용) */
  holidayNames: string[];
  /** 구간의 날짜들 (미니 캘린더용) */
  days: DayInfo[];
}

/** 추천 범위 마지막 날: 내년 공휴일이 있으면 내년 12/31, 없으면 올해 12/31 */
export function planRangeEnd(today: string, nextYearAvailable: boolean): string {
  return `${yearOf(today) + (nextYearAvailable ? 1 : 0)}-12-31`;
}

/**
 * 근무일이 정확히 leaveCount개 들어 있는 최대 연속 구간을 모두 구한다.
 * 연속한 근무일 leaveCount개를 연차로 쓰고, 구간 양 끝은 바로 앞·뒤 근무일 직전까지(쉬는 날만큼) 넓힌다.
 * (범위 끝에 닿은 구간은 범위에서 잘린다)
 */
export function findLeaveWindows(days: readonly DayInfo[], leaveCount: number): Recommendation[] {
  const workIdx = days.flatMap((d, i) => (d.off ? [] : [i]));
  const result: Recommendation[] = [];
  if (leaveCount < 1) return result;
  for (let i = 0; i + leaveCount <= workIdx.length; i++) {
    const startIdx = i === 0 ? 0 : workIdx[i - 1] + 1;
    const endIdx = i + leaveCount === workIdx.length ? days.length - 1 : workIdx[i + leaveCount] - 1;
    const span = days.slice(startIdx, endIdx + 1);
    result.push({
      start: span[0].date,
      end: span[span.length - 1].date,
      totalDays: span.length,
      leaveDates: workIdx.slice(i, i + leaveCount).map((idx) => days[idx].date),
      holidayCount: span.filter((d) => d.holiday).length,
      holidayNames: uniqueHolidayNames(span),
      days: span,
    });
  }
  return result;
}

/** 연차 쓸 날짜 집합이 같은 추천은 하나만 (처음 것) */
export function dedupeByLeaveDates(list: readonly Recommendation[]): Recommendation[] {
  const seen = new Set<string>();
  return list.filter((r) => {
    const key = [...r.leaveDates].sort().join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 총 일수 많은 순 → 공휴일 많이 낀 순 → 가까운 날짜 순 */
export function compareRecommendations(a: Recommendation, b: Recommendation): number {
  return (
    b.totalDays - a.totalDays ||
    b.holidayCount - a.holidayCount ||
    a.start.localeCompare(b.start) ||
    a.leaveDates[0].localeCompare(b.leaveDates[0])
  );
}

/**
 * 연차 leaveCount개로 가장 길게 쉴 수 있는 구간 추천.
 *   1) 오늘+1일 ~ planRangeEnd 날짜마다 쉬는 날/근무일 표시
 *   2) 근무일이 정확히 leaveCount개인 최대 연속 구간을 모두 구함 → 구간 안 근무일 = 연차 쓸 날
 *   3) 총 일수 < minTotalDays, 연차 쓸 날이 오늘 이전(오늘 포함)인 것, 쉬는 날이 하나도 없는 것(연차만으로 채운 구간) 제외
 *   4) 연차 쓸 날짜 집합 중복 제거 → 정렬 → 상위 resultsPerTab개
 */
export function recommend(input: RecommendInput, config: PlannerConfig = plannerConfig): Recommendation[] {
  const { today, holidays, nextYearAvailable, leaveCount } = input;
  const from = addDays(today, 1);
  const to = planRangeEnd(today, nextYearAvailable);
  if (from > to) return [];

  const days = buildCalendar(from, to, holidays, config.weekendDays);
  const candidates = findLeaveWindows(days, leaveCount).filter(
    (r) => r.totalDays >= config.minTotalDays && r.leaveDates.every((d) => d > today) && r.totalDays > r.leaveDates.length,
  );
  return dedupeByLeaveDates(candidates).sort(compareRecommendations).slice(0, config.resultsPerTab);
}

/** "연차 1개당 5일" 표기용 숫자: 정수면 그대로, 아니면 소수 첫째 자리 */
export function daysPerLeave(r: Pick<Recommendation, 'totalDays' | 'leaveDates'>): string {
  const value = r.totalDays / r.leaveDates.length;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
