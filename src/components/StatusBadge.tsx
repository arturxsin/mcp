import type { Status } from '../types';
import { contrastText } from '../utils';

interface Props {
  status?: Status | null;
  placeholder?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, placeholder = '—', size = 'md' }: Props) {
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';
  const text = size === 'sm' ? 'text-[11px]' : 'text-xs';
  if (!status) {
    return (
      <span
        className={`inline-flex items-center ${padding} rounded-md ${text} font-medium text-ink-400 bg-ink-100 whitespace-nowrap`}
      >
        {placeholder}
      </span>
    );
  }
  const fg = contrastText(status.color);
  return (
    <span
      style={{ backgroundColor: status.color, color: fg }}
      className={`inline-flex items-center ${padding} rounded-md ${text} font-medium whitespace-nowrap`}
    >
      {status.name}
    </span>
  );
}
