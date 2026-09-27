import { APP_NAME } from '../config/appName';
import { isValidDate } from '../lib/date';

const STORAGE_KEY = `${APP_NAME}:hire-date`;

/** 입사일 (YYYY-MM-DD). 기기에만 저장한다 */
export function loadHireDate(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isValidDate(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveHireDate(date: string | null): void {
  try {
    if (date) localStorage.setItem(STORAGE_KEY, date);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장 실패는 이번 실행에서만 적용된다
  }
}
