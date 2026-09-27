import { toKst } from '../lib/kst';
import type { ProxyRoute } from '../lib/types';
import { parseXml } from '../lib/xml';

const ENDPOINT = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
/** 저장 후 이 시간 동안은 업스트림을 다시 부르지 않는다(HIT). 임시공휴일 지정은 최대 하루 늦게 반영된다 */
const FRESH_MS = 24 * 60 * 60 * 1000;

export interface Holiday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
}

/** 앱에 주는 응답 본문. cache(HIT/MISS/STALE)는 응답할 때 붙인다 */
export interface HolidaysBody {
  year: number;
  holidays: Holiday[];
  /** 한국천문연구원 API에서 받은 시각 (ISO, UTC) */
  fetchedAt: string;
}

/** _type=json으로 요청해도 XML(특히 인증 오류)이 올 수 있어 둘 다 같은 모양으로 읽는다 */
export function parseJsonOrXml(text: string): unknown {
  const trimmed = text.replace(/^﻿/, '').trim();
  return trimmed.startsWith('<') ? parseXml(trimmed) : JSON.parse(trimmed);
}

/** 20261003(숫자·문자열) → "2026-10-03". 형식이 다르면 null */
export function toIsoDate(locdate: unknown): string | null {
  const s = String(locdate ?? '').trim();
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null;
}

/** response.body.items.item — 여러 건이면 배열, 1건이면 객체, 0건이면 items가 빈 문자열 → 항상 배열 */
export function holidayItems(json: unknown): unknown[] {
  const items = (json as { response?: { body?: { items?: unknown } } })?.response?.body?.items;
  if (!items || typeof items !== 'object') return [];
  const item = (items as { item?: unknown }).item;
  if (item === undefined || item === null || item === '') return [];
  return Array.isArray(item) ? item : [item];
}

/** 공휴일(isHoliday === "Y")만 날짜순으로. 같은 날짜·같은 이름 중복은 하나로 (한 날짜에 이름이 둘이면 둘 다 둔다) */
export function normalizeHolidays(json: unknown, year: number, now: Date): HolidaysBody {
  const seen = new Set<string>();
  const holidays: Holiday[] = [];
  for (const raw of holidayItems(json)) {
    const it = raw as { isHoliday?: unknown; locdate?: unknown; dateName?: unknown } | null;
    if (it?.isHoliday !== 'Y') continue;
    const date = toIsoDate(it.locdate);
    const name = String(it.dateName ?? '').trim();
    if (!date || !name || seen.has(`${date}|${name}`)) continue;
    seen.add(`${date}|${name}`);
    holidays.push({ date, name });
  }
  holidays.sort((a, b) => a.date.localeCompare(b.date));
  return { year, holidays, fetchedAt: now.toISOString() };
}

interface HolidayEnvelope {
  response?: { header?: { resultCode?: unknown; resultMsg?: unknown } };
  OpenAPI_ServiceResponse?: {
    cmmMsgHeader?: { errMsg?: unknown; returnAuthMsg?: unknown; returnReasonCode?: unknown };
  };
}

/**
 * 한국천문연구원 특일 정보 — 공휴일 정보 조회(getRestDeInfo). 연 단위(solMonth 생략)로 받는다.
 * 요청: GET /holidays?year=2026 (KST 기준 올해-1 ~ 올해+1만)
 * 응답: { year, holidays: [{ date, name }], fetchedAt, cache }
 */
export const holidaysRoute: ProxyRoute = {
  path: '/holidays',
  secretName: 'HOLIDAY_SERVICE_KEY',

  parseParams(query, now) {
    const current = Number(toKst(now).date.slice(0, 4));
    const raw = query.get('year') ?? '';
    const year = /^\d{4}$/.test(raw) ? Number(raw) : NaN;
    if (!(year >= current - 1 && year <= current + 1)) {
      return `year는 ${current - 1}~${current + 1}만 조회할 수 있어요`;
    }
    return { year: String(year) };
  },

  cacheKey: ({ year }) => `holidays:${year}`,

  candidates({ year }, serviceKey, now) {
    const params = new URLSearchParams({ serviceKey, pageNo: '1', numOfRows: '100', solYear: year, _type: 'json' });
    // 발표 버전이 없는 데이터라 받은 시각을 버전으로 쓴다 (신선도는 isFresh의 24시간)
    return [{ version: now.toISOString(), url: `${ENDPOINT}?${params.toString()}` }];
  },

  parseBody: parseJsonOrXml,

  check(json) {
    const envelope = json as HolidayEnvelope;
    const header = envelope?.response?.header;
    if (header?.resultCode === '00') return { ok: true };
    // 인증 오류 등은 <OpenAPI_ServiceResponse><cmmMsgHeader>로 온다 (returnReasonCode = 30 등)
    const cmm = envelope?.OpenAPI_ServiceResponse?.cmmMsgHeader;
    if (cmm) {
      return {
        ok: false,
        code: String(cmm.returnReasonCode ?? 'UNKNOWN'),
        message: String(cmm.returnAuthMsg ?? cmm.errMsg ?? ''),
      };
    }
    return {
      ok: false,
      code: header?.resultCode === undefined ? 'INVALID_RESPONSE' : String(header.resultCode),
      message: String(header?.resultMsg ?? ''),
    };
  },

  errorLabels: {
    '12': 'NO_OPENAPI_SERVICE_ERROR (없는 서비스)',
    '20': 'SERVICE_ACCESS_DENIED_ERROR (활용신청 안 됨/승인 전)',
    '22': 'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS (일일 한도 초과)',
    '30': 'SERVICE_KEY_IS_NOT_REGISTERED (미등록 키)',
    '31': 'DEADLINE_HAS_EXPIRED (활용기간 만료)',
  },

  normalize: (json, { year }, now) => normalizeHolidays(json, Number(year), now),

  // 0건(내년 공휴일 발표 전)은 저장하지 않아 발표되면 바로 반영된다
  shouldCache: (body) => (body as HolidaysBody).holidays.length > 0,

  isFresh: (entry, now) => now.getTime() - entry.savedAt < FRESH_MS,

  renderBody(body, cache) {
    try {
      return JSON.stringify({ ...(JSON.parse(body) as HolidaysBody), cache });
    } catch {
      // 저장본이 깨졌어도 Worker 예외(CORS 없는 500) 대신 그대로 준다 — 앱은 형식 오류로 처리
      return body;
    }
  },

  // 한 해 치 공휴일은 그해 내내 유효하니 원본이 오래 실패해도 쓸 수 있게 길게 보관한다
  retentionSeconds: 400 * 24 * 60 * 60,
};
