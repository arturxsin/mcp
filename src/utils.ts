import type { FieldType } from './types';

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Текст',
  phone: 'Телефон',
  email: 'Email',
  note: 'Заметка',
  link: 'Ссылка',
};

export const FIELD_TYPE_OPTIONS: Array<{ value: FieldType; label: string }> = [
  { value: 'text', label: 'Текст' },
  { value: 'phone', label: 'Телефон' },
  { value: 'email', label: 'Email' },
  { value: 'note', label: 'Заметка' },
  { value: 'link', label: 'Ссылка' },
];

export interface LinkValue {
  url: string;
  label: string;
}

export function parseLinkValue(v: string): LinkValue {
  try {
    const p = JSON.parse(v);
    if (p && typeof p === 'object') return { url: p.url ?? '', label: p.label ?? '' };
  } catch {}
  return { url: v, label: '' };
}

export function encodeLinkValue(url: string, label: string): string {
  return JSON.stringify({ url, label });
}

export function inputTypeFor(t: FieldType): string {
  switch (t) {
    case 'phone':
      return 'tel';
    case 'email':
      return 'email';
    default:
      return 'text';
  }
}

export function placeholderFor(t: FieldType): string {
  switch (t) {
    case 'phone':
      return '+7 999 123-45-67';
    case 'email':
      return 'name@example.com';
    case 'note':
      return 'Заметка…';
    default:
      return '';
  }
}

// Accessible text colour for a background hex
export function contrastText(hex: string): string {
  const c = hex.replace('#', '');
  if (c.length !== 6) return '#fff';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // Relative luminance
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.6 ? '#18181b' : '#ffffff';
}

export const STATUS_PALETTE = [
  '#6366f1',
  '#3b82f6',
  '#0ea5e9',
  '#06b6d4',
  '#10b981',
  '#22c55e',
  '#84cc16',
  '#eab308',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#8b5cf6',
  '#64748b',
  '#71717a',
];

export function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ');
}

export function looksLikeUrl(s: string): boolean {
  return /^https?:\/\/\S+/.test(s.trim());
}

export function formatBudget(n: number): string {
  if (!n) return '';
  return new Intl.NumberFormat('ru-RU').format(Math.round(n));
}

export function formatPhone(v: string): string {
  const d = v.replace(/\D/g, '');
  if (d.length === 11) {
    return `${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
  }
  return v;
}
