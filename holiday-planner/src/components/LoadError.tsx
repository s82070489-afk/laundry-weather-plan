/** 공휴일을 못 불러왔을 때(기기에 남은 데이터도 없음) — 재시도 버튼 */
export default function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="load-error card">
      <p className="load-error-title">공휴일 정보를 불러오지 못했어요</p>
      <p className="load-error-sub">잠시 후 다시 시도해주세요</p>
      <button type="button" className="retry-button" onClick={onRetry}>
        다시 불러오기
      </button>
    </div>
  );
}
