import { describe, expect, it } from 'vitest';
import { plannerConfig } from '../config/planner';
import { addDays } from './date';
import { buildCalendar, calendarOptions, findHolidayPeriods, holidayRows, LABOR_DAY_NAME, periodsAround } from './calendar';
import type { Holiday } from './holidays';
import { HOLIDAYS_2026, HOLIDAYS_2027 } from './testFixtures';

function around(today: string, holidays: Holiday[] = HOLIDAYS_2026, laborDayOff = true, to = '2026-12-31') {
  const days = buildCalendar(addDays(today, -14), to, holidays, calendarOptions(plannerConfig, laborDayOff));
  return periodsAround(findHolidayPeriods(days), today);
}

describe('연휴 (주말·공휴일이 이어진 구간 중 공휴일이 1개 이상)', () => {
  it('오늘(9/27 일)이 추석 연휴 마지막 날이면 current, 다음은 개천절 연휴', () => {
    const { current, next } = around('2026-09-27');
    expect(current).toEqual({ start: '2026-09-24', end: '2026-09-27', totalDays: 4, holidayNames: ['추석'] });
    expect(next).toEqual({ start: '2026-10-03', end: '2026-10-05', totalDays: 3, holidayNames: ['개천절', '대체공휴일'] });
  });

  it('연휴가 끝난 다음 날은 current 없음', () => {
    const { current, next } = around('2026-09-28');
    expect(current).toBeNull();
    expect(next?.start).toBe('2026-10-03');
  });

  it('공휴일 없는 평범한 주말은 연휴가 아니다', () => {
    const { current, next } = around('2026-09-12'); // 토요일
    expect(current).toBeNull();
    expect(next?.start).toBe('2026-09-24');
  });

  it('평일 공휴일 하루도 연휴(1일)', () => {
    expect(around('2026-06-01').next).toEqual({ start: '2026-06-03', end: '2026-06-03', totalDays: 1, holidayNames: ['전국동시지방선거'] });
  });

  it('근로자의날 ON이면 5/1(금)~5/3(일)이 연휴, OFF면 다음 연휴는 어린이날', () => {
    expect(around('2026-04-28', HOLIDAYS_2026, true).next).toEqual({
      start: '2026-05-01',
      end: '2026-05-03',
      totalDays: 3,
      holidayNames: [LABOR_DAY_NAME],
    });
    expect(around('2026-04-28', HOLIDAYS_2026, false).next).toEqual({
      start: '2026-05-05',
      end: '2026-05-05',
      totalDays: 1,
      holidayNames: ['어린이날'],
    });
  });

  it('API가 5/1을 이미 공휴일로 주면 그 이름을 쓰고, 토글과 상관없이 쉬는 날', () => {
    const withMayDay = [...HOLIDAYS_2026, { date: '2026-05-01', name: '노동절' }];
    for (const laborDayOff of [true, false]) {
      const [may1] = buildCalendar('2026-05-01', '2026-05-01', withMayDay, calendarOptions(plannerConfig, laborDayOff));
      expect(may1).toMatchObject({ holidayNames: ['노동절'], off: true });
    }
  });

  it('연말에 내년 공휴일이 있으면 해를 넘는 연휴(12/31 이후 신정)', () => {
    const { next } = around('2026-12-28', [...HOLIDAYS_2026, ...HOLIDAYS_2027], true, '2027-12-31');
    expect(next).toEqual({ start: '2027-01-01', end: '2027-01-03', totalDays: 3, holidayNames: ['신정'] });
    expect(around('2026-12-28').next).toBeNull();
  });
});

describe('holidayRows (올해 남은 공휴일 목록)', () => {
  const days = buildCalendar('2026-09-06', '2026-12-31', HOLIDAYS_2026, calendarOptions(plannerConfig, true));

  it('이어지는 같은 공휴일은 한 줄, 대체공휴일은 원래 공휴일 이름 + substitute', () => {
    expect(holidayRows(days, '2026-09-20', '2026-12-31')).toEqual([
      { start: '2026-09-24', end: '2026-09-26', name: '추석', substitute: false },
      { start: '2026-10-03', end: '2026-10-03', name: '개천절', substitute: false },
      { start: '2026-10-05', end: '2026-10-05', name: '개천절', substitute: true },
      { start: '2026-10-09', end: '2026-10-09', name: '한글날', substitute: false },
      { start: '2026-12-25', end: '2026-12-25', name: '기독탄신일', substitute: false },
    ]);
  });

  it('오늘 이후만(오늘 포함)', () => {
    expect(holidayRows(days, '2026-10-09', '2026-12-31').map((r) => r.start)).toEqual(['2026-10-09', '2026-12-25']);
  });

  it('두 공휴일이 겹친 날과 그 대체공휴일', () => {
    const overlap: Holiday[] = [
      { date: '2025-05-05', name: '어린이날' },
      { date: '2025-05-05', name: '부처님오신날' },
      { date: '2025-05-06', name: '대체공휴일' },
    ];
    const may = buildCalendar('2025-04-25', '2025-05-31', overlap, calendarOptions(plannerConfig, false));
    expect(holidayRows(may, '2025-05-01', '2025-05-31')).toEqual([
      { start: '2025-05-05', end: '2025-05-05', name: '어린이날·부처님오신날', substitute: false },
      { start: '2025-05-06', end: '2025-05-06', name: '어린이날·부처님오신날', substitute: true },
    ]);
  });

  it('원래 공휴일을 못 찾으면 이름 없이 대체공휴일 표시만, 신정은 "1월1일" 대신 "신정"', () => {
    const lonely = buildCalendar('2027-01-01', '2027-01-31', [{ date: '2027-01-01', name: '1월1일' }, { date: '2027-01-20', name: '대체공휴일' }], calendarOptions(plannerConfig, false));
    expect(holidayRows(lonely, '2027-01-01', '2027-01-31')).toEqual([
      { start: '2027-01-01', end: '2027-01-01', name: '신정', substitute: false },
      { start: '2027-01-20', end: '2027-01-20', name: '', substitute: true },
    ]);
  });
});
