import { Popover } from './Popover';
import { Check } from 'lucide-react';
import type { FieldDef } from '../types';
import { FIELD_TYPE_LABELS } from '../utils';
import { updateField } from '../db';

interface Props {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  fields: FieldDef[];
}

export function ColumnPicker({ anchor, open, onClose, fields }: Props) {
  return (
    <Popover anchor={anchor} open={open} onClose={onClose} align="right" width={260}>
      <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-ink-400 font-medium">
        Колонки в таблице
      </div>
      {fields.length === 0 && (
        <div className="px-2 py-3 text-sm text-ink-400 text-center">
          Полей пока нет.
          <br />
          Добавьте их в карточке клиента.
        </div>
      )}
      {fields.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => updateField(f.id, { visibleInTable: !f.visibleInTable })}
          className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-ink-100 rounded-md text-left transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="truncate text-sm">{f.name}</span>
            <span className="text-[10px] uppercase text-ink-400 shrink-0">
              {FIELD_TYPE_LABELS[f.type]}
            </span>
          </span>
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
              f.visibleInTable
                ? 'bg-ink-900 border-ink-900 text-white'
                : 'border-ink-300 bg-white'
            }`}
          >
            {f.visibleInTable && <Check size={10} strokeWidth={3} />}
          </span>
        </button>
      ))}
    </Popover>
  );
}
