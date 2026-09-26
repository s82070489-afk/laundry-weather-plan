import { describe, expect, it } from 'vitest';
import type { HourlyForecast } from '../weather/types';
import { judge } from './judge';
import { addDays } from '../weather/kst';
import { relativeDayLabel } from '../utils/format';
import { periodOf, reasonText, shortReason } from './reason';

const TODAY = '20260926';
const TOMORROW = '20260927';
const now = { date: TODAY, hour: 8 };

function day(date: string, v: Partial<HourlyForecast> = {}, byHour: Record<number, Partial<HourlyForecast>> = {}) {
  return Array.from({ length: 24 }, (_, hour) => ({ date, hour, tmp: 22, reh: 50, pop: 0, wsd: 2, sky: 1, pty: 0, ...v, ...byHour[hour] }) as HourlyForecast);
}

const reason = (hours: HourlyForecast[], date = TOMORROW, label = '내일') => reasonText(judge('laundry', hours, date, now), label);

describe('reasonText', () => {
  it('판정 시간대에 비가 있으면 비 소식을 먼저 알린다', () => {
    expect(reason(day(TOMORROW, {}, { 14: { pty: 1 }, 15: { pty: 1 } }))).toBe('내일 오후에 비 소식이 있어요');
    expect(reason(day(TOMORROW, { pty: 1 }))).toBe('내일 오전에 비 소식이 있어요');
  });

  it('가장 큰 감점 요인 기준 — 습도', () => {
    expect(reason(day(TOMORROW, { reh: 90, sky: 3 }))).toBe('습도가 높아 잘 안 말라요');
  });

  it('좋아요·괜찮아요는 부드러운 문장', () => {
    expect(reason(day(TOMORROW, { reh: 72 }))).toBe('습도가 조금 높은 편이에요'); // 80점 좋아요
    expect(reason(day(TOMORROW, { sky: 4, wsd: 0.5 }))).toBe('바람이 약해 조금 천천히 말라요'); // 80점, 바람=하늘 동점 → 먼저 나온 요소
  });

  it('감점이 없거나 100점이면 긍정 문장', () => {
    expect(reason(day(TOMORROW))).toBe('맑고 건조해서 잘 말라요');
    // 10시(습도 70%)가 추천 구간 가장자리에 포함돼도 대표 점수 100 → 긍정
    expect(reason(day(TOMORROW, {}, { 9: { reh: 90 }, 10: { reh: 70 }, 15: { reh: 90 }, 16: { reh: 90 }, 17: { reh: 90 } }))).toBe(
      '맑고 건조해서 잘 말라요',
    );
  });

  it('강풍, 저온, 강수확률', () => {
    expect(reason(day(TOMORROW, { wsd: 10 }))).toBe('바람이 강해 빨래가 날릴 수 있어요');
    expect(reason(day(TOMORROW, { tmp: 3, reh: 72, sky: 4 }))).toBe('기온이 낮아 잘 안 말라요');
    expect(reason(day(TOMORROW, { pop: 50, sky: 3 }))).toBe('비 올 가능성이 높아요');
  });

  it('늦었어요 / 예보 없음', () => {
    expect(reasonText(judge('laundry', day(TODAY), TODAY, { date: TODAY, hour: 16 }), '오늘')).toBe(
      '남은 낮 시간이 짧아 널어도 다 마르기 어려워요',
    );
    expect(reasonText(judge('laundry', day(TODAY), TOMORROW, now), '내일')).toBeNull();
  });
});

describe('periodOf / relativeDayLabel (세차 상세 문장)', () => {
  it('시각과 날짜를 말로', () => {
    expect([0, 5, 6, 11, 12, 17, 18, 23].map(periodOf)).toEqual(['새벽', '새벽', '오전', '오전', '오후', '오후', '저녁', '저녁']);
    expect(['20260926', '20260927', '20260928', '20260929', '20260930'].map((d) => relativeDayLabel(d, TODAY, addDays))).toEqual([
      '오늘',
      '내일',
      '모레',
      '글피',
      '9월 30일 (수)',
    ]);
  });
});

describe('shortReason (세차 미리보기)', () => {
  const next = '20260928';
  it('판정일 이후 비면 "이틀 안에 비 소식", 당일 비면 "당일 비 소식"', () => {
    const later = [...day(TOMORROW), ...day(next, { pty: 1 })];
    expect(shortReason(judge('carWash', later, TOMORROW, now))).toBe('이틀 안에 비 소식');
    const sameDay = day(TOMORROW, {}, { 20: { pty: 1 } });
    expect(shortReason(judge('carWash', sameDay, TOMORROW, now))).toBe('당일 비 소식');
  });
  it('비 소식이 없거나 세차가 아니면 없음', () => {
    expect(shortReason(judge('carWash', day(TOMORROW), TOMORROW, now))).toBeNull();
    expect(shortReason(judge('laundry', day(TOMORROW, { pty: 1 }), TOMORROW, now))).toBeNull();
  });
});
