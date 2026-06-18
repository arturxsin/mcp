import { useRef, useState } from 'react';
import { Search, X, Filter, Columns3, Check } from 'lucide-react';
import { Popover } from './Popover';
import { StatusBadge } from './StatusBadge';
import type { Status } from '../types';

interface Props {
  search: string;
  onSearch: (s: string) => void;
  statusFilter: Set<string>;
  onStatusFilterChange: (next: Set<string>) => void;
  statuses: Status[];
  onColumnsClick: () => void;
  columnsBtnRef: React.RefObject<HTMLButtonElement>;
}

export function Toolbar({
  search,
  onSearch,
  statusFilter,
  onStatusFilterChange,
  statuses,
  onColumnsClick,
  columnsBtnRef,
}: Props) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterAnchor = useRef<HTMLButtonElement>(null);

  function toggleStatus(id: string) {
    const next = new Set(statusFilter);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onStatusFilterChange(next);
  }

  const filterActive = statusFilter.size > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Поиск по клиентам…"
          className="w-full pl-8 pr-8 py-1.5 text-sm bg-ink-100 border border-transparent focus:bg-white focus:border-ink-300 rounded-md transition-colors placeholder:text-ink-400"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <button
        ref={filterAnchor}
        type="button"
        onClick={() => setFilterOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors text-sm ${
          filterActive ? 'bg-ink-900 text-white hover:bg-ink-700' : 'text-ink-700 hover:bg-ink-100'
        }`}
      >
        <Filter size={14} />
        Фильтр
        {filterActive && (
          <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-semibold bg-white text-ink-900 rounded-full px-1">
            {statusFilter.size}
          </span>
        )}
      </button>
      <Popover anchor={filterAnchor.current} open={filterOpen} onClose={() => setFilterOpen(false)} width={240}>
        <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-ink-400 font-medium">
          Фильтр по статусу
        </div>
        {statuses.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggleStatus(s.id)}
            className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-ink-100 rounded-md text-left transition-colors"
          >
            <StatusBadge status={s} size="sm" />
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                statusFilter.has(s.id)
                  ? 'bg-ink-900 border-ink-900 text-white'
                  : 'border-ink-300 bg-white'
              }`}
            >
              {statusFilter.has(s.id) && <Check size={10} strokeWidth={3} />}
            </span>
          </button>
        ))}
        {filterActive && (
          <>
            <div className="border-t border-ink-200 my-1" />
            <button
              type="button"
              onClick={() => onStatusFilterChange(new Set())}
              className="w-full px-2 py-1.5 hover:bg-ink-100 rounded-md text-left text-xs text-ink-500 transition-colors"
            >
              Сбросить
            </button>
          </>
        )}
      </Popover>

      <button
        ref={columnsBtnRef}
        type="button"
        onClick={onColumnsClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-ink-700 hover:bg-ink-100 rounded-md transition-colors"
      >
        <Columns3 size={14} />
        Колонки
      </button>
    </div>
  );
}
