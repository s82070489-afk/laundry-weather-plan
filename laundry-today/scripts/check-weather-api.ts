/**
 * 실제 기상청 API로 여러 지역의 예보 수신·판정을 확인하는 스크립트.
 * 앱과 같은 파싱/판정 코드(src/weather, src/scoring)를 그대로 쓴다.
 *
 *   # 1) 배포한 Worker 프록시를 통해 (권장 — 실제 앱과 같은 경로, HIT/MISS 캐시 확인)
 *   WEATHER_PROXY_URL=https://public-data-proxy.<계정>.workers.dev npm run check:api
 *
 *   # 2) Worker 배포 전, 서비스키로 기상청을 직접 호출해 키·응답만 확인
 *   KMA_SERVICE_KEY=<Decoding 인증키> npm run check:api
 *
 *   지역 지정: npm run check:api -- "서울 종로 청운" "부산 해운대 우1" "제주 노형"
 */
import { getLatestBaseDateTime } from '../src/weather/baseTime';
import { addDays, toKst } from '../src/weather/kst';
import { parseForecast } from '../src/weather/parse';
import { ACTIVITY_LABEL, VERDICT_LABEL, formatWindow, judge, mainTargetDate, type Activity } from '../src/scoring/judge';
import { searchRegions } from '../src/utils/grid';

const DEFAULT_QUERIES = ['서울 종로구 청운효자동', '부산 해운대구 우1동', '제주 제주시 노형동', '대전 유성구 온천1동', '강원 강릉시 교1동'];
const KMA_ENDPOINT = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
/** Worker의 ALLOW_DEV_ORIGINS="true"일 때 허용되는 로컬 Origin */
const DEV_ORIGIN = 'http://localhost:5173';

const proxyUrl = process.env.WEATHER_PROXY_URL?.replace(/\/$/, '');
const serviceKey = process.env.KMA_SERVICE_KEY;
if (!proxyUrl && !serviceKey) {
  console.error('WEATHER_PROXY_URL 또는 KMA_SERVICE_KEY 환경변수가 필요해요. (파일 상단 사용법 참고)');
  process.exit(1);
}

async function fetchRaw(nx: number, ny: number): Promise<{ json: unknown; via: string }> {
  if (proxyUrl) {
    const res = await fetch(`${proxyUrl}/kma/vilage-fcst?nx=${nx}&ny=${ny}`, { headers: { Origin: DEV_ORIGIN } });
    const via = `proxy HTTP ${res.status} cache=${res.headers.get('X-Proxy-Cache') ?? '-'} version=${res.headers.get('X-Proxy-Version') ?? '-'}`;
    return { json: await res.json(), via };
  }
  const { baseDate, baseTime } = getLatestBaseDateTime(new Date());
  const params = new URLSearchParams({
    serviceKey: serviceKey!,
    pageNo: '1',
    numOfRows: '1000',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: String(nx),
    ny: String(ny),
  });
  const res = await fetch(`${KMA_ENDPOINT}?${params.toString()}`);
  const text = await res.text();
  try {
    return { json: JSON.parse(text), via: `direct HTTP ${res.status} base=${baseDate} ${baseTime}` };
  } catch {
    throw new Error(`JSON이 아닌 응답 (인증키 오류일 가능성): ${text.slice(0, 200)}`);
  }
}

const queries = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_QUERIES;
const nowKst = toKst(new Date());
const now = { date: nowKst.date, hour: nowKst.hour };
const { date: mainDate, isTomorrow } = mainTargetDate(now);
const activities: Activity[] = ['laundry', 'blanket', 'carWash'];
let failures = 0;

console.log(`기준 시각(KST) ${nowKst.date} ${nowKst.hour}:${String(nowKst.minute).padStart(2, '0')} · 메인 판정일 ${mainDate}${isTomorrow ? ' (18시 이후 → 내일)' : ''}\n`);

for (const query of queries) {
  const region = searchRegions(query, 1)[0];
  if (!region) {
    console.log(`✗ "${query}" — 격자 매핑표에서 못 찾음`);
    failures++;
    continue;
  }
  try {
    const { json, via } = await fetchRaw(region.nx, region.ny);
    const totalCount = (json as { response?: { body?: { totalCount?: number } } })?.response?.body?.totalCount;
    const data = parseForecast(json, region.nx, region.ny);
    const dates = [...new Set(data.hours.map((h) => h.date))];
    console.log(`✓ ${region.label} (nx=${region.nx}, ny=${region.ny}) — ${via}`);
    console.log(`  발표 ${data.baseDate} ${data.baseTime}, 시각 ${data.hours.length}개 (${dates[0]}~${dates.at(-1)}), totalCount=${totalCount ?? '?'}${totalCount && totalCount > 1000 ? ' ⚠️ 1000건 초과 — 뒤쪽 시각이 잘렸을 수 있음' : ''}`);
    for (const date of [mainDate, addDays(mainDate, 1)]) {
      const line = activities
        .map((a) => {
          const j = judge(a, data.hours, date, now);
          const verdict = j.verdict ? VERDICT_LABEL[j.verdict] : '예보없음';
          const extra = j.reason === 'rain-soon' && j.rainAt ? ` 비 ${j.rainAt.date.slice(4)} ${j.rainAt.hour}시` : formatWindow(j.window) ? ` ${formatWindow(j.window)}` : '';
          return `${ACTIVITY_LABEL[a]} ${verdict}(${j.score ?? '-'})${extra}`;
        })
        .join(' · ');
      console.log(`  ${date}: ${line}`);
    }
  } catch (e) {
    failures++;
    console.log(`✗ ${region.label} (nx=${region.nx}, ny=${region.ny}) — ${(e as Error).message}`);
  }
}

if (proxyUrl) console.log('\n※ 같은 명령을 한 번 더 실행하면 cache=HIT(업스트림 호출 없음)이 나와야 정상이에요.');
process.exit(failures ? 1 : 0);
