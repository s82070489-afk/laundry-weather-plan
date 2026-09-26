import type { ForecastData, HourlyForecast, KmaForecastItem, PtyCode, SkyCode } from './types';

export class KmaApiError extends Error {
  readonly resultCode: string;
  constructor(resultCode: string, resultMsg: string) {
    super(`기상청 API 오류: ${resultMsg} (${resultCode})`);
    this.resultCode = resultCode;
  }
}

/** 로그에서 구분하기 위한 주요 에러코드 */
export const KMA_ERROR_LABELS: Record<string, string> = {
  '03': 'NO_DATA (발표 직후 데이터 미생성 등)',
  '22': 'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS (일일 한도 초과)',
  '30': 'SERVICE_KEY_IS_NOT_REGISTERED (미등록 키)',
};

/** "12.5" → 12.5, "강수없음"/"-"/"" 등 숫자가 아니면 null */
function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value.trim());
  return Number.isFinite(n) && value.trim() !== '' ? n : null;
}

function toSky(value: string | undefined): SkyCode | null {
  const n = toNumber(value);
  return n === 1 || n === 3 || n === 4 ? n : null;
}

function toPty(value: string | undefined): PtyCode | null {
  const n = toNumber(value);
  return n === 0 || n === 1 || n === 2 || n === 3 || n === 4 ? n : null;
}

/**
 * 기상청 응답 envelope에서 item[]을 꺼낸다. resultCode가 "00"이 아니면 KmaApiError.
 * (PCP/SNO는 "강수없음" 같은 문자열이 와서 판정에 쓰지 않는다)
 */
export function extractKmaItems(json: unknown): KmaForecastItem[] {
  const response = (json as { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: unknown } })
    ?.response;
  const resultCode = response?.header?.resultCode;
  if (resultCode !== '00') {
    throw new KmaApiError(resultCode ?? 'UNKNOWN', response?.header?.resultMsg ?? '알 수 없는 응답');
  }
  const item = (response?.body as { items?: { item?: KmaForecastItem[] | KmaForecastItem } } | undefined)?.items?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

/** 원본 항목들을 (날짜, 시각)별로 모아 시간순 HourlyForecast[]로 만든다. */
export function toHourly(items: KmaForecastItem[]): HourlyForecast[] {
  const byKey = new Map<string, Record<string, string>>();
  for (const it of items) {
    const key = `${it.fcstDate}${it.fcstTime}`;
    const bucket = byKey.get(key) ?? {};
    bucket[it.category] = it.fcstValue;
    byKey.set(key, bucket);
  }

  return [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      date: key.slice(0, 8),
      hour: Number(key.slice(8, 10)),
      tmp: toNumber(v.TMP),
      reh: toNumber(v.REH),
      pop: toNumber(v.POP),
      wsd: toNumber(v.WSD),
      sky: toSky(v.SKY),
      pty: toPty(v.PTY),
    }));
}

export function parseForecast(json: unknown, nx: number, ny: number): ForecastData {
  const items = extractKmaItems(json);
  if (items.length === 0) throw new KmaApiError('03', '예보 데이터가 비어 있어요');
  return {
    baseDate: items[0].baseDate,
    baseTime: items[0].baseTime,
    nx,
    ny,
    hours: toHourly(items),
  };
}
