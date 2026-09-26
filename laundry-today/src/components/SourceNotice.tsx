import { FINE_DUST_NOTICE_TEXT, REFERENCE_NOTICE_TEXT, WEATHER_SOURCE_TEXT } from '../config/app';
import { formatBaseLabel } from '../utils/format';

interface SourceNoticeProps {
  baseDate?: string;
  baseTime?: string;
  /** 판정 근거 화면에서만 미세먼지 안내 노출 */
  showFineDust?: boolean;
}

export default function SourceNotice({ baseDate, baseTime, showFineDust }: SourceNoticeProps) {
  return (
    <footer className="source-notice">
      {showFineDust && <p className="source-notice-dust">{FINE_DUST_NOTICE_TEXT}</p>}
      <p>
        {WEATHER_SOURCE_TEXT}
        {baseDate && baseTime && ` · ${formatBaseLabel(baseDate, baseTime)}`}
      </p>
      <p>{REFERENCE_NOTICE_TEXT}</p>
    </footer>
  );
}
