import SourceNotice from '../components/SourceNotice';
import VerdictBadge from '../components/VerdictBadge';
import { SCORING } from '../config/scoring';
import type { ForecastState } from '../hooks/useForecast';
import { ACTIVITY_LABEL, formatWindow, judge, type Activity, type HourScore, type Judgement } from '../scoring/judge';
import { formatDateLabel, relativeDayLabel } from '../utils/format';
import { addDays, toKst } from '../weather/kst';
import type { HourlyForecast } from '../weather/types';
import './Detail.css';

interface DetailProps {
  activity: Activity;
  date: string;
  forecast: ForecastState;
}

export default function Detail({ activity, date, forecast }: DetailProps) {
  const nowKst = toKst(new Date());
  const dayLabel = relativeDayLabel(date, nowKst.date, addDays);

  if (forecast.status !== 'ready') {
    return (
      <main className="detail-screen">
        <h1 className="detail-title">
          {dayLabel} {ACTIVITY_LABEL[activity]}
        </h1>
        <p className="detail-muted">{forecast.status === 'loading' ? '예보를 불러오는 중이에요...' : '예보를 불러오지 못했어요'}</p>
      </main>
    );
  }

  const j = judge(activity, forecast.data.hours, date, { date: nowKst.date, hour: nowKst.hour });

  return (
    <main className="detail-screen">
      <h1 className="detail-title">
        {dayLabel} {ACTIVITY_LABEL[activity]} <span className="detail-date">{formatDateLabel(date)}</span>
      </h1>

      {forecast.stale && <p className="stale-notice">최신 예보를 불러오지 못했어요. 이전 예보로 보여드려요.</p>}

      <section className="detail-status card">
        <div className="detail-status-top">
          <VerdictBadge judgement={j} />
          {j.score !== null && <span className="detail-score">{j.score}점</span>}
        </div>
        <p className="detail-status-text">{statusText(j, nowKst.date)}</p>
      </section>

      {j.hourly.length > 0 && (
        <>
          <section className="detail-section card">
            <h2 className="detail-section-title">시간대별 점수</h2>
            <ScoreChart hourly={j.hourly} window={j.window} />
          </section>

          <section className="detail-section card">
            <h2 className="detail-section-title">판정 근거</h2>
            <ForecastTable hourly={j.hourly} />
            <p className="detail-rule">
              100점에서 강수확률·습도·기온·바람·하늘 상태에 따라 감점해요.
              {activity === 'blanket' && ' 이불은 습도 감점을 1.5배로 계산하고, 4시간 이상 이어서 말릴 수 있어야 해요.'}
              {activity === 'carWash' &&
                ` 세차는 ${SCORING.activities.carWash.lookaheadDays}일 뒤까지 비 예보나 강수확률 ${SCORING.activities.carWash.rainPopAtLeast}% 이상인 시각이 있으면 비추천해요.`}
            </p>
          </section>
        </>
      )}

      <SourceNotice baseDate={forecast.data.baseDate} baseTime={forecast.data.baseTime} showFineDust />
    </main>
  );
}

function statusText(j: Judgement, today: string): string {
  if (j.reason === 'no-data') return '아직 이 날짜의 예보가 없어요';
  if (j.reason === 'too-late') return '오늘은 빨래하기엔 늦었어요. 남은 낮 시간이 부족해요';
  if (j.reason === 'rain-soon' && j.rainAt) {
    return `${relativeDayLabel(j.rainAt.date, today, addDays)} ${j.rainAt.hour}시에 비 소식이 있어요. 세차는 미뤄두세요`;
  }
  const window = formatWindow(j.window);
  if (j.activity === 'carWash') return j.verdict === 'bad' ? '세차하기 좋은 날씨가 아니에요' : '당분간 비 소식이 없어요';
  return window ? `${window}에 널면 가장 잘 말라요` : '널어 말리기 좋은 시간이 없어요';
}

const SKY_LABEL: Record<number, string> = { 1: '맑음', 3: '구름많음', 4: '흐림' };
const PTY_LABEL: Record<number, string> = { 1: '비', 2: '비/눈', 3: '눈', 4: '소나기' };

function weatherLabel(f: HourlyForecast): string {
  if (f.pty) return PTY_LABEL[f.pty] ?? '비';
  return f.sky ? SKY_LABEL[f.sky] : '-';
}

function ScoreChart({ hourly, window }: { hourly: HourScore[]; window: Judgement['window'] }) {
  return (
    <div className="detail-chart" role="img" aria-label="시간대별 점수 막대 그래프">
      {hourly.map((h) => {
        const inWindow = window !== null && h.hour >= window.start && h.hour < window.end;
        return (
          <div key={`${h.date}${h.hour}`} className="detail-chart-col">
            <span className="detail-chart-value">{h.score}</span>
            <div className="detail-chart-track">
              <div
                className={`detail-chart-bar${inWindow ? ' is-window' : ''}`}
                style={{ height: `${Math.max(h.score, 2)}%` }}
              />
            </div>
            <span className="detail-chart-hour">{h.hour}시</span>
          </div>
        );
      })}
    </div>
  );
}

function ForecastTable({ hourly }: { hourly: HourScore[] }) {
  const fmt = (v: number | null, unit: string) => (v === null ? '-' : `${v}${unit}`);
  return (
    <div className="detail-table-wrap">
      <table className="detail-table">
        <thead>
          <tr>
            <th>시각</th>
            <th>날씨</th>
            <th>기온</th>
            <th>습도</th>
            <th>강수</th>
            <th>풍속</th>
          </tr>
        </thead>
        <tbody>
          {hourly.map(({ forecast: f, hour, date }) => (
            <tr key={`${date}${hour}`}>
              <td>{hour}시</td>
              <td>{weatherLabel(f)}</td>
              <td>{fmt(f.tmp, '°')}</td>
              <td>{fmt(f.reh, '%')}</td>
              <td>{fmt(f.pop, '%')}</td>
              <td>{fmt(f.wsd, '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="detail-table-unit">강수 = 강수확률, 풍속 단위 m/s</p>
    </div>
  );
}
