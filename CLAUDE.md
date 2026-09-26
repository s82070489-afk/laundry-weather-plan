# 오늘 빨래해도 될까 — 프로젝트 컨텍스트

공공데이터 생활정보 시리즈 1번 앱인토스(토스 미니앱) 비게임 미니앱. 같은 개발자의 이전 앱 "우리동네 배출일"(`s82070489-afk/recycling-calendar`)의 구조·디자인·광고·뒤로가기 처리를 재사용했다. 기획은 `PLAN.md`.

## 구성

- `laundry-today/` — 미니앱 (Vite + React 19 + TS, `@apps-in-toss/web-framework` 3.2.0). 자세한 건 `laundry-today/README.md`
- `worker/` — Cloudflare Worker 공공데이터 공통 프록시. 다음 공공데이터 앱도 라우트만 추가해 재사용. 배포 절차는 `worker/README.md`

## 확정된 결정

- **v1.0은 기상청 단기예보만 사용, 미세먼지(에어코리아)는 v1.1.** 판정 근거 화면에 에어코리아 확인 안내 문구 노출. 감점 규칙은 `src/scoring/rules.ts`에 규칙 하나 추가하는 구조
- **서비스키는 클라이언트에 두지 않음**: 앱 → Worker(`/kma/vilage-fcst?nx=&ny=`) → 기상청. 키는 Worker 비밀값 `KMA_SERVICE_KEY`. (배출일 앱은 `VITE_` env로 키가 번들에 들어가는 구조였음)
- **캐싱**: 격자+발표시각 단위. Worker는 isolate 메모리 + KV(마지막 정상 응답 3일 보관, 실패 시 STALE로 반환), 앱은 localStorage. Cache API는 `workers.dev`에서 안 돼서 KV 사용. `totalCount`가 1000을 넘으면 Worker가 다음 페이지까지 받아 합치고, 일부 페이지만 받은 응답은 저장하지 않음
- **CORS**: `worker/src/config/allowedOrigins.ts`. SDK 3.x 호스트 `{appName}.web.tossmini.com`/`private-web`, 2.x 호스트 `apps`/`private-apps` 네 가지 허용. 로컬 Origin은 `ALLOW_DEV_ORIGINS="true"`일 때만
- **appName 미정** (후보 `laundry-today`): `laundry-today/src/config/appName.ts` 한 곳 + Worker `allowedOrigins.ts`
- **판정 수치**는 `laundry-today/src/config/scoring.ts`에만. 하늘 감점 구름많음 -5 / 흐림 -10, 습도 70%+ -20 / 85%+ -45
- **판정 규칙**: 시각별 100점 감점, PTY≠0 시각 0점. 빨래 = 09~18시 남은 시각의 연속 3h+ 구간 최고 평균, 비 예보 시각이 낀 구간은 제외. 추천 시간대 = 최고 평균 -5점 이내 중 가장 긴 구간. 이불 = 습도 1.5배, 4h+. 세차 = 판정일~2일 뒤 PTY≠0 또는 POP≥60 있으면 비추천(0점). 오늘 남은 낮 시간이 필요 구간(3h/4h)보다 짧으면 비추천이 아니라 "늦었어요"(verdict null, reason `too-late`). 15시(`switchToTomorrowHour`) 이후 홈은 내일 기준
- **디자인**: TDS 미사용, 배출일 앱 토큰(블루 단일 액센트, 화이트 카드 + 1px 보더). 판정 배지: 좋아요=블루, 괜찮아요=연블루, 아쉬워요·비추천=그레이
- **뒤로가기 버튼을 직접 그리지 않음** (배출일 앱 심사 반려 사례). `graniteEvent backEvent` + `Screen.close()` + history 동기화
- **광고**: 배너만(홈 하단). 기본 테스트 ID, `VITE_USE_LIVE_ADS=true`일 때만 라이브 ID. 이 앱용 라이브 adGroupId는 아직 없음(`src/config/app.ts`)
- **개인정보처리방침**: `laundry-today/PRIVACY_POLICY.md`, 담당자 Leafory. 링크는 이 저장소 `main` 브랜치 파일

## 작업 시 주의

- 이 원격 실행 환경은 `apis.data.go.kr`, 앱인토스 개발자 문서 사이트 접근이 막혀 있다. 실제 API 확인은 `npm run check:api`를 사용자가 로컬에서 실행
- 컨테이너의 한글 폰트가 WenQuanYi뿐이라 스크린샷에서 "시"가 "ㅅ|"처럼 벌어져 보인다 — 앱 버그 아님
- 로컬 `npm run dev`에서 devtools "AIT" 플로팅 버튼이 하단 CTA 오른쪽 아래를 가린다(배포본엔 없음). 화면 하단 padding 80px로 피해 둠
- `npm install`이 `edgesOut` 에러로 실패하면 lockfile 기준 `npm ci` 사용
- 테스트: `laundry-today`와 `worker` 각각 `npm test` (vitest)
