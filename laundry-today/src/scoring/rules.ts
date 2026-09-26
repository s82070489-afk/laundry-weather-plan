import type { ScoringConfig } from '../config/scoring';
import type { HourlyForecast } from '../weather/types';

/**
 * 시각별 감점 규칙. 새 요소(예: v1.1 미세먼지)는 HourlyForecast에 값을 추가하고
 * 여기 PENALTY_RULES에 규칙 하나를 더하면 된다. 수치는 config/scoring.ts에 둔다.
 */
export interface PenaltyRule {
  /** 활동별 multipliers의 키로도 쓰인다 */
  key: string;
  label: string;
  /** 감점(양수). 값이 없거나 해당 없음이면 0 */
  evaluate(hour: HourlyForecast, config: ScoringConfig): number;
}

function firstMatch<T>(list: readonly T[], predicate: (item: T) => boolean): T | undefined {
  return list.find(predicate);
}

export const PENALTY_RULES: readonly PenaltyRule[] = [
  {
    key: 'pop',
    label: '강수확률',
    evaluate: ({ pop }, c) =>
      pop === null ? 0 : (firstMatch(c.penalties.pop, (r) => pop >= r.atLeast)?.points ?? 0),
  },
  {
    key: 'reh',
    label: '습도',
    evaluate: ({ reh }, c) =>
      reh === null ? 0 : (firstMatch(c.penalties.reh, (r) => reh >= r.atLeast)?.points ?? 0),
  },
  {
    key: 'tmp',
    label: '기온',
    evaluate: ({ tmp }, c) =>
      tmp === null ? 0 : (firstMatch(c.penalties.tmp, (r) => tmp < r.below)?.points ?? 0),
  },
  {
    key: 'wsd',
    label: '바람',
    evaluate: ({ wsd }, c) => {
      if (wsd === null) return 0;
      const { tooCalm, tooWindy } = c.penalties.wsd;
      if (wsd >= tooWindy.atLeast) return tooWindy.points;
      if (wsd < tooCalm.below) return tooCalm.points;
      return 0;
    },
  },
  {
    key: 'sky',
    label: '하늘',
    evaluate: ({ sky }, c) => (sky === null ? 0 : (c.penalties.sky[sky] ?? 0)),
  },
];
