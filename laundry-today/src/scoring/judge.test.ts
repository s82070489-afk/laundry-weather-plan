import { describe, expect, it } from 'vitest';
import { SCORING } from '../config/scoring';
import type { HourlyForecast } from '../weather/types';
import { bestWindow, formatWindow, headline, judge, mainTargetDate, scoreHour, verdictLabel } from './judge';

const TODAY = '20260926';
const TOMORROW = '20260927';

/** 기본값은 "아무 감점 없는 시각" */
function h(date: string, hour: number, v: Partial<HourlyForecast> = {}): HourlyForecast {
  return { date, hour, tmp: 22, reh: 50, pop: 0, wsd: 2, sky: 1, pty: 0, ...v };
}

function flatDay(date: string, v: Partial<HourlyForecast> = {}): HourlyForecast[] {
  return Array.from({ length: 24 }, (_, hour) => h(date, hour, v));
}

/**
 * 실제 응답 패턴을 옮긴 하루: 새벽~아침은 습하고 강수확률 20~30%, 오전 10시부터 건조·맑음.
 */
function realisticDay(date: string): HourlyForecast[] {
  const byHour: Record<number, Partial<HourlyForecast>> = {
    6: { tmp: 16, reh: 90, pop: 20, wsd: 0.6, sky: 3 },
    7: { tmp: 17, reh: 90, pop: 30, wsd: 0.7, sky: 3 },
    8: { tmp: 18, reh: 85, pop: 30, wsd: 0.9, sky: 3 },
    9: { tmp: 20, reh: 78, pop: 20, wsd: 0.9, sky: 1 },
    10: { tmp: 22, reh: 70, pop: 0, wsd: 1.0, sky: 1 },
    11: { tmp: 24, reh: 65, pop: 0, wsd: 1.1, sky: 1 },
    12: { tmp: 25, reh: 60, pop: 0, wsd: 1.3, sky: 1 },
    13: { tmp: 26, reh: 55, pop: 0, wsd: 1.4, sky: 1 },
    14: { tmp: 26, reh: 58, pop: 0, wsd: 1.2, sky: 1 },
    15: { tmp: 25, reh: 66, pop: 0, wsd: 0.9, sky: 3 },
    16: { tmp: 24, reh: 72, pop: 10, wsd: 0.8, sky: 3 },
    17: { tmp: 22, reh: 78, pop: 10, wsd: 0.7, sky: 3 },
  };
  return Array.from({ length: 24 }, (_, hour) =>
    h(date, hour, byHour[hour] ?? { tmp: 15, reh: 90, pop: 20, wsd: 0.5, sky: 3 }),
  );
}

describe('scoreHour', () => {
  it('PTY ≠ 0 이면 0점', () => {
    for (const pty of [1, 2, 3, 4] as const) expect(scoreHour(h(TODAY, 12, { pty })).score).toBe(0);
  });

  it('기준표대로 감점한다', () => {
    expect(scoreHour(h(TODAY, 12)).score).toBe(100);
    expect(scoreHour(h(TODAY, 12, { pop: 30 })).score).toBe(70);
    expect(scoreHour(h(TODAY, 12, { pop: 50 })).score).toBe(50);
    expect(scoreHour(h(TODAY, 12, { reh: 70 })).score).toBe(80);
    expect(scoreHour(h(TODAY, 12, { reh: 85 })).score).toBe(55);
    expect(scoreHour(h(TODAY, 12, { tmp: 9.9 })).score).toBe(85);
    expect(scoreHour(h(TODAY, 12, { tmp: 4 })).score).toBe(75);
    expect(scoreHour(h(TODAY, 12, { wsd: 0.9 })).score).toBe(90);
    expect(scoreHour(h(TODAY, 12, { wsd: 9 })).score).toBe(85);
    expect(scoreHour(h(TODAY, 12, { sky: 3 })).score).toBe(95);
    expect(scoreHour(h(TODAY, 12, { sky: 4 })).score).toBe(90);
  });

  it('값이 없는 요소는 감점하지 않고, 0점 아래로 내려가지 않는다', () => {
    expect(scoreHour(h(TODAY, 12, { reh: null, pop: null, tmp: null, wsd: null, sky: null })).score).toBe(100);
    expect(scoreHour(h(TODAY, 12, { pop: 60, reh: 90, tmp: 0, wsd: 10, sky: 4 })).score).toBe(0);
  });

  it('이불은 습도 감점 1.5배', () => {
    const s = scoreHour(h(TODAY, 12, { reh: 85 }), SCORING.activities.blanket.multipliers);
    expect(s.score).toBe(100 - 45 * 1.5);
  });
});

