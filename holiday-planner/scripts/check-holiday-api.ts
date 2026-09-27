/**
 * 배포한 Worker(/holidays)로 올해·내년 공휴일을 받아 건수·캐시 상태·공휴일 목록을 확인하는 스크립트.
 * 앱과 같은 파싱·계산 코드(src/lib)를 그대로 써서 다음 연휴와 연차 추천 1위도 보여준다.
 *
 *   Windows PowerShell (한 줄씩 실행)
 *     $env:HOLIDAY_PROXY_URL = "https://public-data-proxy.s82070489.workers.dev"
 *     npm run check:api
 *
 *   macOS/Linux
 *     HOLIDAY_PROXY_URL=https://public-data-proxy.s82070489.workers.dev npm run check:api
 *
 *   연도 지정: npm run check:api -- 2026 2027
 *
 * Worker의 ALLOW_DEV_ORIGINS가 "true"여야 한다 (로컬 Origin으로 호출하기 때문).
 */
import { plannerConfig } from '../src/config/planner';
import { buildCalendar, calendarOptions, findHolidayPeriods, periodsAround } from '../src/lib/calendar';
import { addDays, diffDays, formatRange, todayKst, weekdayLabel, yearOf } from '../src/lib/date';
import { parseHolidaysResponse, type Holiday } from '../src/lib/holidays';
import { daysPerLeave, planRangeEnd, recommend } from '../src/lib/recommend';

/** Worker의 ALLOW_DEV_ORIGINS="true"일 때 허용되는 로컬 Origin */
const DEV_ORIGIN = 'http://localhost:5173';

/** Worker가 { code }로 전달하는 공공데이터포털 에러코드별 안내 */
const CODE_HINTS: Record<string, string> = {
  '20': '이 서비스키로 "한국천문연구원_특일 정보" 활용신청이 안 됐거나 아직 승인 전이에요',
  '22': '일일 호출 한도를 넘었어요 (자정에 초기화)',
  '30': '등록되지 않은 서비스키예요. 활용신청 직후 1시간 정도는 이럴 수 있어요',
  '31': '활용기간이 끝났어요. 공공데이터포털에서 연장 신청하세요',
  FETCH_FAILED: 'Worker가 apis.data.go.kr에 연결하지 못했어요 (원본 장애·시간 초과)',
  NON_JSON: '원본 응답을 읽지 못했어요 (JSON/XML이 아님)',
};

const STATUS_HINTS: Record<number, string> = {
  400: 'year는 올해-1 ~ 올해+1만 조회할 수 있어요',
  403: 'Origin이 거부됐어요 — worker/wrangler.toml의 ALLOW_DEV_ORIGINS가 "true"인지 확인하세요',
  404: 'Worker에 /holidays 라우트가 없어요 — worker 폴더에서 npx wrangler deploy로 다시 배포하세요',
  500: 'Worker 비밀값 HOLIDAY_SERVICE_KEY가 없어요 — npx wrangler secret put HOLIDAY_SERVICE_KEY',
};

const proxyUrl = process.env.HOLIDAY_PROXY_URL?.replace(/\/$/, '');
if (!proxyUrl) {
  console.error('HOLIDAY_PROXY_URL 환경변수가 필요해요. (파일 상단 사용법 참고)');
  process.exit(1);
}

/** ISO 시각 → "2026-09-27 12:55 (KST)" */
function formatKst(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '-';
  const kst = new Date(time + 9 * 60 * 60 * 1000).toISOString();
  return `${kst.slice(0, 10)} ${kst.slice(11, 16)} (KST)`;
}

const today = todayKst();
const thisYear = yearOf(today);
const args = process.argv.slice(2).map(Number).filter(Number.isInteger);
const years = args.length ? args : [thisYear, thisYear + 1];
const loaded = new Map<number, Holiday[]>();
let failures = 0;

console.log(`오늘(KST) ${today} · 프록시 ${proxyUrl}\n`);

