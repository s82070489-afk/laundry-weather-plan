# 연휴계산기 (holiday-planner)

연차 몇 개로 며칠 쉴 수 있는지 알려주는 앱인토스(토스 미니앱) 비게임 미니앱이에요. 공공데이터 생활정보 시리즈 2번이고, 기획은 [`PLAN.md`](./PLAN.md), 시리즈 공통 규칙은 [루트 README](../README.md)를 보세요.

- 스택: Vite + React 19 + TypeScript, `@apps-in-toss/web-framework` 3.2.0 — "오늘 빨래해도 될까"(`../laundry-today`)와 같은 구조·디자인 토큰(TDS 미사용)·광고 배너·뒤로가기 처리
- 공휴일은 [`../worker`](../worker) Cloudflare Worker의 `/holidays?year=`로만 받아요. 서비스키는 앱 번들에 들어가지 않아요.
- 연휴·연차 추천·발생 연차는 전부 앱 안에서 계산해요 (`src/lib/`의 순수 함수)

```
holiday-planner ──GET /holidays?year=2026──▶ worker (Cloudflare, KV 24시간) ──serviceKey──▶ 한국천문연구원 특일 정보(getRestDeInfo)
```

## 로컬 실행 (Windows PowerShell 5)

`&&` 없이 한 줄씩 실행하세요.

```powershell
cd holiday-planner
npm install
Copy-Item .env.example .env
npm run dev
```

브라우저에서 http://localhost:5173 을 열어요. `.env`의 `VITE_HOLIDAY_PROXY_URL`은 이미 `https://public-data-proxy.s82070489.workers.dev`로 들어 있어요.

- `npm install`이 `edgesOut` 에러로 실패하면 `npm ci`를 쓰세요 (lockfile 기준 설치).
- 로컬에서 Worker를 부르려면 Worker의 `ALLOW_DEV_ORIGINS`가 `"true"`여야 해요 (지금 설정값).
- 로컬 `npm run dev`에서는 devtools "AIT" 플로팅 버튼이 하단 탭의 "내 연차"를 가려요. 배포본에는 없어요.

| 명령 | 내용 |
|---|---|
| `npm test` | 연차 추천·발생 연차·연휴 계산·날짜(KST)·응답 파싱·기기 캐시 단위 테스트 |
| `npm run lint` | oxlint |
| `npm run build` | `tsc -b && vite build && ait build` → `holiday-planner.ait` |
| `npm run check:api` | 배포한 Worker로 올해·내년 공휴일 수신 확인 (아래) |

## Worker에 공휴일 경로 배포하기

Worker는 빨래 앱 때 배포한 `public-data-proxy`를 그대로 써요. 처음 배포 방법은 [`../worker/README.md`](../worker/README.md)에 있고, 여기서는 이번에 추가된 `/holidays` 경로만 반영하면 돼요.

