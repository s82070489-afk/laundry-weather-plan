# 공공데이터 생활정보 미니앱 시리즈

앱인토스(토스 미니앱) 비게임 미니앱 모음이에요. 공공데이터를 Cloudflare Worker 프록시 하나로 받아 쓰고, 앱은 같은 구조·디자인 토큰을 재사용해요.

| 폴더/파일 | 내용 |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | 확정된 결정·작업 시 주의사항 (새 세션용 프로젝트 컨텍스트) |
| [`PLAN.md`](./PLAN.md) | #1 오늘 빨래해도 될까 — 서비스 기획서 |
| [`laundry-today/`](./laundry-today) | #1 **오늘 빨래해도 될까** — 우리 동네 날씨로 오늘 빨래·이불 널기·세차 가능 여부 (기상청 단기예보). 실행·구조·튜닝은 [README](./laundry-today/README.md) |
| [`holiday-planner/`](./holiday-planner) | #2 **연휴계산기** — 다음 연휴 D-day, 연차 1~3개로 가장 길게 쉬는 날 추천, 입사일 기준 발생 연차 (한국천문연구원 특일 정보). 기획은 [PLAN](./holiday-planner/PLAN.md), 실행은 [README](./holiday-planner/README.md) |
| [`worker/`](./worker) | Cloudflare Worker 공공데이터 공통 프록시. 서비스키 은닉, 요청 단위 공유 캐시(KV), 실패 시 마지막 정상 응답 반환. 다음 공공데이터 앱도 라우트만 추가해 재사용해요. 배포 방법은 [README](./worker/README.md) |

```
laundry-today   (토스 미니앱) ──nx, ny──▶ worker /kma/vilage-fcst ──serviceKey──▶ 기상청 단기예보 API
holiday-planner (토스 미니앱) ──year────▶ worker /holidays        ──serviceKey──▶ 한국천문연구원 특일 정보 API
```
