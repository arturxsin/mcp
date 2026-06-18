import { ChevronRight } from 'lucide-react';
import type { SoldEntry, SoldField } from '../../types';

interface Props {
  entry: SoldEntry;
  fields: SoldField[];
  onOpen: () => void;
}

export function InfoCell({ entry, fields, onOpen }: Props) {
  const total = fields.length;
  const filled = fields.filter((f) => (entry.info[f.id] ?? '').toString().trim()).length;
  const empty = filled === 0;
  const complete = total > 0 && filled === total;

  // Limit visible dots so the cell doesn't overflow when there are many fields
  const MAX_DOTS = 10;
  const dotsFields = fields.slice(0, MAX_DOTS);
  const overflow = fields.length - dotsFields.length;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center justify-between gap-1.5 px-2 py-1 rounded hover:bg-ink-100 transition-colors group"
    >
      <div className="flex items-center gap-1 min-w-0">
        <span className="flex items-center gap-0.5">
          {dotsFields.map((f) => {
            const isFilled = (entry.info[f.id] ?? '').toString().trim().length > 0;
            return (
              <span
                key={f.id}
                title={`${f.label}: ${isFilled ? entry.info[f.id] : '—'}`}
                className={`block h-1.5 w-1.5 rounded-full ${
                  isFilled ? (complete ? 'bg-emerald-500' : 'bg-ink-700') : 'bg-ink-200'
                }`}
              />
            );
          })}
          {overflow > 0 && (
            <span className="text-[9px] text-ink-400 ml-0.5">+{overflow}</span>
          )}
        </span>
        <span
          className={`ml-1.5 text-xs font-medium ${
            empty ? 'text-ink-400' : complete ? 'text-emerald-600' : 'text-ink-700'
          }`}
        >
          {filled}/{total}
        </span>
      </div>
      <ChevronRight size={12} className="text-ink-300 group-hover:text-ink-600 transition-colors" />
    </button>
  );
}
