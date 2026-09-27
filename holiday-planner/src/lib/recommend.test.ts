import { describe, expect, it } from 'vitest';
import { plannerConfig } from '../config/planner';
import { buildCalendar, calendarOptions } from './calendar';
import {
  compareRecommendations,
  daysPerLeave,
  dedupeByLeaveDates,
  findLeaveWindows,
  planRangeEnd,
  recommend,
  type Recommendation,
  type RecommendInput,
} from './recommend';
import { HOLIDAYS_2026, HOLIDAYS_2027 } from './testFixtures';

const BOTH_YEARS = [...HOLIDAYS_2026, ...HOLIDAYS_2027];
/** 상위 N개로 자르지 않고 후보 전체를 볼 때 */
const ALL = { ...plannerConfig, resultsPerTab: 1000 };

function run(input: Partial<RecommendInput> & Pick<RecommendInput, 'today' | 'leaveCount'>, config = plannerConfig) {
  return recommend({ holidays: HOLIDAYS_2026, nextYearAvailable: false, laborDayOff: true, ...input }, config);
}

const brief = (r: Recommendation) => ({ start: r.start, end: r.end, totalDays: r.totalDays, leaveDates: r.leaveDates });

describe('추석 연휴 끼인 구간', () => {
  it('연차 1개: 추석 앞뒤 하루로 5일', () => {
    const top = run({ today: '2026-09-01', leaveCount: 1 });
    expect(top.slice(0, 2).map(brief)).toEqual([
      { start: '2026-09-23', end: '2026-09-27', totalDays: 5, leaveDates: ['2026-09-23'] },
      { start: '2026-09-24', end: '2026-09-28', totalDays: 5, leaveDates: ['2026-09-28'] },
    ]);
  });

  it('연차 3개: 추석(9/19~27)과 개천절~한글날(10/3~11) 9일이 1·2위, 같은 길이·공휴일 수면 가까운 날짜 먼저', () => {
    const top = run({ today: '2026-09-01', leaveCount: 3 });
    expect(top).toHaveLength(plannerConfig.resultsPerTab);
    expect(top.slice(0, 2).map(brief)).toEqual([
      { start: '2026-09-19', end: '2026-09-27', totalDays: 9, leaveDates: ['2026-09-21', '2026-09-22', '2026-09-23'] },
      { start: '2026-10-03', end: '2026-10-11', totalDays: 9, leaveDates: ['2026-10-06', '2026-10-07', '2026-10-08'] },
    ]);
    expect(top[0].holidayCount).toBe(3);
    expect(top[0].holidayNames).toEqual(['추석']);
    expect(top[1].holidayNames).toEqual(['개천절', '대체공휴일', '한글날']);
    expect(daysPerLeave(top[0])).toBe('3');
  });

  it('연차 쓸 날은 구간 안의 근무일 전부, 구간 양 끝은 근무일 바로 앞·뒤까지', () => {
    const [top] = run({ today: '2026-09-01', leaveCount: 2 });
    expect(brief(top)).toEqual({ start: '2026-09-22', end: '2026-09-27', totalDays: 6, leaveDates: ['2026-09-22', '2026-09-23'] });
    const days = top.days.map((d) => `${d.date.slice(5)}${d.off ? '휴' : '근'}`);
    expect(days).toEqual(['09-22근', '09-23근', '09-24휴', '09-25휴', '09-26휴', '09-27휴']);
  });

  it('정렬: 총 일수 ↓ → 공휴일 수 ↓ → 가까운 날짜', () => {
    const all = run({ today: '2026-01-01', leaveCount: 2 }, ALL);
    for (let i = 1; i < all.length; i++) expect(compareRecommendations(all[i - 1], all[i])).toBeLessThanOrEqual(0);
  });
});

