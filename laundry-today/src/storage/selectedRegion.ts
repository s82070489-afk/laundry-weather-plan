import { APP_NAME } from '../config/appName';
import { resolveGrid } from '../utils/grid';

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

/**
 * 저장된 동네를 불러오면서 격자를 현재 매핑표 기준으로 다시 찾는다.
 * 매핑표가 갱신돼 동이 없어졌으면 같은 시/군/구 대표 격자로, 그것도 없으면 저장값 그대로 쓴다.
 */
export function loadSelectedRegion(): SelectedRegion | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const region = JSON.parse(raw) as SelectedRegion;
    const grid = resolveGrid(region.sido, region.sgg, region.dong);
    return grid ? { ...region, ...grid } : region;
  } catch {
    return null;
  }
}
