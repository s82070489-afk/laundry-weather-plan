# 오늘 빨래해도 될까

우리 동네 날씨로 오늘 빨래·이불 널기·세차 가능 여부를 알려주는 생활 날씨 미니앱 (앱인토스, 비게임). 공공데이터 생활정보 시리즈 1번이에요.

| 폴더/파일 | 내용 |
|---|---|
| [`PLAN.md`](./PLAN.md) | 서비스 기획서 |
| [`CLAUDE.md`](./CLAUDE.md) | 확정된 결정·작업 시 주의사항 (새 세션용 프로젝트 컨텍스트) |
| [`laundry-today/`](./laundry-today) | 앱인토스 미니앱 (Vite + React + TS). 실행·구조·튜닝 방법은 [README](./laundry-today/README.md) |
| [`worker/`](./worker) | Cloudflare Worker 공공데이터 공통 프록시. 서비스키 은닉, 격자+발표시각 공유 캐시, 실패 시 마지막 정상 응답 반환. 다음 공공데이터 앱에서도 라우트만 추가해 재사용해요. 배포 방법은 [README](./worker/README.md) |

```
laundry-today (토스 미니앱) ──nx, ny──▶ worker (Cloudflare) ──serviceKey──▶ 기상청 단기예보 API
```