describe('연말연시', () => {
  it('내년 공휴일이 있으면 해를 넘기는 구간도 계산 (12/29~12/31 → 2027-01-03까지 6일)', () => {
    const all = run({ today: '2026-12-01', leaveCount: 3, holidays: BOTH_YEARS, nextYearAvailable: true }, ALL);
    expect(all.map(brief)).toContainEqual({
      start: '2026-12-29',
      end: '2027-01-03',
      totalDays: 6,
      leaveDates: ['2026-12-29', '2026-12-30', '2026-12-31'],
    });
    const newYear = run({ today: '2026-12-01', leaveCount: 1, holidays: BOTH_YEARS, nextYearAvailable: true }, ALL);
    expect(newYear.find((r) => r.leaveDates[0] === '2026-12-31')).toMatchObject({ end: '2027-01-03', totalDays: 4, holidayNames: ['신정'] });
  });

  it('내년 공휴일이 없으면 올해 12/31까지만 (주말만으로 내년을 계산하지 않음)', () => {
    const all = run({ today: '2026-12-01', leaveCount: 3 }, ALL);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((r) => r.end <= '2026-12-31')).toBe(true);
    // 12/31(목) 하루는 범위 끝이라 1일짜리 → 제외
    expect(run({ today: '2026-12-01', leaveCount: 1 }, ALL).some((r) => r.leaveDates.includes('2026-12-31'))).toBe(false);
  });

  it('내년 공휴일이 있으면 내년 설날 연휴(2/5~2/8)까지 추천 범위', () => {
    const top = run({ today: '2026-12-01', leaveCount: 3, holidays: BOTH_YEARS, nextYearAvailable: true });
    expect(top.some((r) => r.start.startsWith('2027'))).toBe(true);
    expect(planRangeEnd('2026-12-01', true)).toBe('2027-12-31');
    expect(planRangeEnd('2026-12-01', false)).toBe('2026-12-31');
  });
});

describe('공휴일이 주말과 겹치는 경우', () => {
  it('토요일 공휴일(현충일 6/6, 대체 없음)은 쉬는 날이 늘지 않지만 공휴일 수로 같은 길이의 평범한 주말보다 앞선다', () => {
    const all = run({ today: '2026-05-26', leaveCount: 1 }, ALL);
    const june5 = all.find((r) => r.leaveDates[0] === '2026-06-05')!;
    const june12 = all.find((r) => r.leaveDates[0] === '2026-06-12')!;
    expect(brief(june5)).toEqual({ start: '2026-06-05', end: '2026-06-07', totalDays: 3, leaveDates: ['2026-06-05'] });
    expect(june5.holidayCount).toBe(1);
    expect(june12.totalDays).toBe(3);
    expect(june12.holidayCount).toBe(0);
    expect(all.indexOf(june5)).toBeLessThan(all.indexOf(june12));
  });

  it('토요일 공휴일에 대체공휴일이 붙으면(개천절 10/3 → 10/5) 금요일 하루로 4일', () => {
    const all = run({ today: '2026-09-28', leaveCount: 1 }, ALL);
    expect(brief(all.find((r) => r.leaveDates[0] === '2026-10-02')!)).toEqual({
      start: '2026-10-02',
      end: '2026-10-05',
      totalDays: 4,
      leaveDates: ['2026-10-02'],
    });
  });

  it('주말이면서 공휴일인 날은 하루로 센다', () => {
    const [sat] = buildCalendar('2026-06-06', '2026-06-06', HOLIDAYS_2026, calendarOptions(plannerConfig, true));
    expect(sat).toMatchObject({ weekend: true, holiday: true, off: true, holidayNames: ['현충일'] });
    // 6/3(수 선거일) + 6/4·6/5 연차 + 6/6(토 현충일) + 6/7(일) = 5일, 공휴일 2개
    const june = run({ today: '2026-05-26', leaveCount: 2 }, ALL).find((r) => r.leaveDates.join() === '2026-06-04,2026-06-05')!;
    expect(brief(june)).toEqual({ start: '2026-06-03', end: '2026-06-07', totalDays: 5, leaveDates: ['2026-06-04', '2026-06-05'] });
    expect(june.holidayCount).toBe(2);
  });
});

describe('오늘 이후만', () => {
  it.each([1, 2, 3])('연차 %i개: 연차 쓸 날·구간 시작이 모두 오늘 뒤', (leaveCount) => {
    const today = '2026-10-06';
    const all = run({ today, leaveCount, holidays: BOTH_YEARS, nextYearAvailable: true }, ALL);
    expect(all.length).toBeGreaterThan(0);
    for (const r of all) {
      expect(r.start > today).toBe(true);
      expect(r.leaveDates.every((d) => d > today)).toBe(true);
    }
  });

  it('연휴 중인 오늘(10/4 일)은 구간에 넣지 않는다 — 10/6(화) 하루는 10/5~10/6 2일이라 제외', () => {
    const all = run({ today: '2026-10-04', leaveCount: 1 }, ALL);
    expect(all.some((r) => r.leaveDates[0] === '2026-10-06')).toBe(false);
    expect(all[0].start >= '2026-10-05').toBe(true);
  });

  it('범위가 비어 있으면 빈 목록', () => {
    expect(run({ today: '2026-12-31', leaveCount: 1 })).toEqual([]);
  });
});