describe('실제 응답 패턴', () => {
  it('습도 85% 이상이면 맑고 바람이 적당해도 "아쉬워요" 이하', () => {
    expect(scoreHour(h(TODAY, 7, { reh: 85, pop: 20, sky: 1, wsd: 2 })).score).toBeLessThan(SCORING.verdictThresholds.okay);
  });

  it('06~08시 습도 85~90%, 강수확률 20~30% → 시각별 "아쉬워요" 이하', () => {
    const day = realisticDay(TODAY);
    for (const hour of [6, 7, 8]) {
      const s = scoreHour(day[hour]);
      expect(s.score, `${hour}시`).toBeLessThan(SCORING.verdictThresholds.okay);
    }
  });

  it('10~14시 습도 55~70%, 강수확률 0%, 맑음, 풍속 1.0~1.4 → "좋아요", 추천 10시~15시 근처', () => {
    const j = judge('laundry', realisticDay(TODAY), TODAY, { date: TODAY, hour: 7 });
    expect(j.verdict).toBe('good');
    expect(j.window).not.toBeNull();
    expect(j.window!.start).toBeGreaterThanOrEqual(9);
    expect(j.window!.start).toBeLessThanOrEqual(11);
    expect(j.window!.end).toBeGreaterThanOrEqual(14);
    expect(j.window!.end).toBeLessThanOrEqual(16);
    // 가장 건조한 11~14시는 반드시 포함
    expect(j.window!.start).toBeLessThanOrEqual(11);
    expect(j.window!.end).toBeGreaterThanOrEqual(15);
    expect(formatWindow(j.window)).toMatch(/^1[01]시~1[56]시$/);
  });
});

describe('빨래 판정', () => {
  it('오늘이면 지난 시각은 빼고 남은 시간으로 판정', () => {
    const day = flatDay(TODAY);
    // 오전만 좋고 오후는 비
    for (let hour = 13; hour < 24; hour++) day[hour] = h(TODAY, hour, { pty: 1, pop: 80 });
    expect(judge('laundry', day, TODAY, { date: TODAY, hour: 8 }).verdict).toBe('good');
    // 12시: 남은 시간은 있지만 비 때문에 연속 구간이 없음 → 늦었어요가 아니라 비추천
    const late = judge('laundry', day, TODAY, { date: TODAY, hour: 12 });
    expect(late.verdict).toBe('bad');
    expect(late.reason).toBeUndefined();
  });

  it('남은 낮 시간이 3시간 미만이면 비추천이 아니라 "늦었어요"(too-late)', () => {
    const j = judge('laundry', flatDay(TODAY), TODAY, { date: TODAY, hour: 16 });
    expect(j.verdict).toBeNull();
    expect(j.score).toBeNull();
    expect(j.reason).toBe('too-late');
    expect(verdictLabel(j)).toBe('늦었어요');
    expect(headline(j, false)).toBe('오늘은 빨래하기엔 늦었어요');
  });

  it('이불은 4시간이 필요해서 빨래보다 먼저 늦어진다', () => {
    const now = { date: TODAY, hour: 15 };
    expect(judge('laundry', flatDay(TODAY), TODAY, now).verdict).toBe('good');
    expect(judge('blanket', flatDay(TODAY), TODAY, now).reason).toBe('too-late');
  });

  it('세차는 늦은 시각이어도 비 소식이 있으면 비추천을 우선한다', () => {
    const hours = [...flatDay(TODAY), ...flatDay(TOMORROW, { pty: 1 })];
    expect(judge('carWash', hours, TODAY, { date: TODAY, hour: 17 }).verdict).toBe('bad');
    expect(judge('carWash', flatDay(TODAY), TODAY, { date: TODAY, hour: 17 }).reason).toBe('too-late');
  });

  it('하루 종일 비면 시간 부족이 아니라 그냥 비추천', () => {
    const j = judge('laundry', flatDay(TODAY, { pty: 1, pop: 80 }), TODAY, { date: TODAY, hour: 9 });
    expect(j.verdict).toBe('bad');
    expect(j.score).toBe(0);
    expect(j.reason).toBeUndefined();
    expect(headline(j, false)).toBe('오늘은 실내에서 말리는 게 좋아요');
  });

  it('해당 날짜 예보가 없으면 no-data', () => {
    const j = judge('laundry', flatDay(TODAY), TOMORROW, { date: TODAY, hour: 10 });
    expect(j.verdict).toBeNull();
    expect(j.reason).toBe('no-data');
  });

  it('점수 → 판정 경계값', () => {
    const cases: [Partial<HourlyForecast>, string][] = [
      [{ reh: 70 }, 'good'], // 80
      [{ reh: 70, sky: 3 }, 'okay'], // 75
      [{ pop: 30, reh: 70 }, 'meh'], // 50
      [{ pop: 50, reh: 70 }, 'bad'], // 30
    ];
    for (const [v, verdict] of cases) {
      expect(judge('laundry', flatDay(TOMORROW, v), TOMORROW, { date: TODAY, hour: 10 }).verdict).toBe(verdict);
    }
  });
});

