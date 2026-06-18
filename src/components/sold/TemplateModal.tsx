import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal';
import { Copy, Check, Pencil } from 'lucide-react';
import type { SoldEntry, SoldField, SoldTemplate } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  entry: SoldEntry | null;
  template: SoldTemplate | null;
  fields: SoldField[];
  onEditTemplate: () => void;
}

export function renderTemplate(
  content: string,
  fields: SoldField[],
  info: Record<string, string>,
): string {
  const byLabel = new Map(fields.map((f) => [f.label.trim(), f]));
  return content.replace(/\{\{([^}]+)\}\}/g, (_, raw) => {
    const name = String(raw).trim();
    const f = byLabel.get(name);
    if (!f) return '???';
    const v = (info[f.id] ?? '').toString().trim();
    return v || '???';
  });
}

export function TemplateModal({
  open,
  onClose,
  entry,
  template,
  fields,
  onEditTemplate,
}: Props) {
  const [copied, setCopied] = useState(false);

  const text = useMemo(
    () => (entry && template ? renderTemplate(template.content, fields, entry.info) : ''),
    [entry, template, fields],
  );

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  if (!entry || !template) return null;

  const missing = (text.match(/\?\?\?/g) ?? []).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={680}
      title={
        <div className="flex items-center gap-2">
          <span>{template.name || 'Шаблон'}</span>
          <button
            type="button"
            onClick={onEditTemplate}
            title="Редактировать шаблон"
            className="text-ink-400 hover:text-ink-700 p-1 rounded hover:bg-ink-100 transition-colors"
          >
            <Pencil size={13} />
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-3">
        {missing > 0 && (
          <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md">
            Незаполненных полей: <strong>{missing}</strong>. В шаблоне они заменены на «???».
          </div>
        )}
        <textarea
          readOnly
          value={text}
          rows={12}
          className="w-full px-3 py-2.5 text-sm text-ink-800 bg-ink-50 border border-ink-200 rounded-md resize-none font-mono leading-relaxed"
        />
      </div>
      <div className="border-t border-ink-200 px-5 py-3 flex items-center justify-between">
        <span className="text-xs text-ink-400">
          Поля берутся из «Инфо». Заполните недостающие — и шаблон обновится.
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100 rounded-md transition-colors"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={copy}
            className={`px-3 py-1.5 text-sm font-medium rounded-md inline-flex items-center gap-1.5 transition-colors ${
              copied
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : 'bg-ink-900 text-white hover:bg-ink-700'
            }`}
          >
            {copied ? (
              <>
                <Check size={14} /> Скопировано
              </>
            ) : (
              <>
                <Copy size={14} /> Копировать
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
