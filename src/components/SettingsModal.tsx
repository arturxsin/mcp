import { Modal } from './Modal';
import type { AppSettings } from '../settings';
import { DEFAULT_TOUCH_THRESHOLDS } from '../settings';

interface Props {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
}

export function SettingsModal({ open, onClose, settings, onChange }: Props) {
  return (
    <Modal open={open} onClose={onClose} width={420} title="Настройки">
      <div className="p-5 space-y-5">
        <ToggleRow
          label="Аватар клиента"
          description="Фото в карточке и в столбце с именем"
          checked={settings.avatarEnabled}
          onChange={(v) => onChange({ ...settings, avatarEnabled: v })}
        />
        <div className="border-t border-ink-100 pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-ink-900">Пороги касания</div>
              <div className="text-xs text-ink-400 mt-0.5">Дней без касания → цвет счётчика</div>
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...settings, touchThresholds: DEFAULT_TOUCH_THRESHOLDS })}
              className="text-xs text-ink-400 hover:text-indigo-600 transition-colors"
            >
              Сброс
            </button>
          </div>
          <div className="space-y-2">
            {settings.touchThresholds.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-ink-400 w-4 shrink-0">≤</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={t.days}
                  onChange={(e) => {
                    const next = settings.touchThresholds.map((x, j) =>
                      j === i ? { ...x, days: Math.max(1, parseInt(e.target.value) || 1) } : x
                    );
                    onChange({ ...settings, touchThresholds: next });
                  }}
                  className="w-16 px-2 py-1 text-sm border border-ink-200 rounded-md focus:outline-none focus:border-indigo-400 text-center tabular-nums"
                />
                <span className="text-xs text-ink-400 shrink-0">дней</span>
                <input
                  type="color"
                  value={t.color}
                  onChange={(e) => {
                    const next = settings.touchThresholds.map((x, j) =>
                      j === i ? { ...x, color: e.target.value } : x
                    );
                    onChange({ ...settings, touchThresholds: next });
                  }}
                  className="w-8 h-7 rounded border border-ink-200 cursor-pointer p-0.5"
                />
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-ink-200 px-5 py-3 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-sm font-medium bg-ink-100 hover:bg-ink-200 rounded-md transition-colors"
        >
          Закрыть
        </button>
      </div>
    </Modal>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-ink-900">{label}</div>
        <div className="text-xs text-ink-400 mt-0.5">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
          checked ? 'bg-ink-900' : 'bg-ink-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
