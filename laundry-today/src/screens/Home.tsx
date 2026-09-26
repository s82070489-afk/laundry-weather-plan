import BannerAd from '../components/BannerAd';
import SourceNotice from '../components/SourceNotice';
import VerdictBadge from '../components/VerdictBadge';
import { BANNER_AD_GROUP_ID, REFERENCE_NOTICE_TEXT } from '../config/app';
import { INDOOR_DRYING_TIPS } from '../content/indoorTips';
import type { ForecastState } from '../hooks/useForecast';
import {
  ACTIVITY_LABEL,
  formatWindow,
  headline,
  judge,
  mainTargetDate,
  type Activity,
  type Judgement,
} from '../scoring/judge';
import type { SelectedRegion } from '../storage/selectedRegion';
import { formatDateLabel } from '../utils/format';
import { addDays, toKst } from '../weather/kst';
import './Home.css';

const ACTIVITIES: Activity[] = ['laundry', 'blanket', 'carWash'];

interface HomeProps {
  region: SelectedRegion;
  forecast: ForecastState;
  onReload: () => void;
  onOpenDetail: (activity: Activity, date: string) => void;
  onOpenSettings: () => void;
  onChangeRegion: () => void;
}

export default function Home({ region, forecast, onReload, onOpenDetail, onOpenSettings, onChangeRegion }: HomeProps) {
  const nowKst = toKst(new Date());
  const now = { date: nowKst.date, hour: nowKst.hour };
  const { date: mainDate, isTomorrow } = mainTargetDate(now);
  const previewDate = addDays(mainDate, 1);

  return (
    <main className="home-screen">
      <header className="home-header">
        <button type="button" className="home-region-select" onClick={onChangeRegion}>
          {region.dong || region.sgg} <ChevronDownIcon />
        </button>
        <button type="button" className="home-settings" aria-label="설정" onClick={onOpenSettings}>
          <GearIcon />
        </button>
      </header>

      {forecast.status === 'loading' && <p className="home-status">예보를 불러오는 중이에요...</p>}

      {forecast.status === 'error' && (
        <div className="home-error card">
          <p className="home-error-title">최신 예보를 불러오지 못했어요</p>
          <p className="home-error-sub">잠시 후 다시 시도해주세요</p>
          <button type="button" className="home-retry" onClick={onReload}>
            다시 불러오기
          </button>
        </div>
      )}

      {forecast.status === 'ready' && (
        <HomeContent
          hours={forecast.data.hours}
          stale={forecast.stale}
          now={now}
          mainDate={mainDate}
          isTomorrow={isTomorrow}
          previewDate={previewDate}
          onOpenDetail={onOpenDetail}
        />
      )}

      <BannerAd adGroupId={BANNER_AD_GROUP_ID} />

      <SourceNotice
        baseDate={forecast.status === 'ready' ? forecast.data.baseDate : undefined}
        baseTime={forecast.status === 'ready' ? forecast.data.baseTime : undefined}
      />
    </main>
  );
}

interface HomeContentProps {
  hours: Parameters<typeof judge>[1];
  stale: boolean;
  now: { date: string; hour: number };
  mainDate: string;
  isTomorrow: boolean;
  previewDate: string;
  onOpenDetail: (activity: Activity, date: string) => void;
}

function HomeContent({ hours, stale, now, mainDate, isTomorrow, previewDate, onOpenDetail }: HomeContentProps) {
  const main = ACTIVITIES.map((a) => judge(a, hours, mainDate, now));
  const preview = ACTIVITIES.map((a) => judge(a, hours, previewDate, now));
  const laundry = main[0];
  const window = formatWindow(laundry.window);
  const previewLabel = isTomorrow ? '모레' : '내일';

  return (
    <>
      {stale && <p className="stale-notice">최신 예보를 불러오지 못했어요. 이전 예보로 보여드려요.</p>}

      <p className="home-eyebrow">
        {isTomorrow ? '내일 빨래 계획' : '오늘의 빨래'} · {formatDateLabel(mainDate)}
      </p>
      <h1 className="home-headline">{headline(laundry, isTomorrow)}</h1>
      <p className="home-reference">{REFERENCE_NOTICE_TEXT}</p>

      <section className="home-cards" aria-label="판정">
        {main.map((j) => (
          <button key={j.activity} type="button" className="home-card" onClick={() => onOpenDetail(j.activity, mainDate)}>
            <span className="home-card-name">{ACTIVITY_LABEL[j.activity]}</span>
            <VerdictBadge verdict={j.verdict} />
            <span className="home-card-score">{j.score === null ? '-' : `${j.score}점`}</span>
          </button>
        ))}
      </section>

      <section className="home-section card">
        <h2 className="home-section-title">{isTomorrow ? '내일' : '오늘'} 빨래하기 좋은 시간</h2>
        {window ? (
          <p className="home-window">{window}</p>
        ) : (
          <p className="home-window-empty">{noWindowText(laundry)}</p>
        )}
      </section>

      {laundry.verdict === 'bad' && (
        <section className="home-section card home-tips">
          <h2 className="home-section-title">실내에서 잘 말리는 법</h2>
          <ul>
            {INDOOR_DRYING_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="home-section card">
        <h2 className="home-section-title">
          {previewLabel} 미리보기 <span className="home-section-sub">{formatDateLabel(previewDate)}</span>
        </h2>
        <ul className="home-preview">
          {preview.map((j) => (
            <li key={j.activity}>
              <button type="button" className="home-preview-row" onClick={() => onOpenDetail(j.activity, previewDate)}>
                <span>{ACTIVITY_LABEL[j.activity]}</span>
                <span className="home-preview-right">
                  {j.activity !== 'carWash' && formatWindow(j.window) && (
                    <span className="home-preview-window">{formatWindow(j.window)}</span>
                  )}
                  <VerdictBadge verdict={j.verdict} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function noWindowText(j: Judgement): string {
  if (j.reason === 'no-data') return '아직 예보가 없어요';
  if (j.reason === 'not-enough-time') return '오늘은 남은 낮 시간이 부족해요';
  return '널어 말리기 좋은 시간이 없어요';
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="#191F28" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="#8B95A1"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"
        stroke="#8B95A1"
        strokeWidth="1.8"
      />
    </svg>
  );
}
