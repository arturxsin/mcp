import { Popover } from './Popover';
import { Check, Settings2 } from 'lucide-react';
import type { Status } from '../types';
import { contrastText } from '../utils';

interface Props {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  statuses: Status[];
  currentIds: string[];
  onToggle: (statusId: string) => void;
  onManage?: () => void;
}

export function StatusPicker({ anchor, open, onClose, statuses, currentIds, onToggle, onManage }: Props) {
  return (
    <Popover anchor={anchor} open={open} onClose={onClose} width={220}>
      <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-ink-400 font-medium">
        Статус
      </div>
      {statuses.map((s) => {
        const active = currentIds.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onToggle(s.id)}
            className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-ink-100 rounded-md text-left transition-colors"
          >
            <span
              style={{ backgroundColor: s.color, color: contrastText(s.color) }}
              className="px-2 py-0.5 rounded text-[11px] font-medium"
            >
              {s.name}
            </span>
            {active && <Check size={14} className="text-ink-700 shrink-0" />}
          </button>
        );
      })}
      {onManage && (
        <>
          <div className="border-t border-ink-200 my-1" />
          <button
            type="button"
            onClick={() => { onManage(); onClose(); }}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-ink-100 rounded-md text-left text-xs text-ink-600 transition-colors"
          >
            <Settings2 size={12} /> Настроить статусы
          </button>
        </>
      )}
    </Popover>
  );
}
