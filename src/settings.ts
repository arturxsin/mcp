export interface AppSettings {
  avatarEnabled: boolean;
}

const KEY = 'crm-app-settings';

const DEFAULTS: AppSettings = {
  avatarEnabled: false,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
