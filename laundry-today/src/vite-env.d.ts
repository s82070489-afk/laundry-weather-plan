/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloudflare Worker 프록시 주소 (예: https://public-data-proxy.<계정>.workers.dev). 서비스키는 Worker에만 있음. */
  readonly VITE_WEATHER_PROXY_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
