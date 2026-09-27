# 공공데이터 생활정보 미니앱 시리즈 — 프로젝트 컨텍스트

앱인토스(토스 미니앱) 비게임 미니앱 시리즈. #1 "오늘 빨래해도 될까"(`laundry-today/`, 기획 `PLAN.md`), #2 "연휴계산기"(`holiday-planner/`, 기획 `holiday-planner/PLAN.md`). 같은 개발자의 이전 앱 "우리동네 배출일"(`s82070489-afk/recycling-calendar`)의 구조·디자인·광고·뒤로가기 처리를 재사용했고, #2는 #1의 구조·코드 스타일을 그대로 따른다.

## 구성

- `laundry-today/` — #1 미니앱 (Vite + React 19 + TS, `@apps-in-toss/web-framework` 3.2.0). 자세한 건 `laundry-today/README.md`
- `holiday-planner/` — #2 미니앱 (같은 스택). 자세한 건 `holiday-planner/README.md`
- `worker/` — Cloudflare Worker 공공데이터 공통 프록시(`public-data-proxy.s82070489.workers.dev`). 다음 공공데이터 앱도 라우트만 추가해 재사용. 배포 절차는 `worker/README.md`

## 공통 (Worker·디자인)

- **서비스키는 클라이언트에 두지 않음**: 앱 → Worker → 공공데이터포털. 키는 Worker 비밀값(`KMA_SERVICE_KEY`, `HOLIDAY_SERVICE_KEY`). (배출일 앱은 `VITE_` env로 키가 번들에 들어가는 구조였음)
- **Worker 라우트** = `ProxyRoute` 하나(`worker/src/routes/`). 공통 흐름 `lib/proxy.ts`: 캐시 HIT → 업스트림 MISS → 실패 시 마지막 정상 응답 STALE → 없으면 502 `{error, code}`. 선택 훅(`parseBody`·`normalize`·`shouldCache`·`isFresh`·`renderBody`)을 비우면 원본 그대로 저장하고 version 비교로 신선도 판단(기상청 라우트). 기상청 라우트 동작은 훅 추가 전과 같다
- **CORS**: `worker/src/config/allowedOrigins.ts`의 `APP_NAMES`. SDK 3.x 호스트 `{appName}.web.tossmini.com`/`private-web`, 2.x 호스트 `apps`/`private-apps` 네 가지 허용. 로컬 Origin은 `ALLOW_DEV_ORIGINS="true"`일 때만
- **디자인**: TDS 미사용, 배출일 앱 토큰(블루 단일 액센트, 화이트 카드 + 1px 보더)
- **뒤로가기 버튼을 직접 그리지 않음** (배출일 앱 심사 반려 사례). `graniteEvent backEvent` + `Screen.close()` + history 동기화
- **광고**: 배너만. 기본 테스트 ID, `VITE_USE_LIVE_ADS=true`일 때만 라이브 ID. 앱별 라이브 adGroupId는 아직 없음(각 앱 `src/config/app.ts`)
- **개인정보처리방침**: 앱 폴더별 `PRIVACY_POLICY.md`, 담당자 Leafory. 링크는 이 저장소 `main` 브랜치 파일 (원격에 아직 `main`이 없으면 병합 후에 열림)

## #1 오늘 빨래해도 될까 — 확정된 결정

