# 오늘의 빨래지수 (laundry-today) — 앱별 결정

시리즈 #1. 공통 규칙(Worker·디자인·뒤로가기·광고·작업 환경)은 루트 `CLAUDE.md`. 기획은 `PLAN.md`, 실행·튜닝은 `README.md`.

## 확정된 결정

- **v1.0은 기상청 단기예보만 사용, 미세먼지(에어코리아)는 v1.1.** 판정 근거 화면에 에어코리아 확인 안내 문구 노출. 감점 규칙은 `src/scoring/rules.ts`에 규칙 하나 추가하는 구조
- **Worker 경로**: `/kma/vilage-fcst?nx=&ny=`, 비밀값 `KMA_SERVICE_KEY`. 발표시각은 Worker가 계산(앱의 `src/weather/baseTime.ts`와 같은 규칙)
- **캐싱**: 격자+발표시각 단위. Worker KV에 격자별 마지막 정상 응답 3일 보관, 실패 시 STALE. `totalCount`가 1000을 넘으면 Worker가 다음 페이지까지 받아 합치고, 일부 페이지만 받은 응답은 저장하지 않음. 앱은 localStorage에 격자별로, 같은 발표시각이면 네트워크 호출 없음
- **appName 확정 `laundry-index`(콘솔 등록값 — 폴더·패키지 이름 `laundry-today`와 다름), 한국어 앱 이름 "오늘의 빨래지수"**: `src/config/appName.ts`(appName) + `src/config/app.ts`의 `APP_DISPLAY_NAME` + Worker `allowedOrigins.ts`. 앱인토스 config에는 표시 이름 필드가 없어 콘솔에서 입력
- **판정 수치**는 `src/config/scoring.ts`에만. 하늘 감점 구름많음 -5 / 흐림 -10, 습도 70%+ -20 / 85%+ -45
- **판정 규칙**: 시각별 100점 감점, PTY≠0 시각 0점. 빨래 = 09~18시 남은 시각의 연속 3h+ 구간 최고 평균, 비 예보 시각이 낀 구간은 제외. 추천 시간대 = 최고 평균 -5점 이내 중 가장 긴 구간. 이불 = 습도 1.5배, 4h+. 세차 = 판정일~2일 뒤 PTY≠0 또는 POP≥60 있으면 비추천(0점). 오늘 남은 낮 시간이 필요 구간(3h/4h)보다 짧으면 비추천이 아니라 "늦었어요"(verdict null, reason `too-late`) — 오늘 날짜만, 미래 날짜에 낮 예보가 모자라면 `no-data`. 세차는 예보가 확인 기간 끝(판정일+2일 23시)까지 안 오면 `checkedUntil`을 남기고 상세에서 "글피 오전까지 비 소식이 없어요"처럼 확인한 데까지만 말함(14시 발표는 글피 08시까지뿐). 15시(`switchToTomorrowHour`) 이후 홈은 내일 기준
- **판정 배지**: 좋아요=블루, 괜찮아요=연블루, 아쉬워요=그레이, 비추천=진한 잉크(#191F28)+흰 글씨, 늦었어요/예보 없음=테두리만. 비추천·늦었어요 카드는 점수 숨김
- **홈 판정 이유 한 줄**: `src/scoring/reason.ts`. 판정 시간대에 비가 있으면 "○○ 오전/오후/저녁에 비 소식", 아니면 추천 구간 감점 합이 가장 큰 요소(좋아요·괜찮아요는 부드러운 문장, 100점이면 긍정 문장). "기상청 예보 기반 참고 정보예요"는 하단 출처 줄에만. 미리보기의 세차 비추천은 시간대 자리에 `shortReason`("이틀 안에 비 소식"/"당일 비 소식"), 세차 상세는 "글피 새벽에 비 소식이 있어요"처럼 상대 날짜+새벽/오전/오후/저녁
- **화면**: 동네 설정(온보딩) → 홈 → 상세·설정. 동네는 앱에 내장한 기상청 격자 매핑표(`src/data/grid.json`)에서 검색, 매핑이 안 되는 동은 같은 시/군/구 대표 격자
- **광고 위치**: 홈 하단 배너. 라이브 ID는 `src/config/app.ts`의 `LIVE_BANNER_AD_GROUP_ID` = `ait.v2.live.955d97e13e9846a0`(2026-09-28 발급). **`npm run build` 결과물은 항상 라이브 ID, 테스트 ID(`ait-ad-test-banner-id`)는 `import.meta.env.DEV` 분기 안에만 직접 적어 빌드에서 제거**(심사 반려: "출시 번들에 테스트용 광고 그룹 ID 불가"). `VITE_USE_LIVE_ADS` 없음. 빌드 중 `scripts/check-bundle-ads.mjs`가 dist에 테스트 ID가 있거나 라이브 ID가 없으면 `.ait` 만들기 전에 실패시킴. 테스트 ID를 상수·함수로 빼서 DEV 분기 밖에서 참조하지 말 것(번들에 남음)
- **개인정보처리방침**: 원문 `PRIVACY_POLICY.md`. 링크는 `src/config/app.ts`의 `PRIVACY_POLICY_URL`(Notion 페이지 예정, 비어 있음). 비어 있으면 설정 화면의 "정보" 영역을 숨김

## 작업 시 주의

- 실제 API 확인: `npm run check:api` — `WEATHER_PROXY_URL`(Worker 경유) 또는 `KMA_SERVICE_KEY`(기상청 직접). 여러 지역 판정까지 출력
- 로컬 devtools "AIT" 버튼을 피하려고 화면 하단 padding을 80px로 둠
- 격자 매핑표 갱신은 `npm run build:grid` (`README.md` 참고)