1. [공공데이터포털](https://www.data.go.kr)에서 **한국천문연구원_특일 정보**를 활용신청해요 (자동승인). 기상청 API와 같은 계정이라도 API마다 따로 신청해야 해요. 승인 직후 1시간 정도는 `SERVICE_KEY_IS_NOT_REGISTERED`(30) 오류가 날 수 있어요.
2. 서비스키를 Worker 비밀값으로 등록해요. 마이페이지의 **일반 인증키(Decoding)** 값을 입력하라는 프롬프트에 붙여 넣어요 (기상청 키와 같은 값이어도 돼요).
3. 다시 배포해요.

```powershell
cd worker
npx wrangler secret put HOLIDAY_SERVICE_KEY
npx wrangler deploy
```

## 실제 API 확인 (`npm run check:api`)

```powershell
cd holiday-planner
$env:HOLIDAY_PROXY_URL = "https://public-data-proxy.s82070489.workers.dev"
npm run check:api
```

- 올해·내년을 호출해 건수, `cache`(HIT/MISS/STALE), 받은 시각, 공휴일 목록을 출력하고, 앱과 같은 계산으로 다음 연휴와 연차 1~3개 추천 1위를 보여줘요.
- 한 번 더 실행하면 `cache=HIT`(원본 호출 없음)이 나와야 정상이에요. 내년이 0건(발표 전)이면 저장하지 않으니 매번 `MISS`예요.
- 연도 지정: `npm run check:api -- 2026 2027`
- 실패하면 원인 안내가 같이 나와요: `code 20`(활용신청 안 됨), `code 30`(키 미등록), HTTP 500(`HOLIDAY_SERVICE_KEY` 없음), HTTP 404(Worker 재배포 필요), HTTP 403(Origin 거부 — `ALLOW_DEV_ORIGINS`)
- 스크립트 없이 한 번만 보려면 (PowerShell 5에서 `curl`은 다른 명령이라 `curl.exe`로. 한글이 깨져 보일 수 있어서 내용 확인은 `check:api`가 편해요):

```powershell
curl.exe -s -H "Origin: http://localhost:5173" "https://public-data-proxy.s82070489.workers.dev/holidays?year=2026"
```

## 폴더 구조

```
src/
  config/
    appName.ts      appName 상수 (미정 — 여기 한 곳 + ../worker/src/config/allowedOrigins.ts)
    planner.ts      추천 설정: 탭 수, 탭당 추천 수, 최소 연휴 일수, 주말 요일 (튜닝은 이 파일만)
    app.ts          프록시 주소, 광고 ID, 안내 문구, 개인정보처리방침·법령 URL, 기기 캐시 시간
  lib/
    date.ts         KST "YYYY-MM-DD" 날짜 유틸 (Date를 직접 비교하지 않음)
    holidays.ts     Worker 응답 검증·정규화(1건 객체/0건 빈 값도 처리), 대체공휴일 판별("대체공휴일"로 시작), 표기 이름
    calendar.ts     쉬는 날 달력, 연휴 구간, 올해 남은 공휴일 목록
    recommend.ts    연차 추천 (순수 함수)
    annualLeave.ts  입사일 기준 발생 연차 (순수 함수)
    holidayApi.ts   프록시 호출 + 기기 캐시 + 실패 시 이전 데이터
  hooks/useHolidays.ts  올해·내년 공휴일 함께 불러오기
  storage/        입사일 (localStorage)
  components/     TabBar, CalendarStrip(미니 캘린더), AppFooter(출처·계산 기준·개인정보처리방침), BannerAd(빨래 앱에서 복사) 등
  screens/        Home · Recommend(연차 추천) · MyLeave(내 연차) — 설정 화면은 없음
scripts/check-holiday-api.ts
```

## 계산 규칙

**연휴** — 주말·공휴일이 이어진 구간 중 공휴일이 하나 이상 있는 것. 평일 공휴일 하루도 1일짜리 연휴예요. 오늘이 연휴 중이면 "지금 연휴 중, 오늘 포함 N일 남음"과 그다음 연휴를 보여줘요.

**연차 추천** (`src/lib/recommend.ts`)

1. 내일 ~ (내년 공휴일이 있으면 내년 12/31, 없으면 올해 12/31) 날짜마다 쉬는 날/근무일 표시. 내년 공휴일이 없으면 주말만으로 내년을 계산하지 않아요.
2. 연차 k개마다 "근무일이 정확히 k개인 최대 연속 구간"을 모두 구해요 (연속한 근무일 k개 + 양옆 쉬는 날). 구간 안 근무일이 연차 쓸 날이에요.
3. 총 일수 < `minTotalDays`, 연차 쓸 날이 오늘이나 그 전, 쉬는 날 없이 연차로만 채운 구간은 빼요.
4. 연차 쓸 날짜 집합이 같은 건 하나만 → 총 일수 ↓ → 공휴일 수 ↓ → 가까운 날짜 순 → 탭당 `resultsPerTab`개

**내 연차** (`src/lib/annualLeave.ts`) — 입사일 기준, 출근율 80% 이상 가정

- 1년 미만: 다 채운 개월 수(최대 11). 1년 이상 n년: `min(25, 15 + floor((n - 1) / 2))`
- 개월 계산은 민법 제160조를 따라요: 해당일이 없는 달은 그 달 말일에 기간이 끝나요. 예) 1/31 입사 → 2/28까지 채우면 3/1에 1일 생김, 2/29 입사 → 평년은 3/1이 1년
- 다음 증가일과 증가 후 개수를 보여주고, 25일이면 더 늘지 않아요

**공휴일 목록** — API 목록을 그대로 써요. 노동절(5/1)도 API가 공휴일로 주고, 토요일이면 "대체공휴일(노동절)"까지 와서 따로 설정하지 않아요. 대체공휴일은 API 이름("대체공휴일(개천절)") 그대로 보여주고, "대체공휴일"로 시작하면 "대체" 배지를 붙여요. 근무 요일은 주 5일(토·일 휴무) 고정이에요.

**캐시** — Worker가 연도별로 24시간 공유 캐시, 앱은 기기에 6시간(`HOLIDAY_CACHE_HOURS`). 원본이 실패하면 Worker는 마지막 정상 데이터(STALE), 앱은 기기의 이전 데이터를 보여주고 "최신 공휴일 정보를 불러오지 못했어요" 안내를 띄워요. 올해 공휴일을 못 받으면 재시도 버튼을 보여줘요.

## 광고 ID

배너는 연차 추천 결과 아래 하나뿐이에요. 기본값은 항상 테스트 광고 ID(`ait-ad-test-banner-id`)예요. 이 앱 콘솔에서 배너 광고 그룹을 만든 뒤 `src/config/app.ts`의 `LIVE_BANNER_AD_GROUP_ID`를 채우고, **스토어 배포용 최종 빌드에서만** 라이브 ID로 빌드하세요.

```powershell
$env:VITE_USE_LIVE_ADS = "true"
npm run build
Remove-Item Env:VITE_USE_LIVE_ADS
```

## appName 확정 시

1. `src/config/appName.ts`의 `APP_NAME`을 바꿔요. `apps-in-toss.config.ts`와 기기 저장소 키가 이 값을 따라가요.
2. `../worker/src/config/allowedOrigins.ts`의 `APP_NAMES`에서 `holiday-planner`도 바꾸고 Worker를 다시 배포해요.

## 개인정보처리방침

[`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) — 빨래 앱 방침을 바탕으로 입사일(기기에만 저장)과 공휴일 중계 서버 내용을 반영했어요. 설정 화면이 없어서 링크는 각 탭 화면 하단에 있고, 주소는 `src/config/app.ts`의 `PRIVACY_POLICY_URL`이에요. 이 저장소 `main` 브랜치의 파일을 가리켜서 `main`에 병합해야 열려요.
