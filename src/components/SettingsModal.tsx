import { Modal } from './Modal';
import type { AppSettings } from '../settings';

interface Props {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
}

export function SettingsModal({ open, onClose, settings, onChange }: Props) {
  return (
    <Modal open={open} onClose={onClose} width={420} title="Настройки">
      <div className="p-5 space-y-4">
        <ToggleRow
          label="Аватар клиента"
          description="Фото в карточке и колонке таблицы"
          checked={settings.avatarEnabled}
          onChange={(v) => onChange({ ...settings, avatarEnabled: v })}
        />
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
