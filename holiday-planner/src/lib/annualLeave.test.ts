import { describe, expect, it } from 'vitest';
import { accrualDate, calculateAnnualLeave, completedMonths, leaveDaysForYears } from './annualLeave';

const TODAY = '2026-09-27';

describe('calculateAnnualLeave', () => {
  it.each([
    // [설명, 입사일, 발생 연차, 다음 증가일, 증가 후]
    ['입사 당일(0개월)', '2026-09-27', 0, '2026-10-27', 1],
    ['6개월', '2026-03-27', 6, '2026-10-27', 7],
    ['11개월', '2025-10-27', 11, '2026-10-27', 15],
    ['1년', '2025-09-27', 15, '2028-09-27', 16],
    ['2년', '2024-09-27', 15, '2027-09-27', 16],
    ['3년', '2023-09-27', 16, '2028-09-27', 17],
    ['5년', '2021-09-27', 17, '2028-09-27', 18],
  ])('%s → %i일, 다음 %s부터 %i일', (_label, hireDate, days, nextDate, nextDays) => {
    expect(calculateAnnualLeave(hireDate, TODAY)).toMatchObject({ days, next: { date: nextDate, days: nextDays } });
  });

  it('근속 연수·개월 수', () => {
    expect(calculateAnnualLeave('2024-06-15', TODAY)).toMatchObject({ years: 2, months: 27 });
    expect(calculateAnnualLeave('2026-03-27', TODAY)).toMatchObject({ years: 0, months: 6 });
  });

  it('21년 이상은 25일 한도, 더 늘지 않는다', () => {
    expect(calculateAnnualLeave('2005-09-27', TODAY)).toEqual({ months: 252, years: 21, days: 25, next: null });
    expect(calculateAnnualLeave('1996-01-02', TODAY)).toMatchObject({ days: 25, next: null });
    // 19년차 → 24일, 21년 되는 날 25일
    expect(calculateAnnualLeave('2007-09-27', TODAY)).toMatchObject({ days: 24, next: { date: '2028-09-27', days: 25 } });
  });

  it('1년이 되기 하루 전은 아직 11일 (1년 미만 최대 11)', () => {
    expect(calculateAnnualLeave('2025-09-28', TODAY)).toMatchObject({ years: 0, months: 11, days: 11, next: { date: '2026-09-28', days: 15 } });
  });

  it('입사일이 오늘보다 뒤이거나 형식이 틀리면 null', () => {
    expect(calculateAnnualLeave('2026-09-28', TODAY)).toBeNull();
    expect(calculateAnnualLeave('2026-02-30', TODAY)).toBeNull();
    expect(calculateAnnualLeave('', TODAY)).toBeNull();
  });
});

describe('월말 입사 개월 계산 (민법 제160조)', () => {
  it('1/31 입사: 2월에 31일이 없으니 1개월은 2/28에 끝나고 3/1에 1일 생긴다', () => {
    expect(completedMonths('2026-01-31', '2026-02-28')).toBe(0);
    expect(completedMonths('2026-01-31', '2026-03-01')).toBe(1);
    expect(completedMonths('2026-01-31', '2026-03-30')).toBe(1);
    expect(completedMonths('2026-01-31', '2026-03-31')).toBe(2);
    expect(completedMonths('2026-01-31', '2026-04-30')).toBe(2);
    expect(completedMonths('2026-01-31', '2026-05-01')).toBe(3);
    expect(calculateAnnualLeave('2026-01-31', '2026-02-28')).toMatchObject({ days: 0, next: { date: '2026-03-01', days: 1 } });
  });

  it('JS Date 넘침(1/31 + 1개월 = 3/3) 없이 해당일 → 없으면 다음 달 1일', () => {
    expect(accrualDate('2026-01-31', 1)).toBe('2026-03-01');
    expect(accrualDate('2026-01-31', 2)).toBe('2026-03-31');
    expect(accrualDate('2026-01-31', 3)).toBe('2026-05-01');
    expect(accrualDate('2026-01-28', 1)).toBe('2026-02-28');
    expect(accrualDate('2026-03-02', 1)).toBe('2026-04-02');
    expect(accrualDate('2025-12-31', 11)).toBe('2026-12-01'); // 11월엔 31일이 없음
    expect(accrualDate('2025-12-15', 1)).toBe('2026-01-15');
  });

  it('윤년 2/29 입사: 평년에는 3/1이 1년', () => {
    expect(accrualDate('2024-02-29', 12)).toBe('2025-03-01');
    expect(calculateAnnualLeave('2024-02-29', '2025-02-28')).toMatchObject({ years: 0, days: 11 });
    expect(calculateAnnualLeave('2024-02-29', '2025-03-01')).toMatchObject({ years: 1, days: 15 });
    expect(accrualDate('2024-02-29', 48)).toBe('2028-02-29');
  });
});

describe('leaveDaysForYears', () => {
  it('15일 + 최초 1년 초과 2년마다 1일, 최대 25', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 19, 20, 21, 30].map(leaveDaysForYears)).toEqual([15, 15, 16, 16, 17, 17, 18, 24, 24, 25, 25]);
  });
});
