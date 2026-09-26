# public-data-proxy (Cloudflare Worker)

공공데이터포털 API용 공통 프록시예요. 서비스키를 Worker 비밀값으로 숨기고, 요청 파라미터 단위로 응답을 캐싱해 여러 사용자가 함께 써요. 지금은 "오늘 빨래해도 될까"의 기상청 단기예보 라우트 하나가 있고, 다음 공공데이터 앱도 라우트만 추가해서 같은 Worker를 쓰면 돼요.

```
앱(토스 미니앱) ──GET /kma/vilage-fcst?nx=60&ny=127──▶ Worker ──serviceKey 추가──▶ apis.data.go.kr
                 ◀── 기상청 원본 JSON + X-Proxy-Cache ──┘   └─ KV: 격자별 마지막 정상 응답
```

## 동작 방식

| 상황 | 동작 | `X-Proxy-Cache` |
|---|---|---|
| 같은 격자·같은 발표시각 데이터가 이미 있음 | 기상청 호출 없이 캐시 응답 | `HIT` |
| 새 발표시각 | 기상청 호출 → KV 저장 → 응답. 발표 직후 NO_DATA면 직전 발표분을 받음 | `MISS` |
| 기상청 호출 실패(한도 초과·키 오류·장애) | 캐시에 있던 **마지막 정상 응답** 반환 | `STALE` |
| 실패 + 캐시도 없음 | `502 { error, code }` (code = 기상청 resultCode) | - |

- 발표시각(02·05·08·11·14·17·20·23시, 발표 10분 후부터)은 Worker가 계산해요. 앱은 `nx`, `ny`만 보내요.
- 캐시는 2단계예요. isolate 메모리(L1) 다음에 Workers KV(L2)를 봐요. KV는 격자당 키 하나에 마지막 정상 응답을 3일간 보관해요.
- 허용된 Origin(앱인토스 미니앱 도메인)에서 온 요청만 받아요. 그 외에는 `403`을 돌려줘요.

> Cache API(`caches.default`)는 `*.workers.dev` 주소에서 동작하지 않아서(유료 커스텀 도메인 필요) KV를 써요.

## 배포하기 (처음 한 번)

로컬 PC 터미널에서 진행하세요. Node 18 이상이 필요해요.

### 1. Cloudflare 계정 만들기

1. https://dash.cloudflare.com/sign-up 에서 이메일로 가입하고 이메일 인증을 마쳐요. 무료 플랜이라 카드 등록은 필요 없어요.
2. 대시보드 왼쪽 메뉴의 **Workers & Pages**에 한 번 들어가 두세요. 첫 배포 때 `*.workers.dev` 서브도메인을 정하라고 나오면 원하는 이름(예: `leafory`)을 입력해요.

### 2. 의존성 설치와 로그인

```bash
cd worker
npm install
npx wrangler login        # 브라우저가 열리면 Allow 클릭
npx wrangler whoami       # 계정 이메일이 나오면 성공
```

> 브라우저를 열 수 없는 원격 환경이면, 대시보드 > My Profile > API Tokens에서 "Edit Cloudflare Workers" 템플릿으로 토큰을 만든 뒤 `export CLOUDFLARE_API_TOKEN=발급받은토큰`을 설정하면 `login` 없이 진행돼요.

### 3. KV 네임스페이스 만들기

```bash
npx wrangler kv namespace create PROXY_CACHE
```

출력된 `id` 값을 `wrangler.toml`의 `REPLACE_WITH_KV_NAMESPACE_ID` 자리에 붙여 넣어요.

```toml
[[kv_namespaces]]
binding = "PROXY_CACHE"
id = "여기에_출력된_id"
```

### 4. 기상청 서비스키를 비밀값으로 등록하기

