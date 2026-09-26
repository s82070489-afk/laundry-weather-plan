import { addDays, toKst } from '../lib/kst';
import type { ProxyRoute } from '../lib/types';

const ENDPOINT = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
const PAGE_SIZE = 1000;

interface KmaEnvelope {
  response: {
    header: unknown;
    body: { items?: { item?: unknown[] | unknown }; totalCount?: number; numOfRows?: number; pageNo?: number; [k: string]: unknown };
  };
}

const itemsOf = (json: unknown): unknown[] => {
  const item = (json as KmaEnvelope)?.response?.body?.items?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
};
const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];
const AVAILABLE_AFTER_MINUTES = 10;

/**
 * 조회 가능한 발표시각을 최신순으로 n개. (앱의 src/weather/baseTime.ts와 같은 규칙)
 * 00:00~02:09는 전날 23시 발표가 최신.
 */
export function recentBaseTimes(now: Date, count: number): { baseDate: string; baseTime: string }[] {
  const { date, hour, minute } = toKst(now);
  const minutesOfDay = hour * 60 + minute;
  const result: { baseDate: string; baseTime: string }[] = [];
  let day = date;
  let idx = BASE_HOURS.findLastIndex((h) => minutesOfDay >= h * 60 + AVAILABLE_AFTER_MINUTES);
  if (idx < 0) {
    day = addDays(date, -1);
    idx = BASE_HOURS.length - 1;
  }
  while (result.length < count) {
    result.push({ baseDate: day, baseTime: `${String(BASE_HOURS[idx]).padStart(2, '0')}00` });
    idx -= 1;
    if (idx < 0) {
      day = addDays(day, -1);
      idx = BASE_HOURS.length - 1;
    }
  }
  return result;
}

function parseGridCoord(value: string | null, max: number): string | null {
  if (!value || !/^\d{1,3}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= max ? String(n) : null;
}

/** 기상청 단기예보 조회 (getVilageFcst). 클라이언트는 nx, ny만 보내고 발표시각은 Worker가 계산한다. */
export const kmaVilageFcstRoute: ProxyRoute = {
  path: '/kma/vilage-fcst',
  secretName: 'KMA_SERVICE_KEY',

  parseParams(query) {
    const nx = parseGridCoord(query.get('nx'), 149);
    const ny = parseGridCoord(query.get('ny'), 253);
    if (!nx || !ny) return 'nx(1~149), ny(1~253) 격자 좌표가 필요해요';
    return { nx, ny };
  },

  cacheKey: ({ nx, ny }) => `kma-vilage-fcst:${nx}:${ny}`,

  candidates({ nx, ny }, serviceKey, now) {
    // 발표 직후엔 최신 발표분이 아직 없을 수 있어(NO_DATA) 직전 발표분까지 시도한다
    return recentBaseTimes(now, 2).map(({ baseDate, baseTime }) => {
      const params = new URLSearchParams({
        serviceKey,
        pageNo: '1',
        numOfRows: String(PAGE_SIZE),
        dataType: 'JSON',
        base_date: baseDate,
        base_time: baseTime,
        nx,
        ny,
      });
      return { version: `${baseDate}${baseTime}`, url: `${ENDPOINT}?${params.toString()}` };
    });
  },

  check(json) {
    const header = (json as { response?: { header?: { resultCode?: string; resultMsg?: string } } })?.response
      ?.header;
    if (header?.resultCode === '00') return { ok: true };
    return { ok: false, code: header?.resultCode ?? 'INVALID_RESPONSE', message: header?.resultMsg ?? '' };
  },

  errorLabels: {
    '03': 'NO_DATA',
    '22': 'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS (일일 한도 초과)',
    '30': 'SERVICE_KEY_IS_NOT_REGISTERED (미등록 키)',
  },

  // 발표시각에 따라 1000건을 넘을 수 있어(글피까지 1시간 단위) 나머지 페이지도 받아 합친다
  pagination: {
    pageSize: PAGE_SIZE,
    maxPages: 3,
    totalCount: (json) => Number((json as KmaEnvelope)?.response?.body?.totalCount ?? 0),
    pageUrl(url, pageNo) {
      const u = new URL(url);
      u.searchParams.set('pageNo', String(pageNo));
      return u.toString();
    },
    merge(pages) {
      const first = pages[0] as KmaEnvelope;
      const item = pages.flatMap(itemsOf);
      return {
        ...first,
        response: {
          ...first.response,
          body: { ...first.response.body, items: { item }, numOfRows: item.length, pageNo: 1 },
        },
      };
    },
  },

  // 단기예보는 글피까지 오므로 최대 3일간 "마지막 정상 응답"으로 쓸 만하다
  retentionSeconds: 3 * 24 * 60 * 60,
};
