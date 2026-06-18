import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../Modal';
import { Popover } from '../Popover';
import {
  createSoldTemplate,
  deleteSoldTemplate,
  updateSoldTemplate,
} from '../../db';
import type { SoldField, SoldTemplate } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  boardId: string;
  /** null = creating new template */
  template: SoldTemplate | null;
  fields: SoldField[];
}

export function TemplateEditor({ open, onClose, boardId, template, fields }: Props) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const cursorRef = useRef({ start: 0, end: 0 });
  const [insertAnchor, setInsertAnchor] = useState<HTMLElement | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) {
      setName(template?.name ?? '');
      setContent(template?.content ?? '');
      setSearch('');
      // place cursor at end on open
      setTimeout(() => {
        const ta = taRef.current;
        if (ta) {
          ta.focus();
          const len = ta.value.length;
          ta.setSelectionRange(len, len);
          cursorRef.current = { start: len, end: len };
        }
      }, 40);
    }
  }, [open, template]);

  function rememberCursor() {
    const ta = taRef.current;
    if (!ta) return;
    cursorRef.current = {
      start: ta.selectionStart ?? 0,
      end: ta.selectionEnd ?? ta.selectionStart ?? 0,
    };
  }

  function insertField(f: SoldField) {
    const ta = taRef.current;
    const token = `{{${f.label}}}`;
    const { start, end } = cursorRef.current;
    const next = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    setInsertOpen(false);
    setSearch('');
    setTimeout(() => {
      if (!ta) return;
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
      cursorRef.current = { start: pos, end: pos };
    }, 0);
  }

  async function save() {
    const n = name.trim();
    if (!n) return;
    if (template) {
      await updateSoldTemplate(template.id, { name: n, content });
    } else {
      await createSoldTemplate(boardId, n, content);
    }
    onClose();
  }

  async function remove() {
    if (!template) return;
    if (confirm(`Удалить шаблон «${template.name}»?`)) {
      await deleteSoldTemplate(template.id);
      onClose();
    }
  }

  const q = search.trim().toLowerCase();
  const filteredFields = useMemo(
    () => (q ? fields.filter((f) => f.label.toLowerCase().includes(q)) : fields),
    [fields, q],
  );

  // Highlight placeholders that don't match any field (visual hint only)
  const unknownPlaceholders = useMemo(() => {
    const known = new Set(fields.map((f) => f.label.trim()));
    const matches = Array.from(content.matchAll(/\{\{([^}]+)\}\}/g)).map((m) => m[1].trim());
    return Array.from(new Set(matches.filter((m) => !known.has(m))));
  }, [content, fields]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={680}
      title={template ? `Шаблон: ${template.name || 'без имени'}` : 'Новый шаблон'}
    >
      <div className="p-5 space-y-4">
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-wider text-ink-400 font-medium">
            Название (заголовок колонки)
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, «Поручение»"
            className="w-full px-3 py-2 text-sm border border-ink-200 rounded-md focus:border-ink-400"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase tracking-wider text-ink-400 font-medium">
              Текст шаблона
            </label>
            <button
              ref={setInsertAnchor}
              type="button"
              onMouseDown={(e) => {
                // Don't steal focus from textarea before we read selection
                e.preventDefault();
                rememberCursor();
              }}
              onClick={() => setInsertOpen((v) => !v)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-ink-700 hover:bg-ink-100 rounded transition-colors"
            >
              <Plus size={12} /> Вставить поле из Инфо
            </button>
          </div>
          <textarea
            ref={taRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={rememberCursor}
            onKeyUp={rememberCursor}
            onClick={rememberCursor}
            placeholder={'Пишите свой текст. Поля из Инфо вставляются как {{Название поля}}.'}
            rows={12}
            className="w-full px-3 py-2.5 text-sm font-mono leading-relaxed border border-ink-200 rounded-md focus:border-ink-400 resize-y placeholder:text-ink-300"
          />
          <div className="text-[11px] text-ink-400">
            Подсказка: текст в фигурных скобках, например{' '}
            <code className="px-1 py-0.5 bg-ink-100 rounded">{'{{Майнер}}'}</code>, при выводе
            заменяется на значение поля из «Инфо». Пустые значения → «???».
          </div>
          {unknownPlaceholders.length > 0 && (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              В шаблоне есть плейсхолдеры без совпадения с полями Инфо:{' '}
              {unknownPlaceholders.map((p, i) => (
                <span key={p}>
                  <code className="px-1 bg-white/60 rounded">{`{{${p}}}`}</code>
                  {i < unknownPlaceholders.length - 1 && ', '}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <Popover
        anchor={insertAnchor}
        open={insertOpen}
        onClose={() => setInsertOpen(false)}
        align="right"
        width={260}
      >
        <div className="px-2 py-1.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск поля…"
            className="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-md focus:border-ink-400"
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filteredFields.length === 0 && (
            <div className="px-2 py-3 text-xs text-ink-400 text-center">
              {q ? 'Не найдено' : 'Полей пока нет. Добавьте их в «Инфо».'}
            </div>
          )}
          {filteredFields.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => insertField(f)}
              className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-ink-100 rounded-md text-left text-sm transition-colors"
            >
              <span className="truncate">{f.label}</span>
              <code className="text-[10px] text-ink-400">{`{{${f.label}}}`}</code>
            </button>
          ))}
        </div>
      </Popover>

      <div className="border-t border-ink-200 px-5 py-3 flex items-center justify-between">
        {template ? (
          <button
            type="button"
            onClick={remove}
            className="text-sm text-red-500 hover:text-red-600 inline-flex items-center gap-1.5 transition-colors"
          >
            <Trash2 size={14} /> Удалить шаблон
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100 rounded-md transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-sm font-medium bg-ink-900 text-white rounded-md hover:bg-ink-700 disabled:opacity-40 transition-colors"
          >
            {template ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
