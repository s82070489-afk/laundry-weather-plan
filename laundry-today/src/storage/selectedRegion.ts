import { APP_NAME } from '../config/appName';

const STORAGE_KEY = `${APP_NAME}:selected-region`;

export interface SelectedRegion {
  code: string;
  sido: string;
  sgg: string;
  dong: string;
  label: string;
  nx: number;
  ny: number;
}

export function saveSelectedRegion(region: SelectedRegion): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(region));
}

export function loadSelectedRegion(): SelectedRegion | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SelectedRegion) : null;
  } catch {
    return null;
  }
}
