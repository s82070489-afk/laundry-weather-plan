import { verdictLabel, type Judgement } from '../scoring/judge';

/**
 * 판정 배지 — 블루 단일 액센트: 좋아요(진한 블루) > 괜찮아요(연한 블루) > 아쉬워요·비추천(그레이).
 * 판정이 없으면(늦었어요/예보 없음) 테두리만 있는 그레이 배지.
 */
export default function VerdictBadge({ judgement }: { judgement: Pick<Judgement, 'verdict' | 'reason'> }) {
  const tone = judgement.verdict ?? 'unknown';
  return <span className={`verdict-badge is-${tone}`}>{verdictLabel(judgement)}</span>;
}
