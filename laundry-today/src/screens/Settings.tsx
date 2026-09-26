import { useState } from 'react';
import { PRIVACY_POLICY_URL, REFERENCE_NOTICE_TEXT, WEATHER_SOURCE_TEXT } from '../config/app';
import {
  loadNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
} from '../storage/notificationSettings';
import type { SelectedRegion } from '../storage/selectedRegion';
import { openExternal } from '../utils/openExternal';
import './Settings.css';

interface SettingsProps {
  region: SelectedRegion;
  onChangeRegion: () => void;
  onSaved: () => void;
}

const TIME_OPTIONS = ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00'];

export default function Settings({ region, onChangeRegion, onSaved }: SettingsProps) {
  const [settings, setSettings] = useState<NotificationSettings>(() => loadNotificationSettings());

  const handleSave = () => {
    saveNotificationSettings(settings);
    onSaved();
  };

  return (
    <main className="settings-screen">
      <h1 className="settings-title">설정</h1>

      <h2 className="settings-group-title">동네</h2>
      <ul className="settings-list">
        <li className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">{region.label}</span>
          </div>
          <button type="button" className="settings-link-button" onClick={onChangeRegion}>
            변경
          </button>
        </li>
      </ul>

      <h2 className="settings-group-title">알림</h2>
      <ul className="settings-list">
        <li className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">아침 판정 알림</span>
            <span className="settings-row-desc">오늘 빨래해도 되는지 아침에 알려드려요 (곧 지원돼요)</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.morningEnabled}
            aria-label="아침 판정 알림"
            className={`settings-switch${settings.morningEnabled ? ' is-on' : ''}`}
            onClick={() => setSettings((prev) => ({ ...prev, morningEnabled: !prev.morningEnabled }))}
          >
            <span className="settings-switch-knob" />
          </button>
        </li>
        <li className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">알림 시간</span>
          </div>
          <select
            className="settings-select"
            value={settings.morningTime}
            disabled={!settings.morningEnabled}
            onChange={(e) => setSettings((prev) => ({ ...prev, morningTime: e.target.value }))}
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
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
        {WEATHER_SOURCE_TEXT}
        <br />
        {REFERENCE_NOTICE_TEXT}
      </p>

      <div className="settings-spacer" />

      <button type="button" className="settings-cta" onClick={handleSave}>
        저장하기
      </button>
    </main>
  );
}
