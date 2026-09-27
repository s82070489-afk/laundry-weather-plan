import { plannerConfig } from '../config/planner';
import { addDays, dayOfWeek } from './date';
import { displayHolidayName, isSubstituteName, type Holiday } from './holidays';

export interface DayInfo {
  /** YYYY-MM-DD */
  date: string;
  /** 0 = 일요일 */
  dow: number;
  weekend: boolean;
  /** 이날의 공휴일 이름 (API 원문, 노동절·"대체공휴일(개천절)" 등 그대로) */
  holidayNames: string[];
  /** 공휴일 */
  holiday: boolean;
  /** 쉬는 날 = 주말 또는 공휴일 */
  off: boolean;
}

/**
 * from~to(포함) 날짜마다 쉬는 날/근무일 표시.
 * 공휴일은 API 목록만 쓴다 — 노동절(5/1)도 API가 공휴일로 주므로 따로 넣지 않는다.
 */
export function buildCalendar(
  from: string,
  to: string,
  holidays: readonly Holiday[],
  weekendDays: readonly number[] = plannerConfig.weekendDays,
): DayInfo[] {
  const namesByDate = new Map<string, string[]>();
  for (const h of holidays) {
    const names = namesByDate.get(h.date) ?? [];
    if (!names.includes(h.name)) names.push(h.name);
    namesByDate.set(h.date, names);
  }

  const days: DayInfo[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const dow = dayOfWeek(date);
    const holidayNames = [...(namesByDate.get(date) ?? [])];
    const weekend = weekendDays.includes(dow);
    const holiday = holidayNames.length > 0;
    days.push({ date, dow, weekend, holidayNames, holiday, off: weekend || holiday });
  }
  return days;
}

export interface HolidayPeriod {
  start: string;
  end: string;
  totalDays: number;
  /** 포함된 공휴일 이름 (표기용, 중복 없이 날짜순) */
  holidayNames: string[];
}

/** 날짜들에 들어 있는 공휴일 이름 (표기용, 중복 없이 순서대로) */
export function uniqueHolidayNames(days: readonly DayInfo[]): string[] {
  return [...new Set(days.flatMap((d) => d.holidayNames.map(displayHolidayName)))];
}

/** 연휴 = 쉬는 날(주말·공휴일)이 이어진 구간 중 공휴일이 1개 이상 포함된 것 */
export function findHolidayPeriods(days: readonly DayInfo[]): HolidayPeriod[] {
  const periods: HolidayPeriod[] = [];
  let run: DayInfo[] = [];
  const flush = () => {
    if (run.some((d) => d.holiday)) {
      periods.push({
        start: run[0].date,
        end: run[run.length - 1].date,
        totalDays: run.length,
        holidayNames: uniqueHolidayNames(run),
      });
    }
    run = [];
  };
  for (const day of days) {
    if (day.off) run.push(day);
    else flush();
  }
  flush();
  return periods;
}

/** 오늘이 들어 있는 연휴(current)와 오늘 이후 처음 시작하는 연휴(next) */
export function periodsAround(periods: readonly HolidayPeriod[], today: string): { current: HolidayPeriod | null; next: HolidayPeriod | null } {
  return {
    current: periods.find((p) => p.start <= today && today <= p.end) ?? null,
    next: periods.find((p) => p.start > today) ?? null,
  };
}

export interface HolidayRow {
  start: string;
  end: string;
  /** 표기 이름 — API 이름 그대로("대체공휴일(개천절)" 포함), "1월1일"만 "신정" */
  name: string;
  /** "대체공휴일"로 시작하면 true → 배지 */
  substitute: boolean;
}

/** from~to 사이 공휴일을 목록 행으로. 같은 이름이 이어지면(설날·추석 사흘) 한 줄로 묶는다. */
export function holidayRows(days: readonly DayInfo[], from: string, to: string): HolidayRow[] {
  const rows: HolidayRow[] = [];
  for (const day of days) {
    if (!day.holiday || day.date < from || day.date > to) continue;
    const name = day.holidayNames.map(displayHolidayName).join('·');
    const last = rows[rows.length - 1];
    if (last && last.name === name && addDays(last.end, 1) === day.date) {
      last.end = day.date;
    } else {
      rows.push({ start: day.date, end: day.date, name, substitute: day.holidayNames.every(isSubstituteName) });
    }
  }
  return rows;
}
