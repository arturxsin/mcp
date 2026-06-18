import type { SoldEntry, SoldField } from '../../types';

interface Props {
  entry: SoldEntry;
  fields: SoldField[];
}

export function DebtCell({ entry, fields }: Props) {
  // Find the field semantically marked as 'debt'. Fallback to label match.
  const debtField =
    fields.find((f) => f.key === 'debt') ??
    fields.find((f) => f.label.trim().toLowerCase() === 'долг');
  if (!debtField) {
    return <div className="px-2 py-1 text-sm text-ink-300">—</div>;
  }
  const raw = (entry.info[debtField.id] ?? '').toString().trim();
  if (!raw) {
    return <div className="px-2 py-1 text-sm text-ink-300">—</div>;
  }
  const cleaned = raw.replace(/[^\d.,-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  const isZero = !Number.isNaN(num) && num === 0;
  if (isZero) {
    return (
      <div className="mx-1 my-0.5 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 rounded text-center">
        Долга нет
      </div>
    );
  }
  return (
    <div className="px-2 py-1 text-sm text-ink-900 font-medium truncate" title={raw}>
      {raw}
    </div>
  );
}
