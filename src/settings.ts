export interface TouchThreshold {
  days: number;
  color: string;
}

export interface BudgetThreshold {
  amount: number;
  color: string;
}

export interface AppSettings {
  avatarEnabled: boolean;
  touchThresholds: TouchThreshold[];
  budgetThresholds: BudgetThreshold[];
  budgetColorEnabled: boolean;
}

const KEY = 'crm-app-settings';

export const DEFAULT_TOUCH_THRESHOLDS: TouchThreshold[] = [
  { days: 10, color: '#22c55e' },
  { days: 20, color: '#f59e0b' },
  { days: 30, color: '#ef4444' },
];

export const DEFAULT_BUDGET_THRESHOLDS: BudgetThreshold[] = [
  { amount: 1_000_000, color: '#ef4444' },
  { amount: 5_000_000, color: '#f59e0b' },
  { amount: 10_000_000, color: '#22c55e' },
];

const DEFAULTS: AppSettings = {
  avatarEnabled: false,
  touchThresholds: DEFAULT_TOUCH_THRESHOLDS,
  budgetThresholds: DEFAULT_BUDGET_THRESHOLDS,
  budgetColorEnabled: true,
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
      budgetThresholds: Array.isArray(p.budgetThresholds) ? p.budgetThresholds : DEFAULT_BUDGET_THRESHOLDS,
      budgetColorEnabled: typeof p.budgetColorEnabled === 'boolean' ? p.budgetColorEnabled : true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
