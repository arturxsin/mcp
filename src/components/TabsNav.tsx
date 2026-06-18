import { cn } from '../utils';

export type ViewKey = 'kanban' | 'sold';

interface Props {
  current: ViewKey;
  onChange: (v: ViewKey) => void;
}

const TABS: Array<{ key: ViewKey; label: string }> = [
  { key: 'kanban', label: 'Клиенты' },
  { key: 'sold', label: 'SOLD' },
];

export function TabsNav({ current, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-0.5 bg-ink-100 rounded-md p-0.5">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={cn(
            'px-3 py-1 text-sm font-medium rounded transition-colors',
            current === t.key
              ? 'bg-white text-ink-900 shadow-sm'
              : 'text-ink-500 hover:text-ink-900',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
