export interface Env {
  PROXY_CACHE: KVNamespace;
  ALLOW_DEV_ORIGINS?: string;
  /** 라우트별 서비스키 등 비밀값 (wrangler secret put <이름>) */
  [secretName: string]: unknown;
}

export type ProxyCacheStatus = 'HIT' | 'MISS' | 'STALE';

/** 업스트림 호출 후보. version이 클수록 최신 (문자열 비교). */
export interface UpstreamCandidate {
  version: string;
  url: string;
}

export type UpstreamCheck = { ok: true } | { ok: false; code: string; message: string };

/**
 * 공공데이터 API 하나 = 라우트 하나. 새 API는 이 인터페이스를 구현해 routes/index.ts에 등록한다.
 * 선택 항목(parseBody·normalize·shouldCache·isFresh·renderBody)을 비워 두면 업스트림 원본을
 * 그대로 저장·응답하고, 신선도는 version 비교로 판단한다 (기상청 단기예보 라우트가 이 방식).
 */
export interface ProxyRoute {
  /** 예: "/kma/vilage-fcst" */
  path: string;
  /** 서비스키가 들어 있는 Worker 비밀값 이름 */
  secretName: string;
  /** 쿼리 검증. 허용한 파라미터만 업스트림으로 넘긴다. 잘못되면 에러 메시지 문자열. */
  parseParams(query: URLSearchParams, now: Date): Record<string, string> | string;
  /** 캐시 키 (파라미터 단위). 버전과 별개로 "마지막 정상 응답"을 이 키에 보관한다. */
  cacheKey(params: Record<string, string>): string;
  /** 시도할 업스트림 요청 목록. 첫 번째가 현재 기대하는 최신 버전. */
  candidates(params: Record<string, string>, serviceKey: string, now: Date): UpstreamCandidate[];
  /** 업스트림 JSON이 정상인지 (공공데이터포털은 HTTP 200에 resultCode로 에러를 준다) */
  check(json: unknown): UpstreamCheck;
  /** 에러코드별 로그 라벨 */
  errorLabels?: Record<string, string>;
  /** "마지막 정상 응답" 보관 기간(초). KV 만료. */
  retentionSeconds: number;
  /** 한 페이지에 다 안 오는 API면 나머지 페이지까지 받아 하나로 합친다 */
  pagination?: RoutePagination;

  /** 응답 본문 파싱. 기본은 JSON.parse. JSON으로 요청해도 XML이 오는 API는 여기서 같은 모양으로 바꾼다. 실패하면 throw */
  parseBody?(text: string): unknown;
  /** 업스트림 응답을 앱에 줄 모양으로 정규화한다. 저장·응답은 이 결과의 JSON. 없으면 원본 그대로 */
  normalize?(json: unknown, params: Record<string, string>, now: Date): unknown;
  /**
   * false면 저장하지 않는다(예: 아직 발표 전이라 0건). 저장해 둔 이전 정상 응답이 있으면
   * 새 응답 대신 그걸 STALE로 주고, 없으면 새 응답을 저장 없이 MISS로 준다.
   */
  shouldCache?(body: unknown): boolean;
  /** 캐시가 아직 신선한지(HIT). 기본은 cached.version >= candidates[0].version. 발표 버전이 없는 데이터는 저장 시각으로 판단 */
  isFresh?(entry: CachedEntry, now: Date): boolean;
  /** 응답 직전에 본문을 다듬는다(예: 캐시 상태를 본문에 넣기). 저장된 본문은 그대로 */
  renderBody?(body: string, cache: ProxyCacheStatus): string;
}

export interface RoutePagination {
  /** 한 페이지 크기 (요청 URL의 numOfRows와 같게) */
  pageSize: number;
  /** 최대 페이지 수 (한도 보호) */
  maxPages: number;
  /** 첫 페이지 응답에서 전체 건수 */
  totalCount(json: unknown): number;
  /** 같은 요청의 n번째 페이지 URL */
  pageUrl(url: string, pageNo: number): string;
  /** 페이지 응답들(순서대로)을 하나의 응답으로 */
  merge(pages: unknown[]): unknown;
}

export interface CachedEntry {
  version: string;
  savedAt: number;
  body: string;
}
