import { SCORING, type ScoringConfig } from '../config/scoring';
import { addDays } from '../weather/kst';
import type { HourlyForecast } from '../weather/types';
import { PENALTY_RULES, type PenaltyRule } from './rules';

export type Activity = 'laundry' | 'blanket' | 'carWash';
export type Verdict = 'good' | 'okay' | 'meh' | 'bad';

export const VERDICT_LABEL: Record<Verdict, string> = {
  good: '좋아요',
  okay: '괜찮아요',
  meh: '아쉬워요',
  bad: '비추천',
};

/** 판정 대신 보여줄 상태 라벨 (verdict가 null인 경우) */
export const TOO_LATE_LABEL = '늦었어요';
export const NO_DATA_LABEL = '예보 없음';

export const ACTIVITY_LABEL: Record<Activity, string> = {
  laundry: '빨래',
  blanket: '이불 널기',
  carWash: '세차',
};

export interface Penalty {
  key: string;
  label: string;
  points: number;
}

export interface HourScore {
  date: string;
  hour: number;
  score: number;
  /** PTY ≠ 0 (비·눈 예보) */
  precipitation: boolean;
  penalties: Penalty[];
  forecast: HourlyForecast;
}

export type JudgeReason =
  /** 오늘 남은 낮 시간이 연속 N시간보다 짧음 → 판정 대신 "늦었어요" (verdict null) */
  | 'too-late'
  /** 세차: 판정일~N일 뒤 사이 비 예보 */
  | 'rain-soon'
  /** 해당 날짜 예보 없음 */
  | 'no-data';

export interface Judgement {
  activity: Activity;
  date: string;
  /** null이면 판정 불가 — reason이 'too-late'(늦었어요) 또는 'no-data' */
  verdict: Verdict | null;
  score: number | null;
  /** 추천 시간대 [start, end) — end는 "~end시" 표기용 */
  window: { start: number; end: number } | null;
  hourly: HourScore[];
  reason?: JudgeReason;
  /** 세차 rain-soon일 때 처음 비 예보가 있는 시각 */
  rainAt?: { date: string; hour: number };
}

/** 판정 기준 시각 (KST) */
export interface JudgeNow {
  /** YYYYMMDD */
  date: string;
  hour: number;
}

export function toVerdict(score: number, config: ScoringConfig = SCORING): Verdict {
  const t = config.verdictThresholds;
  if (score >= t.good) return 'good';
  if (score >= t.okay) return 'okay';
  if (score >= t.meh) return 'meh';
  return 'bad';
}

export function scoreHour(
  forecast: HourlyForecast,
  multipliers: Record<string, number> = {},
  config: ScoringConfig = SCORING,
  rules: readonly PenaltyRule[] = PENALTY_RULES,
): HourScore {
  const base = { date: forecast.date, hour: forecast.hour, forecast };
  if (forecast.pty !== null && forecast.pty !== 0) {
    return { ...base, score: 0, precipitation: true, penalties: [] };
  }
  const penalties: Penalty[] = [];
  for (const rule of rules) {
    const raw = rule.evaluate(forecast, config);
    if (raw > 0) penalties.push({ key: rule.key, label: rule.label, points: raw * (multipliers[rule.key] ?? 1) });
  }
  const total = penalties.reduce((sum, p) => sum + p.points, 0);
  return { ...base, score: Math.max(0, Math.min(100, 100 - total)), precipitation: false, penalties };
}

/** 판정일의 낮 시간대 슬롯. 오늘이면 이미 지난 시각은 뺀다. */
function daySlots(hours: HourlyForecast[], date: string, now: JudgeNow, config: ScoringConfig) {
  const { start, end } = config.dayHours;
  const from = date === now.date ? Math.max(start, now.hour) : start;
  return hours.filter((h) => h.date === date && h.hour >= from && h.hour < end);
}

/**
 * 연속 minLen시간 이상 구간 중 평균이 가장 높은 구간.
 * - best: 대표 점수 = 가장 높은 평균
 * - window: 추천 시간대 = 최고 평균 - tolerance 이상인 구간 중 가장 긴 것
 *   (같으면 평균 높은 쪽, 그다음 이른 쪽). 점수는 그대로 두고 추천 구간만 넓게 잡는다.
 * 비·눈 예보(PTY ≠ 0) 시각이 끼어 있는 구간은 후보에서 뺀다 — 널어둔 빨래가 젖는다.
 */
