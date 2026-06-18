import { STATUS_PALETTE } from '../utils';

interface Props {
  value: string;
  onChange: (color: string) => void;
}

export function ColorSwatch({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {STATUS_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{ backgroundColor: c }}
          className={`h-6 w-6 rounded-md transition-transform ${
            value === c ? 'ring-2 ring-offset-1 ring-ink-900 scale-105' : 'hover:scale-110'
          }`}
          aria-label={c}
        />
      ))}
    </div>
  );
}
