import { APP_NAME } from '../config/appName';

const STORAGE_KEY = `${APP_NAME}:notification-settings`;

/** v1.0은 저장만 하고 실제 발송은 v1.1에서 */
export interface NotificationSettings {
  morningEnabled: boolean;
  /** "HH:MM" */
  morningTime: string;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  morningEnabled: false,
  morningTime: '07:00',
};

export function saveNotificationSettings(settings: NotificationSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) } : DEFAULT_NOTIFICATION_SETTINGS;
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}
