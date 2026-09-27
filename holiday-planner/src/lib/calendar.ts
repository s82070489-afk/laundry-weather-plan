import type { PlannerConfig } from '../config/planner';
import { addDays, dayOfWeek, parts } from './date';
import { displayHolidayName, isSubstituteName, type Holiday } from './holidays';

/** 공공데이터(특일 정보)에는 휴일로 없어서 설정(토글)으로 따로 넣는 이름 */
export const LABOR_DAY_NAME = '근로자의날';

export interface CalendarOptions {
  weekendDays: readonly number[];
  /** 근로자의날을 쉬면 { month, day }, 안 쉬면 null */
  laborDay: { month: number; day: number } | null;
}

export function calendarOptions(config: PlannerConfig, laborDayOff: boolean): CalendarOptions {
  return { weekendDays: config.weekendDays, laborDay: laborDayOff ? config.laborDay : null };
}

export interface DayInfo {
  /** YYYY-MM-DD */
  date: string;
  /** 0 = 일요일 */
  dow: number;
  weekend: boolean;
  /** 이날의 공휴일 이름 (API 원문). 근로자의날을 쉬면 '근로자의날'도 들어간다 */
  holidayNames: string[];
  /** 공휴일(근로자의날을 쉬면 그날 포함) */
  holiday: boolean;
  /** 쉬는 날 = 주말 또는 공휴일 */
  off: boolean;
}

/**
 * from~to(포함) 날짜마다 쉬는 날/근무일 표시.
 * 근로자의날은 토글이 켜져 있을 때만 쉬는 날이다. API가 그날을 이미 공휴일로 주면(예: 제도 변경) 그 이름을 쓴다.
 */
export function buildCalendar(from: string, to: string, holidays: readonly Holiday[], options: CalendarOptions): DayInfo[] {
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
    const { m, d } = parts(date);
    if (options.laborDay && m === options.laborDay.month && d === options.laborDay.day && holidayNames.length === 0) {
      holidayNames.push(LABOR_DAY_NAME);
    }
    const weekend = options.weekendDays.includes(dow);
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

/** 연휴 = 쉬는 날(주말·공휴일·쉬는 근로자의날)이 이어진 구간 중 공휴일이 1개 이상 포함된 것 */
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
  /** 표기 이름. 대체공휴일이면 원래 공휴일 이름(앞쪽 7일 안에서 찾음), 못 찾으면 '' */
  name: string;
  substitute: boolean;
}

/**
 * 대체공휴일의 원래 공휴일: 7일 안쪽 앞에서 주말에 걸렸거나 다른 공휴일과 겹친 공휴일.
 * (설날·추석은 일요일, 그 밖의 공휴일은 토·일요일이나 다른 공휴일과 겹치면 대체공휴일이 생긴다)
 */
function substituteOrigin(days: readonly DayInfo[], index: number): string {
  for (let j = index - 1; j >= 0 && j >= index - 7; j--) {
    const names = days[j].holidayNames.filter((n) => !isSubstituteName(n));
    if (names.length > 0 && (days[j].weekend || names.length > 1)) return names.map(displayHolidayName).join('·');
  }
  return '';
}

/**
 * from~to 사이 공휴일을 목록 행으로. 같은 공휴일이 이어지면(설날·추석 사흘) 한 줄로 묶는다.
 * days는 대체공휴일의 원래 공휴일을 찾을 수 있게 from보다 일주일 이상 앞에서 시작하는 게 좋다.
 */
export function holidayRows(days: readonly DayInfo[], from: string, to: string): HolidayRow[] {
  const rows: HolidayRow[] = [];
  let lastKey = '';
  days.forEach((day, index) => {
    if (!day.holiday || day.date < from || day.date > to) return;
    const substitute = day.holidayNames.every(isSubstituteName);
    const name = substitute ? substituteOrigin(days, index) : day.holidayNames.map(displayHolidayName).join('·');
    const key = `${substitute ? 'sub' : 'day'}:${name}`;
    const last = rows[rows.length - 1];
    if (last && lastKey === key && addDays(last.end, 1) === day.date) {
      last.end = day.date;
    } else {
      rows.push({ start: day.date, end: day.date, name, substitute });
      lastKey = key;
    }
  });
  return rows;
}
