/// <reference types="node" />
import { afterEach, describe, expect, it } from 'vitest';
import {
  addDays,
  dayOfWeek,
  diffDays,
  formatMonthDay,
  formatRange,
  formatShort,
  formatYmd,
  isValidDate,
  todayKst,
} from './date';

describe('KST 날짜', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('UTC 15시가 KST 자정 — 연말 경계', () => {
    expect(todayKst(new Date('2026-12-31T14:59:59Z'))).toBe('2026-12-31');
    expect(todayKst(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01');
  });

  it('기기 시간대가 달라도 같은 결과', () => {
    for (const tz of ['America/Los_Angeles', 'Asia/Seoul', 'Pacific/Kiritimati', 'UTC']) {
      process.env.TZ = tz;
      expect(todayKst(new Date('2026-09-26T16:30:00Z')), tz).toBe('2026-09-27');
      expect(addDays('2026-03-07', 2), tz).toBe('2026-03-09'); // 미국 서머타임 시작 주말
      expect(dayOfWeek('2026-09-27'), tz).toBe(0);
      expect(diffDays('2026-03-01', '2026-04-01'), tz).toBe(31);
    }
  });
});

describe('날짜 계산', () => {
  it('addDays: 월·연·윤년 경계, 음수', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2026-09-27', -14)).toBe('2026-09-13');
  });

  it('diffDays·dayOfWeek', () => {
    expect(diffDays('2026-09-27', '2026-10-03')).toBe(6);
    expect(diffDays('2026-10-03', '2026-09-27')).toBe(-6);
    expect(diffDays('2026-12-31', '2027-01-01')).toBe(1);
    expect(dayOfWeek('2026-10-03')).toBe(6);
  });

  it('isValidDate: 실제 있는 날짜만', () => {
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-2-3')).toBe(false);
    expect(isValidDate(20261003)).toBe(false);
  });

  it('표기', () => {
    expect(formatMonthDay('2026-10-02')).toBe('10월 2일(금)');
    expect(formatShort('2026-10-02')).toBe('10/2(금)');
    expect(formatYmd('2027-03-02')).toBe('2027년 3월 2일');
    expect(formatRange('2026-10-02', '2026-10-11')).toBe('10월 2일(금) ~ 10월 11일(일)');
    expect(formatRange('2026-06-03', '2026-06-03')).toBe('6월 3일(수)');
  });

  it('올해가 아닌 날짜에는 연도를 붙인다', () => {
    expect(formatMonthDay('2027-01-01', 2026)).toBe('2027년 1월 1일(금)');
    expect(formatMonthDay('2026-10-02', 2026)).toBe('10월 2일(금)');
    expect(formatRange('2027-09-10', '2027-09-19', 2026)).toBe('2027년 9월 10일(금) ~ 9월 19일(일)');
    expect(formatRange('2026-12-29', '2027-01-03', 2026)).toBe('12월 29일(화) ~ 2027년 1월 3일(일)');
    expect(formatRange('2026-12-29', '2027-01-03')).toBe('12월 29일(화) ~ 2027년 1월 3일(일)');
  });
});
