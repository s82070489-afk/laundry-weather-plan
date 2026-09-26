import { SCORING, type ScoringConfig } from '../config/scoring';
import type { HourScore, Judgement } from './judge';

/**
 * 홈 헤드라인 아래 "판정 이유" 한 줄. 가장 큰 감점 요인을 기준으로 고른다.
 * - 판정 시간대에 비 예보가 있으면 비를 가장 먼저 알린다 ("내일 오후에 비 소식이 있어요")
 * - 그 외엔 추천 구간(없으면 판정 시간대 전체)에서 감점 합이 가장 큰 요소
 * - 좋아요·괜찮아요는 부드러운 문장, 아쉬워요·비추천은 분명한 문장
 */
export function reasonText(j: Judgement, dayLabel: string, config: ScoringConfig = SCORING): string | null {
  if (j.reason === 'no-data') return null;
  if (j.reason === 'too-late') return '남은 낮 시간이 짧아 널어도 다 마르기 어려워요';

  const rainy = j.hourly.find((h) => h.precipitation);
  if (rainy) return `${dayLabel} ${periodOf(rainy.hour)}에 비 소식이 있어요`;

  const hours = j.window ? j.hourly.filter((h) => h.hour >= j.window!.start && h.hour < j.window!.end) : j.hourly;
  const top = topPenalty(hours);
  const mild = j.verdict === 'good' || j.verdict === 'okay';
  // 100점이면 추천 구간 가장자리에 작은 감점이 있어도 핵심 시간대는 완벽하다
  if (!top || j.score === 100) return '맑고 건조해서 잘 말라요';

  switch (top) {
    case 'reh':
      return mild ? '습도가 조금 높은 편이에요' : '습도가 높아 잘 안 말라요';
    case 'pop':
      return mild ? '비 올 가능성이 조금 있어요' : '비 올 가능성이 높아요';
    case 'tmp':
      return mild ? '기온이 낮아 조금 천천히 말라요' : '기온이 낮아 잘 안 말라요';
    case 'wsd': {
      const windy = hours.some((h) => (h.forecast.wsd ?? 0) >= config.penalties.wsd.tooWindy.atLeast);
      if (windy) return '바람이 강해 빨래가 날릴 수 있어요';
      return mild ? '바람이 약해 조금 천천히 말라요' : '바람이 거의 없어 잘 안 말라요';
    }
    case 'sky':
      return mild ? '구름이 끼어 햇볕이 약한 편이에요' : '흐려서 햇볕이 부족해요';
    default:
      return null;
  }
}

function periodOf(hour: number): string {
  if (hour < 12) return '오전';
  if (hour < 18) return '오후';
  return '저녁';
}

/** 시각들의 감점을 요소별로 합쳐 가장 큰 요소 key (감점이 없으면 null) */
function topPenalty(hours: HourScore[]): string | null {
  const totals = new Map<string, number>();
  for (const h of hours) for (const p of h.penalties) totals.set(p.key, (totals.get(p.key) ?? 0) + p.points);
  let best: string | null = null;
  let max = 0;
  for (const [key, sum] of totals) {
    if (sum > max) {
      max = sum;
      best = key;
    }
  }
  return best;
}
