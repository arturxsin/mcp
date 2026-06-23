export interface TouchThreshold {
  days: number;
  color: string;
}

export interface AppSettings {
  avatarEnabled: boolean;
  touchThresholds: TouchThreshold[];
}

const KEY = 'crm-app-settings';

export const DEFAULT_TOUCH_THRESHOLDS: TouchThreshold[] = [
  { days: 10, color: '#22c55e' },
  { days: 20, color: '#f59e0b' },
  { days: 30, color: '#ef4444' },
];

const DEFAULTS: AppSettings = {
  avatarEnabled: false,
  touchThresholds: DEFAULT_TOUCH_THRESHOLDS,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...p,
      touchThresholds: Array.isArray(p.touchThresholds) ? p.touchThresholds : DEFAULT_TOUCH_THRESHOLDS,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
