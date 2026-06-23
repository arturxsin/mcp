import type { Contact, Status } from '../types';

interface Props {
  statuses: Status[];
  contacts: Contact[];
  active: string | null; // null = all
  onChange: (statusId: string | null) => void;
}

export function StatusSidebar({ statuses, contacts, active, onChange }: Props) {
  const countAll = contacts.length;
  const countMap = new Map<string, number>();
  for (const c of contacts) {
    const ids = c.statusIds ?? (c.statusId ? [c.statusId] : []);
    for (const id of ids) {
      countMap.set(id, (countMap.get(id) ?? 0) + 1);
    }
  }

  return (
    <aside className="w-44 shrink-0 border-r border-ink-200 bg-ink-50 flex flex-col overflow-y-auto">
      <Tab
        label="Главная"
        count={countAll}
        color={null}
        active={active === null}
        onClick={() => onChange(null)}
      />
      <div className="h-px bg-ink-200 mx-3" />
      {statuses.map((s) => (
        <Tab
          key={s.id}
          label={s.name}
          count={countMap.get(s.id) ?? 0}
          color={s.color}
          active={active === s.id}
          onClick={() => onChange(s.id)}
        />
      ))}
    </aside>
  );
}

function Tab({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors text-sm
        ${active
          ? 'bg-white border-r-2 font-medium text-ink-900'
          : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 border-r-2 border-transparent'
        }`}
      style={active && color ? { borderRightColor: color } : undefined}
    >
      {color && (
        <span
          className="shrink-0 w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {!color && (
        <span className="shrink-0 w-2 h-2 rounded-full bg-ink-400" />
      )}
      <span className="flex-1 truncate">{label}</span>
      <span className={`shrink-0 text-xs tabular-nums ${active ? 'text-ink-500' : 'text-ink-400'}`}>
        {count}
      </span>
    </button>
  );
}
