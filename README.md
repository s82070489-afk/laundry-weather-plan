# 공공데이터 생활정보 미니앱 시리즈

공공데이터로 생활 속 질문 하나에 바로 답하는 앱인토스(토스 미니앱) 비게임 미니앱 모음이에요. 앱마다 폴더 하나를 쓰고, 공공데이터는 Cloudflare Worker 프록시 하나로 받아요.

## 앱

| # | 앱 | 한 줄 소개 | 공공데이터 | 문서 |
|---|---|---|---|---|
| 1 | **오늘 빨래해도 될까** [`laundry-today/`](./laundry-today) | 우리 동네 날씨로 오늘 빨래·이불 널기·세차 가능 여부 | 기상청 단기예보 | [기획](./laundry-today/PLAN.md) · [README](./laundry-today/README.md) |
| 2 | **연휴계산기** [`holiday-planner/`](./holiday-planner) | 다음 연휴 D-day, 연차 1~3개로 가장 길게 쉬는 날, 입사일 기준 발생 연차 | 한국천문연구원 특일 정보 | [기획](./holiday-planner/PLAN.md) · [README](./holiday-planner/README.md) |

두 앱 모두 appName(앱인토스 고유 ID)은 아직 미정이고, 폴더 이름이 지금 쓰는 후보예요.

## 구조

```
laundry-today   (토스 미니앱) ──nx, ny──▶ worker /kma/vilage-fcst ──serviceKey──▶ 기상청 단기예보 API
holiday-planner (토스 미니앱) ──year────▶ worker /holidays        ──serviceKey──▶ 한국천문연구원 특일 정보 API
```

[`worker/`](./worker)는 공공데이터 공통 프록시(`https://public-data-proxy.s82070489.workers.dev`)예요. 서비스키를 Worker 비밀값으로 숨기고, 요청 단위로 KV에 캐싱해 모든 사용자가 함께 쓰고, 원본이 실패하면 마지막 정상 응답을 줘요. 앱에는 서비스키 없이 Worker 주소만 넣어요. 동작·배포·경로 추가는 [worker/README](./worker/README.md)를 보세요.

## 공통 규칙

| 항목 | 규칙 |
|---|---|
| 스택 | Vite + React 19 + TypeScript, `@apps-in-toss/web-framework` 3.2.0, vitest, oxlint (TDS 미사용) |
| 디자인 | 토스 디자인 언어 — 블루 단일 액센트(`#3182F6`), 화이트 카드 + 1px 보더, 잉크 `#191F28`. 토큰은 각 앱 `src/index.css` |
| 뒤로가기 | 앱이 뒤로가기 버튼을 그리지 않아요(이전 앱 심사 반려 사례). 토스 내비게이션 바의 뒤로가기를 받아(`graniteEvent backEvent`) 화면을 되돌리고, 첫 화면이면 미니앱을 닫아요 |
| 날짜·시각 | 기기 시간대와 무관하게 한국 시간(KST)으로 계산해요 |
| 광고 | 배너만. 기본은 테스트 광고 ID이고 `VITE_USE_LIVE_ADS=true`로 빌드할 때만 라이브 ID를 써요. 라이브 ID는 앱마다 콘솔에서 따로 발급해요 |
| appName | 앱별 `src/config/appName.ts` 한 곳 + `worker/src/config/allowedOrigins.ts`. 등록 후 바꿀 수 없어서 콘솔에서 사용 가능 여부를 확인한 뒤 확정해요 |
| 튜닝 수치 | 앱별 `src/config/`의 파일 하나에만 둬요 (빨래 `scoring.ts`, 연휴 `planner.ts`) |
| 개인정보처리방침 | 앱 폴더별 `PRIVACY_POLICY.md` (담당자 Leafory). 앱 안의 링크는 이 저장소 `main` 브랜치 파일이라 `main`에 병합해야 열려요 |

## 개발 환경

- Node.js 22.12 이상 (vitest·wrangler가 요구하는 버전)
- 폴더(`laundry-today`, `holiday-planner`, `worker`)마다 따로 설치하고 실행해요. 명령은 Windows PowerShell 5 기준으로 `&&` 없이 한 줄씩 적었어요.

```powershell
cd holiday-planner
npm install
npm test
```

| 폴더 | 테스트 | 로컬 실행 | 실제 API 확인 |
|---|---|---|---|
| `laundry-today` | `npm test` | `npm run dev` | `npm run check:api` (`$env:WEATHER_PROXY_URL`) |
| `holiday-planner` | `npm test` | `npm run dev` | `npm run check:api` (`$env:HOLIDAY_PROXY_URL`) |
| `worker` | `npm test` | `npm run dev` (`.dev.vars`에 서비스키) | 배포 후 위 앱들의 `check:api` |

- `npm install`이 `edgesOut` 에러로 실패하면 lockfile 기준으로 `npm ci`를 쓰세요.
- 로컬 `npm run dev`에서는 devtools "AIT" 버튼이 화면 오른쪽 아래를 가려요. 배포본에는 없어요.

## 새 앱 추가하기

1. 기존 앱 폴더에서 설정 파일(`package.json`, `tsconfig*`, `vite.config.ts`, `apps-in-toss.config.ts` 등)과 공통 코드(광고 배너, TossAds 초기화 훅, 외부 링크)를 복사해 새 폴더를 만들어요. `package.json`의 `name`, `index.html` 제목, `src/config/appName.ts`를 바꿔요.
2. Worker에 경로를 추가하고, 새 appName을 `allowedOrigins.ts`에 넣고, 서비스키 비밀값을 등록한 뒤 다시 배포해요 ([worker/README — 새 공공데이터 API 추가하기](./worker/README.md#새-공공데이터-api-추가하기)).
3. 앱 폴더에 `PLAN.md`(기획), `README.md`(실행·배포), `PRIVACY_POLICY.md`, `CLAUDE.md`(앱별 결정)를 두고, 위 앱 표에 한 줄 추가해요.

## 문서 지도

| 문서 | 내용 |
|---|---|
| `README.md` (이 파일) | 시리즈 개요, 공통 규칙, 개발 환경 |
| [`CLAUDE.md`](./CLAUDE.md) | Claude Code 새 세션용 공통 컨텍스트 (공통 결정·작업 시 주의사항) |
| `<앱>/PLAN.md` | 서비스 기획서와 변경 이력 |
| `<앱>/README.md` | 실행·배포·튜닝 방법 |
| `<앱>/CLAUDE.md` | 앱별 확정 결정 (Claude Code가 그 폴더를 다룰 때 함께 읽어요) |
| `<앱>/PRIVACY_POLICY.md` | 개인정보처리방침 |
| [`worker/README.md`](./worker/README.md) | 프록시 동작·배포·경로 추가 |
