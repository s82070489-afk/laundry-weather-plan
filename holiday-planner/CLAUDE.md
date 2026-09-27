# 연휴계산기 (holiday-planner) — 앱별 결정

시리즈 #2. 공통 규칙(Worker·디자인·뒤로가기·광고·작업 환경)은 루트 `CLAUDE.md`. 기획은 `PLAN.md`(변경 이력에 세부 규칙), 실행·배포는 `README.md`.

## 확정된 결정

- **appName 미정** (후보 `holiday-planner` / `long-weekend`): `src/config/appName.ts` + Worker `allowedOrigins.ts`의 `'holiday-planner'`
- **Worker 경로**: `GET /holidays?year=` (KST 올해-1~올해+1, 그 외 400) → 한국천문연구원 특일 정보 `getRestDeInfo`(`pageNo=1`, `numOfRows=100`, `solYear`, `_type=json`, 월 생략). 비밀값 `HOLIDAY_SERVICE_KEY`. 응답 `{ year, holidays: [{date: "YYYY-MM-DD", name}], fetchedAt, cache }`
- **정규화**: `items.item` 1건=객체, 0건=`items: ""` → 항상 배열. `isHoliday === "Y"`만, 날짜순. XML로 와도 `worker/src/lib/xml.ts`로 파싱해 같은 형식(인증 오류 XML은 `returnReasonCode`를 에러코드로). 앱(`src/lib/holidays.ts`)도 1건 객체·0건 빈 값을 받아 준다
- **캐시**: KV `holidays:{year}`, 저장 후 24시간 HIT(버전 = 받은 시각, `isFresh`), 400일 보관. 원본 실패 시 만료 캐시라도 STALE. **0건은 저장 안 함**(내년 발표 전) — 단 이전에 받은 데이터가 있는데 0건이면 일시적 이상으로 보고 이전 데이터 STALE. 앱은 기기 캐시 6시간(`HOLIDAY_CACHE_HOURS`), 앱도 같은 규칙(0건이 오면 기기의 이전 데이터 유지). Worker가 STALE을 주면 앱은 다음에 다시 확인
- **설정 수치**는 `src/config/planner.ts`(`plannerConfig`)에만: 탭 1~3개, 탭당 5개, 최소 3일, 주말 [0, 6]. 사용자 설정은 없음(주 5일 고정)
- **날짜**: 전부 KST `YYYY-MM-DD` 문자열(`src/lib/date.ts`). `Date`는 UTC 자정으로만 만들고 문자열로 비교. 올해가 아닌 날짜는 화면에 연도 표기
- **연휴** = 주말·공휴일이 이어진 구간 중 공휴일 1개 이상. 평일 공휴일 하루도 1일짜리 연휴. 오늘이 연휴 중이면 "지금 연휴 중, 오늘 포함 N일 남음" + 다음 연휴 한 줄. 홈 계산 범위는 오늘-14일부터(오늘이 낀 연휴의 시작일 찾기)
- **공휴일 이름**: API 이름 그대로. 대체공휴일은 API가 "대체공휴일(개천절)"처럼 원래 이름을 붙여 주므로 따로 찾지 않고, "대체공휴일"로 시작하면 목록에 "대체" 배지만 붙인다(`isSubstituteName`). "1월1일"만 "신정"으로 표기. 올해 남은 공휴일 목록은 같은 이름이 이어지면 한 줄(설날·추석)
- **노동절(5/1)**: API가 공휴일(isHoliday=Y)로 주고, 토요일이면 "대체공휴일(노동절)"도 준다(2027년) → 별도 처리·설정 없이 API 목록만 따른다 (예전 근로자의날 토글은 제거)
- **연차 추천** (`src/lib/recommend.ts`, 순수 함수): 내일 ~ (내년 공휴일 있으면 내년 12/31, 없으면 올해 12/31. 주말만으로 내년 계산 안 함) → 연속한 근무일 k개 + 양옆 쉬는 날 = 최대 구간 → 총 일수 < 3, 연차 쓸 날 ≤ 오늘, 쉬는 날 0일(연차로만 채운 구간) 제외 → 연차 날짜 집합 중복 제거 → 총 일수↓·공휴일 수↓·가까운 날짜 → 상위 5개. 카드: 기간, 큰 숫자 "N일 연속", 연차 쓸 날, "연차 1개당 N일", 미니 캘린더(블루=연차, 그레이=원래 쉬는 날, 점=공휴일)
- **내 연차** (`src/lib/annualLeave.ts`, 순수 함수): 1년 미만 = 다 채운 개월 수(최대 11), n년 = `min(25, 15 + floor((n-1)/2))`. 개월 계산은 **민법 제160조**(해당일 없는 달은 말일에 만료 → 1/31 입사는 3/1에 1개월, 2/29 입사는 평년 3/1에 1년). 입사일은 localStorage에만, "입사일 지우기" 버튼 있음. 안내 문구 + 근로기준법 제60조 링크(law.go.kr)
- **화면**: 하단 탭 3개(홈/연차 추천/내 연차)뿐, 설정 화면 없음. 개인정보처리방침 링크는 모든 탭 하단(`AppFooter`), 홈·추천 하단엔 출처와 계산 기준(주 5일) 안내도. 하위 화면이 없어 브라우저 히스토리를 쓰지 않는다. backEvent: 홈 아닌 탭 → 홈 탭, 홈 → `Screen.close()`
- **로딩/에러**: 올해 공휴일 실패·0건이면 재시도 버튼, 내년 실패는 올해만으로 계산 + 안내, STALE이면 작은 안내. 화면에 다시 보일 때(visibilitychange) 재확인
- **광고 위치**: 연차 추천 결과 아래 배너 1개
- **개인정보처리방침**: `PRIVACY_POLICY.md` (기기 저장 항목은 입사일·공휴일 캐시뿐, 입사일은 기기에만 저장한다고 명시)

## 작업 시 주의

- 실제 API 확인: `npm run check:api` — `HOLIDAY_PROXY_URL`(Worker 경유). 건수·cache·목록과 앱 계산(다음 연휴, 연차 추천 1위)까지 출력
- 테스트 공휴일은 `src/lib/testFixtures.ts` — 실제 `check:api` 결과(2026-09-27 받음, 2026년 22건·2027년 24건: 노동절·제헌절 포함, 대체공휴일은 "대체공휴일(○○)")
- `scripts/`는 Node(tsx)로 돌아서 `import.meta.env`를 쓰는 `src/config/app.ts`를 import하면 안 된다 (`src/lib/holidays.ts`처럼 설정 없는 모듈만)
- UI 확인 시 `/holidays` 응답은 Playwright route로 가짜 응답(`src/lib/testFixtures.ts` 데이터), 날짜는 `page.clock.setFixedTime`으로 12월·4월 등 재현