- **v1.0은 기상청 단기예보만 사용, 미세먼지(에어코리아)는 v1.1.** 판정 근거 화면에 에어코리아 확인 안내 문구 노출. 감점 규칙은 `src/scoring/rules.ts`에 규칙 하나 추가하는 구조
- **경로**: `/kma/vilage-fcst?nx=&ny=`, 비밀값 `KMA_SERVICE_KEY`
- **캐싱**: 격자+발표시각 단위. Worker는 isolate 메모리 + KV(마지막 정상 응답 3일 보관, 실패 시 STALE로 반환), 앱은 localStorage. Cache API는 `workers.dev`에서 안 돼서 KV 사용. `totalCount`가 1000을 넘으면 Worker가 다음 페이지까지 받아 합치고, 일부 페이지만 받은 응답은 저장하지 않음
- **appName 미정** (후보 `laundry-today`): `laundry-today/src/config/appName.ts` 한 곳 + Worker `allowedOrigins.ts`
- **판정 수치**는 `laundry-today/src/config/scoring.ts`에만. 하늘 감점 구름많음 -5 / 흐림 -10, 습도 70%+ -20 / 85%+ -45
- **판정 규칙**: 시각별 100점 감점, PTY≠0 시각 0점. 빨래 = 09~18시 남은 시각의 연속 3h+ 구간 최고 평균, 비 예보 시각이 낀 구간은 제외. 추천 시간대 = 최고 평균 -5점 이내 중 가장 긴 구간. 이불 = 습도 1.5배, 4h+. 세차 = 판정일~2일 뒤 PTY≠0 또는 POP≥60 있으면 비추천(0점). 오늘 남은 낮 시간이 필요 구간(3h/4h)보다 짧으면 비추천이 아니라 "늦었어요"(verdict null, reason `too-late`). 15시(`switchToTomorrowHour`) 이후 홈은 내일 기준
- **판정 배지**: 좋아요=블루, 괜찮아요=연블루, 아쉬워요=그레이, 비추천=진한 잉크(#191F28)+흰 글씨, 늦었어요/예보 없음=테두리만. 비추천·늦었어요 카드는 점수 숨김
- **홈 판정 이유 한 줄**: `src/scoring/reason.ts`. 판정 시간대에 비가 있으면 "○○ 오전/오후/저녁에 비 소식", 아니면 추천 구간 감점 합이 가장 큰 요소(좋아요·괜찮아요는 부드러운 문장, 100점이면 긍정 문장). "기상청 예보 기반 참고 정보예요"는 하단 출처 줄에만. 미리보기의 세차 비추천은 시간대 자리에 `shortReason`("이틀 안에 비 소식"/"당일 비 소식"), 세차 상세는 "글피 새벽에 비 소식이 있어요"처럼 상대 날짜+새벽/오전/오후/저녁
- **광고 위치**: 홈 하단

## #2 연휴계산기 — 확정된 결정

- **appName 미정** (후보 `holiday-planner` / `long-weekend`): `holiday-planner/src/config/appName.ts` 한 곳 + Worker `allowedOrigins.ts`의 `'holiday-planner'`
- **경로**: `GET /holidays?year=` (KST 올해-1~올해+1, 그 외 400) → 한국천문연구원 특일 정보 `getRestDeInfo`(`pageNo=1`, `numOfRows=100`, `solYear`, `_type=json`, 월 생략). 비밀값 `HOLIDAY_SERVICE_KEY`. 응답 `{ year, holidays: [{date: "YYYY-MM-DD", name}], fetchedAt, cache }`
- **정규화**: `items.item` 1건=객체, 0건=`items: ""` → 항상 배열. `isHoliday === "Y"`만, 날짜순. XML로 와도 `worker/src/lib/xml.ts`로 파싱해 같은 형식(인증 오류 XML은 `returnReasonCode`를 에러코드로)
- **캐시**: KV `holidays:{year}`, 저장 후 24시간 HIT(버전 = 받은 시각, `isFresh`), 400일 보관. 원본 실패 시 만료 캐시라도 STALE. **0건은 저장 안 함**(내년 발표 전) — 단 이전에 받은 데이터가 있는데 0건이면 일시적 이상으로 보고 이전 데이터 STALE. 앱은 기기 캐시 6시간(`HOLIDAY_CACHE_HOURS`), 앱도 같은 규칙(0건이 오면 기기의 이전 데이터 유지)
- **설정 수치**는 `holiday-planner/src/config/planner.ts`(`plannerConfig`)에만: 탭 1~3개, 탭당 5개, 최소 3일, 주말 [0, 6], 근로자의날 5/1 기본 ON
- **날짜**: 전부 KST `YYYY-MM-DD` 문자열(`src/lib/date.ts`). `Date`는 UTC 자정으로만 만들고 문자열로 비교. 올해가 아닌 날짜는 화면에 연도 표기
- **연휴** = 주말·공휴일·(토글 ON)근로자의날이 이어진 구간 중 공휴일 1개 이상(쉬는 근로자의날도 공휴일로 침). 평일 공휴일 하루도 1일짜리 연휴. 오늘이 연휴 중이면 "지금 연휴 중, 오늘 포함 N일 남음" + 다음 연휴 한 줄. 홈 계산 범위는 오늘-14일부터(연휴 시작일·대체공휴일 원래 이름 찾기)
- **올해 남은 공휴일**: 같은 이름이 이어지면 한 줄(설날·추석), 대체공휴일은 "대체공휴일" 배지 + 앞 7일 안 주말/겹친 공휴일에서 찾은 원래 이름, "1월1일"은 "신정"으로 표기
- **근로자의날**: API에 없어서 토글(설정 화면, localStorage)로 5/1을 쉬는 날로. API가 5/1을 이미 공휴일로 주면 토글과 무관하게 그 이름으로 쉬는 날
- **연차 추천** (`src/lib/recommend.ts`, 순수 함수): 내일 ~ (내년 공휴일 있으면 내년 12/31, 없으면 올해 12/31. 주말만으로 내년 계산 안 함) → 연속한 근무일 k개 + 양옆 쉬는 날 = 최대 구간 → 총 일수 < 3, 연차 쓸 날 ≤ 오늘, 쉬는 날 0일(연차로만 채운 구간) 제외 → 연차 날짜 집합 중복 제거 → 총 일수↓·공휴일 수↓·가까운 날짜 → 상위 5개. 카드: 기간, 큰 숫자 "N일 연속", 연차 쓸 날, "연차 1개당 N일", 미니 캘린더(블루=연차, 그레이=원래 쉬는 날, 점=공휴일)
- **내 연차** (`src/lib/annualLeave.ts`, 순수 함수): 1년 미만 = 다 채운 개월 수(최대 11), n년 = `min(25, 15 + floor((n-1)/2))`. 개월 계산은 **민법 제160조**(해당일 없는 달은 말일에 만료 → 1/31 입사는 3/1에 1개월, 2/29 입사는 평년 3/1에 1년). 입사일은 localStorage에만, "입사일 지우기" 버튼 있음. 안내 문구 + 근로기준법 제60조 링크(law.go.kr)
- **화면**: 하단 탭 3개(홈/연차 추천/내 연차), 설정은 홈 우상단 톱니 → push. 탭 전환은 `history.replaceState`(쌓지 않음). backEvent: 설정 → `history.back()`, 홈 아닌 탭 → 홈 탭, 홈 → `Screen.close()`
- **로딩/에러**: 올해 공휴일 실패·0건이면 재시도 버튼, 내년 실패는 올해만으로 계산 + 안내, STALE이면 작은 안내. 화면에 다시 보일 때(visibilitychange) 재확인
- **광고 위치**: 연차 추천 결과 아래 배너 1개

## 작업 시 주의

- 이 원격 실행 환경은 `apis.data.go.kr`, 앱인토스 개발자 문서 사이트 접근이 막혀 있다. 실제 API 확인은 `npm run check:api`를 사용자가 로컬에서 실행 (빨래 `WEATHER_PROXY_URL`, 연휴 `HOLIDAY_PROXY_URL`)
- 사용자는 Windows PowerShell 5를 쓴다. 안내 명령은 `&&` 없이 한 줄씩, 환경변수는 `$env:NAME = "값"`, `curl` 대신 `curl.exe`
- 컨테이너의 한글 폰트가 WenQuanYi뿐이라 스크린샷에서 "시"가 "ㅅ|"처럼 벌어져 보인다 — 앱 버그 아님
- 로컬 `npm run dev`에서 devtools "AIT" 플로팅 버튼이 하단 CTA·하단 탭 오른쪽을 가린다(배포본엔 없음). 빨래 앱은 화면 하단 padding 80px로 피해 둠
- `npm install`이 `edgesOut` 에러로 실패하면 lockfile 기준 `npm ci` 사용
- 테스트: `laundry-today`, `holiday-planner`, `worker` 각각 `npm test` (vitest). 연휴계산기 테스트 공휴일은 `src/lib/testFixtures.ts`(실제 발표 데이터 아님)
- UI 확인은 `npm run dev` + Playwright(전역 설치됨, `NODE_PATH=$(npm root -g)`)로 `/holidays` 응답을 route로 가짜 응답해 스크린샷