describe('이불 판정', () => {
  it('4시간 연속 구간이 필요하다', () => {
    const day = flatDay(TOMORROW, { pty: 1 });
    for (const hour of [10, 11, 12]) day[hour] = h(TOMORROW, hour);
    const now = { date: TODAY, hour: 10 };
    expect(judge('laundry', day, TOMORROW, now).verdict).toBe('good');
    expect(judge('blanket', day, TOMORROW, now).verdict).toBe('bad');
  });

  it('습도가 높으면 빨래보다 낮게 나온다', () => {
    const day = flatDay(TOMORROW, { reh: 75 });
    const now = { date: TODAY, hour: 10 };
    expect(judge('laundry', day, TOMORROW, now).score).toBe(80);
    expect(judge('blanket', day, TOMORROW, now).score).toBe(70);
  });

  it('대표 점수는 가장 높은 평균, 추천 구간만 여유 있게 넓힌다', () => {
    const day = flatDay(TOMORROW, { pty: 1 });
    day[10] = h(TOMORROW, 10, { reh: 70 }); // 80점
    for (const hour of [11, 12, 13, 14]) day[hour] = h(TOMORROW, hour);
    const j = judge('laundry', day, TOMORROW, { date: TODAY, hour: 10 });
    expect(j.score).toBe(100);
    expect(formatWindow(j.window)).toBe('10시~15시');
  });
});

describe('세차 판정', () => {
  const now = { date: TODAY, hour: 9 };

  it('판정일~2일 뒤 사이 PTY ≠ 0 이면 비추천', () => {
    const hours = [...flatDay(TODAY), ...flatDay(TOMORROW), ...flatDay('20260928')];
    hours[24 + 24 + 20] = h('20260928', 20, { pty: 4 });
    const j = judge('carWash', hours, TODAY, now);
    expect(j.verdict).toBe('bad');
    expect(j.reason).toBe('rain-soon');
    expect(j.rainAt).toEqual({ date: '20260928', hour: 20 });
    expect(j.score).toBe(0);
  });

  it('강수확률 60% 이상 시각이 있으면 비추천', () => {
    const hours = [...flatDay(TODAY), ...flatDay(TOMORROW, { pop: 60 })];
    expect(judge('carWash', hours, TODAY, now).verdict).toBe('bad');
  });

  it('3일째 이후 비는 상관없고, 이미 지난 시각의 비도 무시', () => {
    const hours = [...flatDay(TODAY), ...flatDay(TOMORROW), ...flatDay('20260928'), ...flatDay('20260929', { pty: 1 })];
    hours[3] = h(TODAY, 3, { pty: 1 });
    const j = judge('carWash', hours, TODAY, now);
    expect(j.verdict).toBe('good');
    expect(j.score).toBe(100);
  });
});

describe('홈 기준 날짜', () => {
  it('15시(설정값)부터 내일 기준', () => {
    expect(SCORING.switchToTomorrowHour).toBe(15);
    expect(mainTargetDate({ date: TODAY, hour: 14 })).toEqual({ date: TODAY, isTomorrow: false });
    expect(mainTargetDate({ date: TODAY, hour: 15 })).toEqual({ date: TOMORROW, isTomorrow: true });
    expect(mainTargetDate({ date: TODAY, hour: 17 }, { ...SCORING, switchToTomorrowHour: 18 } as unknown as typeof SCORING)).toEqual({
      date: TODAY,
      isTomorrow: false,
    });
  });

  it('전환 직전(14시)에도 오늘 메인 판정은 "늦었어요"가 되지 않는다', () => {
    const now = { date: TODAY, hour: SCORING.switchToTomorrowHour - 1 };
    for (const a of ['laundry', 'blanket', 'carWash'] as const) {
      expect(judge(a, flatDay(TODAY), TODAY, now).reason).not.toBe('too-late');
    }
  });
  it('내일 판정 문구', () => {
    const j = judge('laundry', flatDay(TOMORROW), TOMORROW, { date: TODAY, hour: 19 });
    expect(headline(j, true)).toBe('내일은 빨래하기 딱 좋아요');
  });
});

describe('bestWindow', () => {
  const s = (scores: number[], startHour = 9) =>
    scores.map((score, i) => ({ ...scoreHour(h(TODAY, startHour + i)), score }));

  it('여유 범위 안이면 더 긴 구간을 고른다', () => {
    expect(bestWindow(s([80, 100, 100, 100, 100]), 3, 5)).toMatchObject({ startIdx: 0, endIdx: 4 });
    expect(bestWindow(s([40, 100, 100, 100, 40]), 3, 5)).toMatchObject({ startIdx: 1, endIdx: 3 });
  });
  it('비 예보 시각이 낀 구간은 후보가 아니다', () => {
    const scores = s([100, 100, 100, 100]);
    scores[3] = scoreHour(h(TODAY, 12, { pty: 1 }));
    expect(bestWindow(scores, 4, 5)).toBeNull();
    expect(bestWindow(scores, 3, 5)).toMatchObject({ startIdx: 0, endIdx: 2 });
  });

  it('시각이 끊긴 곳은 연속 구간으로 보지 않는다', () => {
    const scores = [...s([100, 100], 9), ...s([100, 100], 13)];
    expect(bestWindow(scores, 3, 5)).toBeNull();
  });
});
