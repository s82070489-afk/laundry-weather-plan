/**
 * 판정 기준값. 체감과 비교하며 튜닝할 때는 이 파일의 숫자만 바꾼다.
 * (감점 규칙의 "동작"은 src/scoring/rules.ts, 여기엔 "수치"만 둔다)
 */
export const SCORING = {
  /** 판정에 쓰는 낮 시간대: start시 ~ end시 (end 미포함 → 09~17시 슬롯, 18시에 끝) */
  dayHours: { start: 9, end: 18 },

  /** 18시 이후에 열면 홈 메인 판정을 내일 기준으로 */
  switchToTomorrowHour: 18,

  penalties: {
    /** 강수확률(%) — 높은 기준부터 검사, 처음 맞는 것 하나만 적용 */
    pop: [
      { atLeast: 50, points: 50 },
      { atLeast: 30, points: 30 },
    ],
    /** 습도(%) */
    reh: [
      { atLeast: 85, points: 35 },
      { atLeast: 70, points: 20 },
    ],
    /** 기온(°C) — below 미만이면 감점 */
    tmp: [
      { below: 5, points: 25 },
      { below: 10, points: 15 },
    ],
    /** 풍속(m/s) */
    wsd: {
      tooCalm: { below: 1, points: 10 }, // 건조 느림
      tooWindy: { atLeast: 9, points: 15 }, // 날림
    },
    /** 하늘상태 SKY 코드별 감점 (1 맑음, 3 구름많음, 4 흐림) */
    sky: { 1: 0, 3: 5, 4: 10 } as Record<number, number>,
  },

  activities: {
    laundry: {
      /** 대표 점수 = 연속 N시간 이상 구간 중 가장 높은 평균 */
      minWindowHours: 3,
      /** 요소별 감점 배수 (rules.ts의 key 기준) */
      multipliers: {} as Record<string, number>,
    },
    blanket: {
      minWindowHours: 4,
      multipliers: { reh: 1.5 } as Record<string, number>,
    },
    carWash: {
      /** 판정일 + 이후 N일 */
      lookaheadDays: 2,
      /** 이 강수확률 이상인 시각이 있으면 비추천 (PTY ≠ 0 도 비추천) */
      rainPopAtLeast: 60,
    },
  },

  /**
   * 추천 시간대 선택 여유(점). 최고 평균에서 이만큼 낮은 구간까지는 "같은 수준"으로 보고
   * 그중 가장 긴 구간을 추천한다. (100,100,100 vs 80,100,100,100,100 같은 경우 긴 쪽)
   */
  windowTolerance: 5,

  /** 점수 → 판정 */
  verdictThresholds: { good: 80, okay: 60, meh: 40 },
} as const;

export type ScoringConfig = typeof SCORING;
