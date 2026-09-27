/**
 * 연차 추천·연휴 계산 설정. 튜닝은 이 파일의 값만 바꾼다.
 * (알고리즘은 src/lib/recommend.ts·calendar.ts, 여기엔 "수치"만 둔다)
 * 노동절(5/1)은 공휴일 API가 공휴일로 주므로 따로 설정하지 않는다.
 */
export const plannerConfig = {
  maxLeaveDays: 3, // 추천 탭 1~3개
  resultsPerTab: 5, // 탭당 추천 수
  minTotalDays: 3, // 이보다 짧은 연휴는 추천 안 함
  weekendDays: [0, 6], // 일, 토
};

export type PlannerConfig = typeof plannerConfig;