export function bestWindow(
  scores: HourScore[],
  minLen: number,
  tolerance: number,
): { startIdx: number; endIdx: number; best: number } | null {
  type W = { startIdx: number; endIdx: number; average: number };
  const windows: W[] = [];
  for (let i = 0; i < scores.length; i++) {
    let sum = 0;
    for (let j = i; j < scores.length; j++) {
      // 시각이 끊기면(데이터 누락) 연속 구간이 아니다
      if (j > i && scores[j].hour !== scores[j - 1].hour + 1) break;
      if (scores[j].precipitation) break;
      sum += scores[j].score;
      const len = j - i + 1;
      if (len >= minLen) windows.push({ startIdx: i, endIdx: j, average: sum / len });
    }
  }
  if (windows.length === 0) return null;
  const best = Math.max(...windows.map((w) => w.average));
  const len = (w: W) => w.endIdx - w.startIdx;
  const chosen = windows
    .filter((w) => w.average >= best - tolerance)
    .sort((a, b) => len(b) - len(a) || b.average - a.average || a.startIdx - b.startIdx)[0];
  return { startIdx: chosen.startIdx, endIdx: chosen.endIdx, best };
}

function judgeDrying(
  activity: 'laundry' | 'blanket',
  hours: HourlyForecast[],
  date: string,
  now: JudgeNow,
  config: ScoringConfig,
): Judgement {
  const { minWindowHours, multipliers } = config.activities[activity];
  const slots = daySlots(hours, date, now, config);
  const hourly = slots.map((h) => scoreHour(h, multipliers, config));
  const base = { activity, date, hourly };

  const hasAnyForDate = hours.some((h) => h.date === date);
  if (!hasAnyForDate) return { ...base, verdict: null, score: null, window: null, reason: 'no-data' };

  const w = bestWindow(hourly, minWindowHours, config.windowTolerance);
  // 남은 낮 시간 자체가 짧으면 "비추천"이 아니라 "늦었어요" — 날씨가 나빠서가 아니다
  if (hourly.length < minWindowHours) {
    return { ...base, verdict: null, score: null, window: null, reason: 'too-late' };
  }
  // 시간은 있는데 비 때문에 연속 구간이 없으면 비추천
  if (!w) return { ...base, verdict: 'bad', score: 0, window: null };

  const score = Math.round(w.best);
  const verdict = toVerdict(score, config);
  return {
    ...base,
    verdict,
    score,
    // 비추천이면 추천 시간대를 보여주지 않는다
    window: verdict === 'bad' ? null : { start: hourly[w.startIdx].hour, end: hourly[w.endIdx].hour + 1 },
  };
}

function judgeCarWash(hours: HourlyForecast[], date: string, now: JudgeNow, config: ScoringConfig): Judgement {
  const { lookaheadDays, rainPopAtLeast } = config.activities.carWash;
  const lastDate = addDays(date, lookaheadDays);
  const rainy = hours.find(
    (h) =>
      h.date >= date &&
      h.date <= lastDate &&
      !(h.date === now.date && h.hour < now.hour) &&
      ((h.pty !== null && h.pty !== 0) || (h.pop !== null && h.pop >= rainPopAtLeast)),
  );
  const drying = judgeDrying('laundry', hours, date, now, config);
  const result: Judgement = { ...drying, activity: 'carWash' };
  if (rainy) {
    return {
      ...result,
      verdict: 'bad',
      score: 0,
      window: null,
      reason: 'rain-soon',
      rainAt: { date: rainy.date, hour: rainy.hour },
    };
  }
  return result;
}

export function judge(
  activity: Activity,
  hours: HourlyForecast[],
  date: string,
  now: JudgeNow,
  config: ScoringConfig = SCORING,
): Judgement {
  return activity === 'carWash'
    ? judgeCarWash(hours, date, now, config)
    : judgeDrying(activity, hours, date, now, config);
}

/** 판정 배지 라벨: 판정이 있으면 좋아요~비추천, 없으면 늦었어요/예보 없음 */
export function verdictLabel(j: Pick<Judgement, 'verdict' | 'reason'>): string {
  if (j.verdict) return VERDICT_LABEL[j.verdict];
  return j.reason === 'too-late' ? TOO_LATE_LABEL : NO_DATA_LABEL;
}

/** 홈 메인 판정 날짜: switchToTomorrowHour(15시) 이후면 내일 */
export function mainTargetDate(now: JudgeNow, config: ScoringConfig = SCORING): { date: string; isTomorrow: boolean } {
  return now.hour >= config.switchToTomorrowHour
    ? { date: addDays(now.date, 1), isTomorrow: true }
    : { date: now.date, isTomorrow: false };
}

/** 상단 한 문장 */
export function headline(j: Judgement, isTomorrow: boolean): string {
  const day = isTomorrow ? '내일' : '오늘';
  if (j.reason === 'too-late') return '오늘은 빨래하기엔 늦었어요';
  if (j.reason === 'no-data' || j.verdict === null) return `${day} 예보를 아직 받지 못했어요`;
  switch (j.verdict) {
    case 'good':
      return `${day}은 빨래하기 딱 좋아요`;
    case 'okay':
      return `${day}은 빨래해도 괜찮아요`;
    case 'meh':
      return `${day}은 빨래가 잘 안 마를 수 있어요`;
    case 'bad':
      return `${day}은 실내에서 말리는 게 좋아요`;
  }
}

export function formatWindow(window: { start: number; end: number } | null): string | null {
  return window ? `${window.start}시~${window.end}시` : null;
}
