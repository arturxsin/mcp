import { Check } from 'lucide-react';
import { toggleSoldCheck } from '../../db';
import type { SoldCheckKey, SoldEntry } from '../../types';

interface Props {
  entry: SoldEntry;
  ckey: SoldCheckKey;
}

export function CheckCell({ entry, ckey }: Props) {
  const on = entry.checks[ckey];
  return (
    <button
      type="button"
      onClick={() => toggleSoldCheck(entry.id, ckey)}
      aria-pressed={on}
      className={`w-full h-full min-h-[36px] flex items-center justify-center transition-colors ${
        on
          ? 'bg-emerald-200 hover:bg-emerald-300'
          : 'bg-white hover:bg-ink-100'
      }`}
    >
      <span
        className={`inline-flex items-center justify-center h-[18px] w-[18px] rounded-[3px] transition-colors ${
          on
            ? 'bg-emerald-600 text-white'
            : 'border border-ink-300 bg-white'
        }`}
      >
        {on && <Check size={13} strokeWidth={3} />}
      </span>
    </button>
  );
}
