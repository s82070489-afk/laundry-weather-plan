import { HOLIDAY_SOURCE_TEXT, PRIVACY_POLICY_URL } from '../config/app';
import type { PlannerSettings } from '../storage/settings';
import { openExternal } from '../utils/openExternal';
import './Settings.css';

interface SettingsProps {
  settings: PlannerSettings;
  /** 바꾸는 즉시 저장된다 */
  onChange: (settings: PlannerSettings) => void;
}

export default function Settings({ settings, onChange }: SettingsProps) {
  return (
    <main className="settings-screen">
      <h1 className="settings-title">설정</h1>

      <h2 className="settings-group-title">쉬는 날</h2>
      <ul className="settings-list">
        <li className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">5월 1일 근로자의날에 쉬어요</span>
            <span className="settings-row-desc">공휴일 데이터에는 없어서 따로 반영해요. 켜면 연휴·연차 추천에서 쉬는 날로 계산해요</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.laborDayOff}
            aria-label="5월 1일 근로자의날에 쉬어요"
            className={`settings-switch${settings.laborDayOff ? ' is-on' : ''}`}
            onClick={() => onChange({ ...settings, laborDayOff: !settings.laborDayOff })}
          >
            <span className="settings-switch-knob" />
          </button>
        </li>
        <li className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">근무 요일</span>
            <span className="settings-row-desc">토·일요일 휴무 기준으로 계산해요</span>
          </div>
          <span className="settings-row-value">주 5일</span>
        </li>
      </ul>

      <h2 className="settings-group-title">정보</h2>
      <ul className="settings-list">
        <li className="settings-row">
          <button type="button" className="settings-row-button" onClick={() => openExternal(PRIVACY_POLICY_URL)}>
            <span className="settings-row-title">개인정보처리방침</span>
            <span className="settings-chevron" aria-hidden="true">
              ›
            </span>
          </button>
        </li>
      </ul>

      <p className="settings-footnote">
        {HOLIDAY_SOURCE_TEXT}
        <br />
        연휴·연차 계산은 참고용이에요. 회사 규정과 다를 수 있어요.
      </p>
    </main>
  );
}
