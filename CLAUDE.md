# 공공데이터 생활정보 미니앱 시리즈 — 공통 컨텍스트

앱인토스(토스 미니앱) 비게임 미니앱 시리즈. 앱마다 폴더 하나, 공공데이터는 Cloudflare Worker 프록시(`worker/`) 하나로 받는다. 같은 개발자의 이전 앱 "우리동네 배출일"(`s82070489-afk/recycling-calendar`)의 구조·디자인·광고·뒤로가기 처리를 재사용했고, 새 앱은 기존 앱의 구조·코드 스타일을 따른다.

이 파일에는 모든 앱에 공통인 것만 둔다. **앱별 확정 결정은 각 앱 폴더의 `CLAUDE.md`**(그 폴더 파일을 다룰 때 함께 읽힘), 기획은 각 앱 `PLAN.md`.

## 구성

| 폴더 | 내용 | 앱별 문서 |
|---|---|---|
| `laundry-today/` | #1 오늘의 빨래지수 — 기상청 단기예보 | `CLAUDE.md` · `PLAN.md` · `README.md` · `PRIVACY_POLICY.md` |
| `holiday-planner/` | #2 연휴계산기 — 한국천문연구원 특일 정보 | `CLAUDE.md` · `PLAN.md` · `README.md` · `PRIVACY_POLICY.md` |
| `worker/` | Cloudflare Worker 공공데이터 공통 프록시 `public-data-proxy.s82070489.workers.dev`. 경로 `/kma/vilage-fcst`(#1), `/holidays`(#2) | `README.md` |

## 공통 결정

- **서비스키는 클라이언트에 두지 않음**: 앱 → Worker → 공공데이터포털. 키는 경로별 Worker 비밀값(`KMA_SERVICE_KEY`, `HOLIDAY_SERVICE_KEY`), 앱 `.env`에는 Worker 주소만. (배출일 앱은 `VITE_` env로 키가 번들에 들어가는 구조였음)
- **Worker 경로** = `ProxyRoute` 하나(`worker/src/routes/`) + `routes/index.ts` 등록. 공통 흐름 `lib/proxy.ts`: 캐시 HIT → 업스트림 MISS → 실패 시 마지막 정상 응답 STALE → 없으면 502 `{error, code}`(code = 공공데이터포털 에러코드 등). 선택 훅 `parseBody`(XML 등)·`normalize`·`shouldCache`·`isFresh`·`renderBody`를 비우면 원본 그대로 저장하고 version 비교로 신선도 판단. 새 경로를 넣을 때 기존 경로 동작은 바꾸지 않는다
- **캐시**: Worker는 isolate 메모리(L1) + KV(L2). Cache API는 `workers.dev`에서 안 돼서 KV. 앱은 localStorage에 한 번 더 두고, 실패하면 기기의 이전 데이터를 "최신 … 불러오지 못했어요" 류의 안내와 함께 보여준다
- **CORS**: `worker/src/config/allowedOrigins.ts`의 `APP_NAMES`. SDK 3.x 호스트 `{appName}.web.tossmini.com`/`private-web`, 2.x 호스트 `apps`/`private-apps` 네 가지 허용. 로컬 Origin은 `ALLOW_DEV_ORIGINS="true"`일 때만
- **appName**: 앱별 `src/config/appName.ts` 한 곳(`apps-in-toss.config.ts`·localStorage 키 prefix가 참조, config 로더에서도 읽혀 Vite 전용 문법 금지) + Worker `APP_NAMES`. 등록 후 수정 불가라 콘솔에서 확인 후 확정
- **스택·구조**: Vite + React 19 + TS, `@apps-in-toss/web-framework` 3.2.0, vitest, oxlint. 튜닝 수치는 앱별 `src/config/` 파일 하나에만, 판단 로직은 순수 함수 + 테스트. 공통 코드는 패키지로 빼지 않고 복사해서 쓴다(`BannerAd` + `useTossAdsReady`, `openExternal`, 설정 파일)
- **디자인**: TDS 미사용, 배출일 앱 토큰(블루 단일 액센트 `#3182F6`, 화이트 카드 + 1px 보더 `#F2F4F6`, 잉크 `#191F28`)
- **뒤로가기 버튼을 직접 그리지 않음** (배출일 앱 심사 반려 사례). `graniteEvent backEvent`로 받아 최상위 화면에서만 `Screen.close()`, 하위 화면(push)이 있는 앱은 history 동기화
- **날짜·시각은 KST**: 기기 시간대와 무관하게 UTC+9로 계산 (#1 `src/weather/kst.ts`, #2 `src/lib/date.ts`)
- **광고**: 배너만. 기본 테스트 ID(`ait-ad-test-banner-id`), `VITE_USE_LIVE_ADS=true`일 때만 라이브 ID. 라이브 adGroupId는 앱마다 콘솔에서 따로 발급(다른 앱 ID 재사용 금지) — 아직 둘 다 없음(각 앱 `src/config/app.ts`)
- **개인정보처리방침**: 앱 폴더별 `PRIVACY_POLICY.md`, 담당자 Leafory. 앱 안 링크(빨래: 설정 화면, 연휴: 화면 하단)는 이 저장소 `main` 브랜치 파일
- **문서**: 앱마다 `PLAN.md`(기획 + 변경 이력), `README.md`(실행·배포), `PRIVACY_POLICY.md`, `CLAUDE.md`(앱별 결정). 결정이 바뀌면 그 앱의 `PLAN.md` 변경 이력과 `CLAUDE.md`를 함께 고치고, 공통 규칙이 바뀌면 이 파일과 루트 `README.md`를 고친다

## 작업 시 주의

- 이 원격 실행 환경은 `apis.data.go.kr`, 앱인토스 개발자 문서 사이트 접근이 막혀 있다. 실제 API 확인은 각 앱 `npm run check:api`를 사용자가 로컬에서 실행
- 사용자는 Windows PowerShell 5를 쓴다. 안내 명령은 `&&` 없이 한 줄씩, 환경변수는 `$env:NAME = "값"`, `curl` 대신 `curl.exe`, `cp` 대신 `Copy-Item`
- Node.js 22.12 이상 (vitest·wrangler 요구 버전)
- `laundry-today`, `holiday-planner`, `worker`는 각각 따로 `npm install`·`npm test`(vitest). `npm install`이 `edgesOut` 에러로 실패하면 lockfile 기준 `npm ci`
- 원격 기본 브랜치는 `claude/laundry-weather-planning-7dsczh`이고 `main`이 아직 없다(2026-09-27 기준) — 그래서 GitHub `main` 기준 개인정보처리방침 링크는 쓰지 않는다(Notion 공개 페이지 예정)
- 컨테이너의 한글 폰트가 WenQuanYi뿐이라 스크린샷에서 "시"가 "ㅅ|"처럼 벌어져 보인다 — 앱 버그 아님
- 로컬 `npm run dev`에서 devtools "AIT" 플로팅 버튼이 화면 오른쪽 아래(하단 CTA·하단 탭)를 가린다. 배포본엔 없음
- UI 확인: `npm run dev` + Playwright(전역 설치됨, `NODE_PATH=$(npm root -g)`)로 Worker 응답을 route로 가짜 응답해 스크린샷