describe('걸러내기·중복 제거', () => {
  it('총 일수가 minTotalDays보다 짧은 구간, 연차만으로 채운 구간(쉬는 날 0일)은 추천하지 않는다', () => {
    for (const leaveCount of [1, 2, 3]) {
      const all = run({ today: '2026-01-01', leaveCount }, ALL);
      expect(all.every((r) => r.totalDays >= plannerConfig.minTotalDays && r.totalDays > r.leaveDates.length)).toBe(true);
    }
    // 연휴 없는 주중 3일(화~목)은 3일이지만 쉬는 날이 없어 제외
    const tueToThu = run({ today: '2026-01-01', leaveCount: 3 }, ALL).find((r) => r.leaveDates.join() === '2026-11-10,2026-11-11,2026-11-12');
    expect(tueToThu).toBeUndefined();
  });

  it('결과에 같은 연차 날짜 집합이 두 번 나오지 않는다', () => {
    for (const leaveCount of [1, 2, 3]) {
      const all = run({ today: '2026-01-01', leaveCount, holidays: BOTH_YEARS, nextYearAvailable: true }, ALL);
      const keys = all.map((r) => r.leaveDates.join());
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('dedupeByLeaveDates: 날짜 집합이 같으면(순서 무관) 처음 것만', () => {
    const days = buildCalendar('2026-10-01', '2026-10-12', HOLIDAYS_2026, calendarOptions(plannerConfig, true));
    const [a] = findLeaveWindows(days, 2);
    const reversed = { ...a, start: '2026-10-02', leaveDates: [...a.leaveDates].reverse() };
    expect(dedupeByLeaveDates([a, reversed, a])).toEqual([a]);
  });

  it('탭당 resultsPerTab개까지', () => {
    for (const leaveCount of [1, 2, 3]) {
      expect(run({ today: '2026-01-01', leaveCount }).length).toBe(plannerConfig.resultsPerTab);
    }
  });
});

describe('근로자의날 토글', () => {
  it('ON이면 5/1(금)이 쉬는 날 → 5/4(월) 하루로 5/1~5/5 5일, OFF면 그 구간이 없다', () => {
    const on = run({ today: '2026-04-20', leaveCount: 1, laborDayOff: true }, ALL);
    const off = run({ today: '2026-04-20', leaveCount: 1, laborDayOff: false }, ALL);
    const may4 = (list: Recommendation[]) => list.find((r) => r.leaveDates[0] === '2026-05-04');
    expect(brief(may4(on)!)).toEqual({ start: '2026-05-01', end: '2026-05-05', totalDays: 5, leaveDates: ['2026-05-04'] });
    expect(may4(on)!.holidayNames).toEqual(['근로자의날', '어린이날']);
    expect(brief(may4(off)!)).toEqual({ start: '2026-05-02', end: '2026-05-05', totalDays: 4, leaveDates: ['2026-05-04'] });
  });

  it('OFF면 5/1은 근무일이라 연차 쓸 날이 될 수 있다', () => {
    const on = run({ today: '2026-04-20', leaveCount: 2, laborDayOff: true }, ALL);
    const off = run({ today: '2026-04-20', leaveCount: 2, laborDayOff: false }, ALL);
    expect(on.some((r) => r.leaveDates.includes('2026-05-01'))).toBe(false);
    expect(off.some((r) => r.leaveDates.includes('2026-05-01'))).toBe(true);
  });

  it('상위 추천 목록 자체가 달라진다', () => {
    const top = (laborDayOff: boolean) => run({ today: '2026-04-20', leaveCount: 1, laborDayOff }).map((r) => r.leaveDates.join());
    expect(top(true)).toContain('2026-05-04');
    expect(top(false)).not.toContain('2026-05-04');
  });
});

describe('daysPerLeave', () => {
  it('정수면 그대로, 아니면 소수 첫째 자리', () => {
    expect(daysPerLeave({ totalDays: 10, leaveDates: ['a', 'b'] })).toBe('5');
    expect(daysPerLeave({ totalDays: 10, leaveDates: ['a', 'b', 'c'] })).toBe('3.3');
  });
});