for (const year of years) {
  try {
    const res = await fetch(`${proxyUrl}/holidays?year=${year}`, { headers: { Origin: DEV_ORIGIN } });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`HTTP ${res.status}, JSON이 아닌 응답: ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      const { error, code } = (json ?? {}) as { error?: string; code?: string };
      const upstreamHttp = code?.startsWith('HTTP_')
        ? `원본(apis.data.go.kr)에서 HTTP ${code.slice(5)} 오류 — 401·403이면 서비스키·활용신청 상태를, 5xx면 원본 장애를 의심하세요`
        : undefined;
      const hint = (code && CODE_HINTS[code]) || upstreamHttp || STATUS_HINTS[res.status];
      throw new Error(`HTTP ${res.status} ${error ?? ''}${code ? ` (code ${code})` : ''}${hint ? `\n    → ${hint}` : ''}`);
    }

    const data = parseHolidaysResponse(json, year);
    loaded.set(year, data.holidays);
    const cache = data.cache ?? res.headers.get('X-Proxy-Cache') ?? '-';
    console.log(`✓ ${year}년 — HTTP ${res.status} cache=${cache} · ${data.holidays.length}건 · 받은 시각 ${formatKst(data.fetchedAt)}`);
    if (data.holidays.length === 0) {
      if (year > thisYear) {
        console.log('  0건: 아직 발표 전이에요. Worker는 0건을 저장하지 않아서 발표되면 바로 반영돼요 (앱은 올해만으로 추천).');
      } else {
        failures++;
        console.log('  0건: 올해 공휴일이 비어 있으면 정상이 아니에요 (앱은 에러로 보여줘요).');
      }
    }
    for (const h of data.holidays) console.log(`  ${h.date}(${weekdayLabel(h.date)}) ${h.name}`);
  } catch (e) {
    failures++;
    console.log(`✗ ${year}년 — ${(e as Error).message}`);
  }
}

// 앱과 같은 계산으로 다음 연휴·연차 추천 1위 미리보기 (근로자의날 기본값 기준)
const current = loaded.get(thisYear);
if (current?.length) {
  const next = loaded.get(thisYear + 1) ?? [];
  const nextYearAvailable = next.length > 0;
  const holidays = [...current, ...next];
  const laborDayOff = plannerConfig.laborDay.defaultOn;
  const days = buildCalendar(addDays(today, -14), planRangeEnd(today, nextYearAvailable), holidays, calendarOptions(plannerConfig, laborDayOff));
  const { current: ongoing, next: upcoming } = periodsAround(findHolidayPeriods(days), today);

  console.log(`\n앱 계산 미리보기 (근로자의날 ${laborDayOff ? '쉼' : '근무'}, 추천 범위 ~${planRangeEnd(today, nextYearAvailable)})`);
  if (ongoing) console.log(`  지금 연휴 중: ${formatRange(ongoing.start, ongoing.end, thisYear)} ${ongoing.totalDays}일`);
  if (upcoming) {
    console.log(
      `  다음 연휴: ${formatRange(upcoming.start, upcoming.end, thisYear)} ${upcoming.totalDays}일 · D-${diffDays(today, upcoming.start)} · ${upcoming.holidayNames.join(', ')}`,
    );
  }
  for (let leaveCount = 1; leaveCount <= plannerConfig.maxLeaveDays; leaveCount++) {
    const [best] = recommend({ today, holidays, nextYearAvailable, laborDayOff, leaveCount });
    const text = best
      ? `${formatRange(best.start, best.end, thisYear)} ${best.totalDays}일 연속 (연차 ${best.leaveDates.join(', ')} · 1개당 ${daysPerLeave(best)}일)`
      : '없음';
    console.log(`  연차 ${leaveCount}개 1위: ${text}`);
  }
}

console.log('\n※ 같은 명령을 한 번 더 실행하면 cache=HIT(원본 호출 없음)이 나와야 정상이에요. 0건인 해는 저장하지 않아 매번 MISS예요.');
process.exit(failures ? 1 : 0);
