# 오늘의 빨래지수 (laundry-today)

기상청 단기예보로 우리 동네의 오늘·내일 빨래, 이불 널기, 세차 적합도를 알려주는 앱인토스(토스 미니앱) 비게임 미니앱이에요. 공공데이터 생활정보 시리즈 1번이고, 기획은 [`PLAN.md`](./PLAN.md), 시리즈 공통 규칙은 [루트 README](../README.md)를 보세요.

- 스택: Vite + React 19 + TypeScript, `@apps-in-toss/web-framework` 3.2.0 (TDS 미사용, 배출일 앱과 같은 디자인 토큰)
- 날씨 데이터는 [`../worker`](../worker) Cloudflare Worker 프록시를 통해서만 받아요. 서비스키는 앱 번들에 들어가지 않아요.

## 실행

```bash
npm install
cp .env.example .env     # VITE_WEATHER_PROXY_URL에 배포한 Worker 주소 입력
npm run dev              # http://localhost:5173
```

| 명령 | 내용 |
|---|---|
| `npm test` | 판정 로직·발표시각·파싱·캐시·격자 검색 단위 테스트 |
| `npm run lint` | oxlint |
| `npm run build` | `tsc -b && vite build && ait build` → `laundry-today.ait` |
| `npm run check:api` | 실제 기상청 API로 여러 지역(서울·부산·제주·대전·강릉) 수신·판정 확인 (아래 참고) |
| `npm run build:grid` | 격자 엑셀 → `src/data/grid.json` 재생성 |

## 실제 API 확인

```bash
# Worker 배포 후 (실제 앱과 같은 경로)
WEATHER_PROXY_URL=https://public-data-proxy.<서브도메인>.workers.dev npm run check:api

# Worker 배포 전, 서비스키로 기상청 직접 호출
KMA_SERVICE_KEY=<Decoding 인증키> npm run check:api

# 지역 지정
npm run check:api -- "서울 마포 서교" "광주 동구 충장"
```

지역마다 발표시각, 받은 시각 수, `totalCount`, 오늘·내일 3종 판정을 출력해요. `totalCount`가 1000을 넘으면 Worker(와 직접 호출 모드)가 다음 페이지까지 받아 합치고, 받은 건수가 `totalCount`보다 적으면 실패로 표시해요.

## 폴더 구조

```
src/
  config/
    appName.ts      appName 상수 (확정: laundry-today)
    app.ts          프록시 주소, 광고 ID, 안내 문구, 개인정보처리방침 URL
    scoring.ts      판정 기준 수치 (튜닝은 이 파일만)
  scoring/
    rules.ts        시각별 감점 규칙 (v1.1 미세먼지는 규칙 하나 추가)
    judge.ts        판정 순수 함수 (빨래/이불/세차, 추천 시간대, 한 문장)
  weather/
    baseTime.ts     조회 가능한 최신 발표시각 계산
    parse.ts        기상청 응답 파싱 (resultCode 검사, 숫자 변환)
    forecastApi.ts  프록시 호출 + 기기 캐시(격자+발표시각) + 실패 시 이전 데이터
  utils/grid.ts     동네 검색, 동네 → 격자 (없으면 시/군/구 대표 격자)
  data/grid.json    기상청 격자 매핑표 (2026.7.1 판, 3,838행)
  screens/          Onboarding(동네 설정) · Home · Detail · Settings
scripts/
  build-grid.py     격자 엑셀 → JSON
  check-weather-api.ts
data-src/kma-grid-2607.xlsx  기상청 활용가이드 격자_위경도 원본
```

## 판정 기준 튜닝

`src/config/scoring.ts`의 숫자만 바꾸고 `npm test`로 확인하세요. 테스트는 기준표 값을 직접 검사하니까, 기준을 바꾸면 `src/scoring/judge.test.ts`의 기대값도 같이 고쳐야 해요.

- 시각별: 100점에서 감점. 비·눈(PTY ≠ 0)이면 그 시각은 0점
- 빨래: 09~18시 중 남은 시각으로 연속 3시간 이상 구간을 만들고, 그중 **가장 높은 평균**을 대표 점수로 써요. 추천 시간대는 최고 평균에서 5점 이내인 구간 중 가장 긴 구간이에요. 비 예보 시각이 낀 구간은 후보에서 빠져요.
- 이불: 습도 감점 1.5배, 연속 4시간 이상
- 세차: 판정일부터 2일 뒤까지 PTY ≠ 0 또는 강수확률 60% 이상인 시각이 있으면 비추천(0점). 없으면 빨래 점수
- 80 이상 좋아요 · 60~79 괜찮아요 · 40~59 아쉬워요 · 40 미만 비추천
- 15시(`switchToTomorrowHour`) 이후에는 홈 메인 판정이 내일 기준("내일 빨래 계획")으로 바뀌어요
- 오늘 남은 낮 시간이 필요한 구간(빨래 3시간, 이불 4시간)보다 짧으면 비추천이 아니라 "늦었어요"로 표시해요 (점수 없음)

## 격자 매핑표 갱신

기상청이 새 격자 엑셀을 내면 `data-src/`에 넣고 다음을 실행해요.

```bash
pip install openpyxl
python3 scripts/build-grid.py data-src/<새파일>.xlsx
```

저장된 사용자 동네는 앱을 열 때 새 매핑표로 다시 찾아요. 동이 없어졌으면 같은 시/군/구 대표 격자를 써요.

## 광고 ID

기본값은 항상 테스트 광고 ID(`ait-ad-test-banner-id`)예요. 이 앱 콘솔에서 배너 광고 그룹을 만든 뒤 `src/config/app.ts`의 `LIVE_BANNER_AD_GROUP_ID`를 채우고(지금은 발급 대기라 비어 있음), **스토어 배포용 최종 빌드에서만** 다음을 실행하세요. 라이브 ID가 비어 있는 채로 운영 빌드를 하면 광고 영역이 아예 나오지 않아요(테스트 ID로 대체하지 않음).

```bash
VITE_USE_LIVE_ADS=true npm run build
```

## appName

확정: `laundry-today` (한국어 앱 이름 "오늘의 빨래지수"). `src/config/appName.ts`의 `APP_NAME`을 `apps-in-toss.config.ts`와 저장소 키가 따라가고, Worker의 `../worker/src/config/allowedOrigins.ts`에도 같은 값이 있어요. 한국어 이름은 `src/config/app.ts`의 `APP_DISPLAY_NAME`과 `index.html` 제목에 있어요(앱인토스 config에는 표시 이름 필드가 없어 콘솔에서 입력).

## 개인정보처리방침

[`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) — 배출일 앱 방침을 바탕으로 날씨 중계 서버 내용을 추가했어요. 설정 화면 링크는 `src/config/app.ts`의 `PRIVACY_POLICY_URL`이에요. Notion 공개 페이지를 만든 뒤 넣을 예정이라 지금은 비어 있고, 비어 있는 동안 설정 화면의 "정보" 영역은 숨겨져요.
