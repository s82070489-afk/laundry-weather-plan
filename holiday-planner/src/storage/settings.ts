import { APP_NAME } from '../config/appName';
import { plannerConfig } from '../config/planner';

const STORAGE_KEY = `${APP_NAME}:settings`;

export interface PlannerSettings {
  /** 5월 1일 근로자의날에 쉬는지 (공공데이터에는 휴일로 없어서 따로 반영) */
  laborDayOff: boolean;
}

export const DEFAULT_SETTINGS: PlannerSettings = {
  laborDayOff: plannerConfig.laborDay.defaultOn,
};

export function loadSettings(): PlannerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<PlannerSettings>) : {};
    return {
      laborDayOff: typeof saved.laborDayOff === 'boolean' ? saved.laborDayOff : DEFAULT_SETTINGS.laborDayOff,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: PlannerSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 저장 실패(사생활 보호 모드 등)는 이번 실행에서만 적용된다
  }
}
