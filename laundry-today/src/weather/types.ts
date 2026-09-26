/** 기상청 단기예보 원본 항목 (response.body.items.item[]) */
export interface KmaForecastItem {
  baseDate: string;
  baseTime: string;
  category: string;
  fcstDate: string;
  fcstTime: string;
  fcstValue: string;
  nx: number;
  ny: number;
}

/** SKY 하늘상태: 1 맑음, 3 구름많음, 4 흐림 */
export type SkyCode = 1 | 3 | 4;
/** PTY 강수형태: 0 없음, 1 비, 2 비/눈, 3 눈, 4 소나기 */
export type PtyCode = 0 | 1 | 2 | 3 | 4;

/** 한 시각의 판정용 예보값. 값이 안 온 카테고리는 null. */
export interface HourlyForecast {
  /** YYYYMMDD */
  date: string;
  /** 0~23 */
  hour: number;
  tmp: number | null;
  reh: number | null;
  pop: number | null;
  wsd: number | null;
  sky: SkyCode | null;
  pty: PtyCode | null;
}

export interface ForecastData {
  baseDate: string;
  baseTime: string;
  nx: number;
  ny: number;
  hours: HourlyForecast[];
}
