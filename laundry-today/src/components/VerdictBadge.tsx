import { VERDICT_LABEL, type Verdict } from '../scoring/judge';

/** 판정 배지 — 블루 단일 액센트: 좋아요(진한 블루) > 괜찮아요(연한 블루) > 아쉬워요·비추천(그레이) */
export default function VerdictBadge({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return <span className="verdict-badge is-unknown">확인 중</span>;
  return <span className={`verdict-badge is-${verdict}`}>{VERDICT_LABEL[verdict]}</span>;
}
