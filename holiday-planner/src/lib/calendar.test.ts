import { describe, expect, it } from 'vitest';
import { addDays } from './date';
import { buildCalendar, findHolidayPeriods, holidayRows, periodsAround } from './calendar';
import { isSubstituteName, type Holiday } from './holidays';
import { HOLIDAYS_2026, HOLIDAYS_2027 } from './testFixtures';

const BOTH_YEARS = [...HOLIDAYS_2026, ...HOLIDAYS_2027];

function around(today: string, holidays: Holiday[] = HOLIDAYS_2026, to = '2026-12-31') {
  const days = buildCalendar(addDays(today, -14), to, holidays);
  return periodsAround(findHolidayPeriods(days), today);
}

describe('연휴 (주말·공휴일이 이어진 구간 중 공휴일이 1개 이상)', () => {
  it('오늘(9/27 일)이 추석 연휴 마지막 날이면 current, 다음은 개천절 연휴', () => {
    const { current, next } = around('2026-09-27');
    expect(current).toEqual({ start: '2026-09-24', end: '2026-09-27', totalDays: 4, holidayNames: ['추석'] });
    expect(next).toEqual({ start: '2026-10-03', end: '2026-10-05', totalDays: 3, holidayNames: ['개천절', '대체공휴일(개천절)'] });
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

  it('노동절(5/1)은 API 공휴일 그대로 쉬는 날 — 5/1(금)~5/3(일) 연휴', () => {
    expect(around('2026-04-28').next).toEqual({ start: '2026-05-01', end: '2026-05-03', totalDays: 3, holidayNames: ['노동절'] });
  });

  it('API 목록에 없는 날은 따로 쉬는 날로 넣지 않는다 (노동절이 빠지면 5/1은 근무일)', () => {
    const withoutMayDay = HOLIDAYS_2026.filter((h) => h.name !== '노동절');
    const [may1] = buildCalendar('2026-05-01', '2026-05-01', withoutMayDay);
    expect(may1).toMatchObject({ holiday: false, off: false, holidayNames: [] });
  });

  it('노동절이 토요일인 2027년은 대체공휴일(노동절)까지 — 5/1(토)~5/3(월)', () => {
    expect(around('2027-04-26', BOTH_YEARS, '2027-12-31').next).toEqual({
      start: '2027-05-01',
      end: '2027-05-03',
      totalDays: 3,
      holidayNames: ['노동절', '대체공휴일(노동절)'],
    });
  });

  it('연말에 내년 공휴일이 있으면 해를 넘는 연휴(12/31 이후 신정)', () => {
    const { next } = around('2026-12-28', BOTH_YEARS, '2027-12-31');
    expect(next).toEqual({ start: '2027-01-01', end: '2027-01-03', totalDays: 3, holidayNames: ['신정'] });
    expect(around('2026-12-28').next).toBeNull();
  });
});

describe('holidayRows (올해 남은 공휴일 목록)', () => {
  const days = buildCalendar('2026-09-06', '2026-12-31', HOLIDAYS_2026);

  it('이어지는 같은 공휴일은 한 줄, 대체공휴일은 API 이름 그대로 + substitute(배지) — 원래 이름을 따로 붙이지 않는다', () => {
    expect(holidayRows(days, '2026-09-20', '2026-12-31')).toEqual([
      { start: '2026-09-24', end: '2026-09-26', name: '추석', substitute: false },
      { start: '2026-10-03', end: '2026-10-03', name: '개천절', substitute: false },
      { start: '2026-10-05', end: '2026-10-05', name: '대체공휴일(개천절)', substitute: true },
      { start: '2026-10-09', end: '2026-10-09', name: '한글날', substitute: false },
      { start: '2026-12-25', end: '2026-12-25', name: '기독탄신일', substitute: false },
    ]);
  });

  it('오늘 이후만(오늘 포함)', () => {
    expect(holidayRows(days, '2026-10-09', '2026-12-31').map((r) => r.start)).toEqual(['2026-10-09', '2026-12-25']);
  });

  it('"대체공휴일"로 시작하는 이름만 대체공휴일', () => {
    expect(['대체공휴일', '대체공휴일(개천절)', '대체공휴일(노동절)'].every(isSubstituteName)).toBe(true);
    expect(['개천절', '노동절', '임시공휴일', '전국동시지방선거'].some(isSubstituteName)).toBe(false);
  });

  it('한 날짜에 이름이 둘이면 한 줄에 함께, 그 대체공휴일은 따로 한 줄', () => {
    const overlap: Holiday[] = [
      { date: '2025-05-05', name: '어린이날' },
      { date: '2025-05-05', name: '부처님오신날' },
      { date: '2025-05-06', name: '대체공휴일(부처님오신날)' },
    ];
    const may = buildCalendar('2025-05-01', '2025-05-31', overlap);
    expect(holidayRows(may, '2025-05-01', '2025-05-31')).toEqual([
      { start: '2025-05-05', end: '2025-05-05', name: '어린이날·부처님오신날', substitute: false },
      { start: '2025-05-06', end: '2025-05-06', name: '대체공휴일(부처님오신날)', substitute: true },
    ]);
  });

  it('신정은 "1월1일" 대신 "신정"', () => {
    const jan = buildCalendar('2027-01-01', '2027-01-31', HOLIDAYS_2027);
    expect(holidayRows(jan, '2027-01-01', '2027-01-31')).toEqual([{ start: '2027-01-01', end: '2027-01-01', name: '신정', substitute: false }]);
  });
});