1. [공공데이터포털](https://www.data.go.kr)에서 **기상청_단기예보 ((구)_동네예보) 조회서비스**를 활용신청해요(자동승인). 배출일 앱과 같은 계정이라도 API마다 따로 신청해야 해요. 승인 직후 1시간 정도는 `SERVICE_KEY_IS_NOT_REGISTERED`(30) 오류가 날 수 있어요.
2. 마이페이지에서 **일반 인증키(Decoding)** 값을 복사해요. Encoding 값을 넣어도 Worker가 알아서 풀어서 쓰니까 동작은 해요.
3. 등록 명령을 실행하면 값을 입력하라고 나와요. 키는 파일이나 채팅에 붙여 넣지 말고 이 프롬프트에만 입력하세요.

```bash
npx wrangler secret put KMA_SERVICE_KEY
```

### 5. 배포

```bash
npx wrangler deploy
```

마지막 줄에 나오는 주소(예: `https://public-data-proxy.leafory.workers.dev`)가 프록시 주소예요.

### 6. 동작 확인

```bash
# MISS → 한 번 더 실행하면 HIT 가 나와야 정상
curl -s -D - -o /dev/null -H "Origin: http://localhost:5173" \
  "https://public-data-proxy.<서브도메인>.workers.dev/kma/vilage-fcst?nx=60&ny=127" | grep -i x-proxy

# 여러 지역 실제 판정까지 확인 (앱 폴더에서)
cd ../laundry-today
WEATHER_PROXY_URL=https://public-data-proxy.<서브도메인>.workers.dev npm run check:api
```

### 7. 앱에 연결

`laundry-today/.env`에 프록시 주소를 넣어요. 서비스키는 앱에 넣지 않아요.

```
VITE_WEATHER_PROXY_URL=https://public-data-proxy.<서브도메인>.workers.dev
```

### 출시 후

- `wrangler.toml`의 `ALLOW_DEV_ORIGINS`를 `"false"`로 바꾸고 `npx wrangler deploy`로 다시 배포하면 localhost 요청이 막혀요. 로컬 개발이나 위 확인 스크립트를 쓸 때는 다시 `"true"`로 바꿔요.
- 로그: 대시보드 > Workers & Pages > public-data-proxy > **Logs**, 또는 `npx wrangler tail`로 실시간 확인. `resultCode=22`(일일 한도 초과), `resultCode=30`(미등록 키) 등이 구분돼서 남아요.

## 로컬 개발

```bash
cp .dev.vars.example .dev.vars   # KMA_SERVICE_KEY 입력 (커밋 금지)
npm run dev                      # http://localhost:8787
npm test                         # 단위 테스트 (네트워크 불필요)
npm run typecheck
```

## 설정 파일

| 파일 | 내용 |
|---|---|
| `src/config/allowedOrigins.ts` | CORS 허용 Origin. `APP_NAMES`에 appName을 추가하면 `{appName}.web / private-web / apps / private-apps.tossmini.com` 네 호스트가 허용돼요 |
| `src/routes/index.ts` | 라우트 등록부 |
| `src/routes/kmaVilageFcst.ts` | 기상청 단기예보 라우트 (파라미터 검증, 발표시각 계산, 에러코드) |
| `src/lib/proxy.ts` | 공통 흐름 (캐시 → 업스트림 → fallback) |
| `wrangler.toml` | KV 바인딩, 로그 설정, `ALLOW_DEV_ORIGINS` |

> appName이 `laundry-today`에서 바뀌면 `allowedOrigins.ts`도 같이 바꿔야 해요.

## 새 공공데이터 API 추가하기

1. `src/routes/<이름>.ts`에 `ProxyRoute`를 구현해요. 경로, 비밀값 이름, 허용 파라미터 검증, 캐시 키, 업스트림 URL 후보, 정상 응답 판별, 보관 기간을 정해요.
2. `src/routes/index.ts`의 `ROUTES`에 추가해요.
3. `npx wrangler secret put <비밀값 이름>`으로 키를 등록해요. data.go.kr 키라면 같은 키를 다른 이름으로 한 번 더 등록해도 돼요.
4. 새 앱의 appName을 `src/config/allowedOrigins.ts`의 `APP_NAMES`에 추가하고 배포해요.
5. `test/`에 라우트 테스트를 추가해요 (`test/proxy.test.ts` 참고).

## 무료 한도 (Workers Free)

| 항목 | 한도 | 이 프록시의 사용량 |
|---|---|---|
| Workers 요청 | 10만 회/일 | 앱 요청 1회 = 1회 (앱도 기기에서 발표시각 단위로 캐싱) |
| KV 읽기 | 10만 회/일 | 메모리 캐시에 없을 때 요청당 1회 |
| KV 쓰기 | 1,000회/일 | 격자 × 발표시각(하루 8회)마다 1회 → 하루 약 125개 격자까지. 넘으면 KV 저장만 실패하고 메모리 캐시로 계속 동작 |
| 기상청 개발계정 | 10,000회/일 | 격자 × 발표시각마다 1~2회 |

사용량이 늘면 공공데이터포털에서 운영계정으로 전환하고, KV 쓰기가 부족하면 Workers Paid($5/월)를 검토하세요.
