/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloudflare Worker 프록시 주소 (예: https://public-data-proxy.<계정>.workers.dev). 서비스키는 Worker에만 있음. */
  readonly VITE_WEATHER_PROXY_URL: string;
  /** 'true'일 때만 실제 라이브 광고 ID 사용. 미설정/그 외 값은 전부 테스트 광고 ID(안전한 기본값). */
  readonly VITE_USE_LIVE_ADS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
