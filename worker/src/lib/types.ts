export interface Env {
  PROXY_CACHE: KVNamespace;
  ALLOW_DEV_ORIGINS?: string;
  /** 라우트별 서비스키 등 비밀값 (wrangler secret put <이름>) */
  [secretName: string]: unknown;
}

/** 업스트림 호출 후보. version이 클수록 최신 (문자열 비교). */
export interface UpstreamCandidate {
  version: string;
  url: string;
}

export type UpstreamCheck = { ok: true } | { ok: false; code: string; message: string };

/**
 * 공공데이터 API 하나 = 라우트 하나. 새 API는 이 인터페이스를 구현해 routes/index.ts에 등록한다.
 */
export interface ProxyRoute {
  /** 예: "/kma/vilage-fcst" */
  path: string;
  /** 서비스키가 들어 있는 Worker 비밀값 이름 */
  secretName: string;
  /** 쿼리 검증. 허용한 파라미터만 업스트림으로 넘긴다. 잘못되면 에러 메시지 문자열. */
  parseParams(query: URLSearchParams): Record<string, string> | string;
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
}

export interface CachedEntry {
  version: string;
  savedAt: number;
  body: string;
}
