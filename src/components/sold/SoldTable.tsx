import { useState } from 'react';
import { Plus, Trash2, FileText, Pencil } from 'lucide-react';
import { ClientCell } from './ClientCell';
import { InfoCell } from './InfoCell';
import { InfoModal } from './InfoModal';
import { CheckCell } from './CheckCell';
import { DebtCell } from './DebtCell';
import { TemplateModal, renderTemplate } from './TemplateModal';
import { TemplateEditor } from './TemplateEditor';
import { createSoldEntry, deleteSoldEntry } from '../../db';
import type {
  Contact,
  SoldCheckKey,
  SoldEntry,
  SoldField,
  SoldTemplate,
} from '../../types';

interface Props {
  entries: SoldEntry[];
  contacts: Contact[];
  fields: SoldField[];
  templates: SoldTemplate[];
  boardId: string;
}

interface FixedCol {
  key: string;
  label: string;
  width: number;
}

const FIXED_COLS: FixedCol[] = [
  { key: 'client', label: 'Клиент', width: 220 },
  { key: 'info', label: 'Инфо', width: 160 },
  { key: 'ustavnye', label: 'Уставные', width: 110 },
  { key: 'contractSpec', label: 'Договор / Спека', width: 140 },
  { key: 'invoice', label: 'Счет', width: 90 },
  { key: 'pp', label: 'ПП', width: 80 },
  { key: 'debt', label: 'Долг', width: 130 },
  { key: 'upd', label: 'УПД', width: 90 },
  { key: 'shipping', label: 'Отправка', width: 110 },
];

const CHECK_COLS: Array<{ key: SoldCheckKey }> = [
  { key: 'ustavnye' },
  { key: 'contractSpec' },
  { key: 'invoice' },
  { key: 'pp' },
  { key: 'upd' },
  { key: 'shipping' },
];

const TEMPLATE_COL_WIDTH = 170;
const ADD_TEMPLATE_COL_WIDTH = 140;

export function SoldTable({ entries, contacts, fields, templates, boardId }: Props) {
  const [infoFor, setInfoFor] = useState<string | null>(null);
  // Composite: `${entryId}::${templateId}` opens render modal
  const [renderFor, setRenderFor] = useState<{ entryId: string; templateId: string } | null>(null);
  // Template editor: template === null means "creating new"
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const infoEntry = entries.find((e) => e.id === infoFor) ?? null;
  const renderEntry = renderFor ? entries.find((e) => e.id === renderFor.entryId) ?? null : null;
  const renderTpl = renderFor ? templates.find((t) => t.id === renderFor.templateId) ?? null : null;
  const editingTpl = editingTemplateId
    ? templates.find((t) => t.id === editingTemplateId) ?? null
    : null;

  async function addRow() {
    await createSoldEntry(boardId);
  }

  function openNewTemplate() {
    setEditingTemplateId(null);
    setEditorOpen(true);
  }

  function openEditTemplate(tplId: string) {
    setEditingTemplateId(tplId);
    setEditorOpen(true);
  }

  const totalWidth =
    FIXED_COLS.reduce((s, c) => s + c.width, 0) +
    templates.length * TEMPLATE_COL_WIDTH +
    ADD_TEMPLATE_COL_WIDTH +
    44; /* actions col */

  return (
    <>
      <div className="flex-1 overflow-auto">
        <table className="border-separate border-spacing-0" style={{ minWidth: totalWidth }}>
          <colgroup>
            {FIXED_COLS.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
            {templates.map((t) => (
              <col key={t.id} style={{ width: TEMPLATE_COL_WIDTH }} />
            ))}
            <col style={{ width: ADD_TEMPLATE_COL_WIDTH }} />
            <col style={{ width: 44 }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-ink-50">
            <tr>
              {FIXED_COLS.map((c) => (
                <th
                  key={c.key}
                  className="text-left text-[11px] uppercase tracking-wider font-medium text-ink-500 bg-ink-50 border-b border-ink-200 px-3 py-2.5"
                >
                  <span className="truncate block">{c.label}</span>
                </th>
              ))}
              {templates.map((t) => (
                <th
                  key={t.id}
                  className="text-left text-[11px] uppercase tracking-wider font-medium text-ink-500 bg-ink-50 border-b border-ink-200 group"
                >
                  <div className="flex items-center gap-1 px-3 py-2.5 min-w-0">
                    <span className="truncate flex-1">{t.name}</span>
                    <button
                      type="button"
                      onClick={() => openEditTemplate(t.id)}
                      title="Редактировать шаблон"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -mr-1 rounded hover:bg-ink-200 text-ink-500 hover:text-ink-900"
                    >
                      <Pencil size={11} />
                    </button>
                  </div>
                </th>
              ))}
              <th className="bg-ink-50 border-b border-ink-200 py-2 px-2">
                <button
                  type="button"
                  onClick={openNewTemplate}
                  className="w-full inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] uppercase tracking-wider font-medium text-ink-500 hover:text-ink-900 hover:bg-ink-100 rounded transition-colors"
                >
                  <Plus size={12} /> Шаблон
                </button>
              </th>
              <th className="bg-ink-50 border-b border-ink-200" />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td
                  colSpan={FIXED_COLS.length + templates.length + 2}
                  className="py-16 text-center"
                >
                  <div className="text-sm text-ink-400">
                    Пока нет сделок. Нажмите «Новая сделка», чтобы создать первую.
                  </div>
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="group hover:bg-ink-50/60 transition-colors">
                  {/* 1. Client */}
                  <td className="border-b border-ink-200 px-1 py-1 align-middle">
                    <ClientCell entry={e} boardId={boardId} contacts={contacts} />
                  </td>
                  {/* 2. Info */}
                  <td className="border-b border-ink-200 px-1 py-1 align-middle">
                    <InfoCell entry={e} fields={fields} onOpen={() => setInfoFor(e.id)} />
                  </td>
                  {/* 3-6: checks */}
                  {CHECK_COLS.slice(0, 4).map(({ key }) => (
                    <td
                      key={key}
                      className="border-b border-r border-ink-200 p-0 align-middle"
                    >
                      <CheckCell entry={e} ckey={key} />
                    </td>
                  ))}
                  {/* 7. Debt */}
                  <td className="border-b border-ink-200 align-middle">
                    <DebtCell entry={e} fields={fields} />
                  </td>
                  {/* 8, 9: upd, shipping */}
                  {CHECK_COLS.slice(4).map(({ key }) => (
                    <td
                      key={key}
                      className="border-b border-r border-ink-200 p-0 align-middle"
                    >
                      <CheckCell entry={e} ckey={key} />
                    </td>
                  ))}
                  {/* Dynamic template columns */}
                  {templates.map((t) => {
                    const rendered = renderTemplate(t.content, fields, e.info);
                    const missing = (rendered.match(/\?\?\?/g) ?? []).length;
                    return (
                      <td
                        key={t.id}
                        className="border-b border-ink-200 px-1 py-1 align-middle"
                      >
                        <button
                          type="button"
                          onClick={() => setRenderFor({ entryId: e.id, templateId: t.id })}
                          title={
                            missing > 0
                              ? `Незаполненных полей: ${missing}`
                              : 'Открыть и скопировать'
                          }
                          className="w-full inline-flex items-center justify-center gap-1 px-2 py-1 text-xs text-ink-600 hover:text-ink-900 hover:bg-ink-100 rounded transition-colors"
                        >
                          <FileText size={12} />
                          {missing === 0 ? 'Готов' : `${missing} пусто`}
                        </button>
                      </td>
                    );
                  })}
                  {/* + Шаблон trailing cell */}
                  <td className="border-b border-ink-200" />
                  {/* Actions */}
                  <td className="border-b border-ink-200 px-1 py-1 align-middle">
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          confirm(
                            `Удалить сделку «${e.contactName || 'без имени'}»? Связанный клиент в основном канбане не удаляется.`,
                          )
                        ) {
                          await deleteSoldEntry(e.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                      aria-label="Удалить сделку"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
            <tr>
              <td colSpan={FIXED_COLS.length + templates.length + 2} className="border-b border-ink-200">
                <button
                  type="button"
                  onClick={addRow}
                  className="w-full px-4 py-2.5 text-sm text-ink-500 hover:text-ink-900 hover:bg-ink-50 text-left inline-flex items-center gap-1.5 transition-colors"
                >
                  <Plus size={14} /> Новая сделка
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <InfoModal
        open={!!infoEntry}
        onClose={() => setInfoFor(null)}
        entry={infoEntry}
        fields={fields}
        boardId={boardId}
      />
      <TemplateModal
        open={!!renderEntry && !!renderTpl}
        onClose={() => setRenderFor(null)}
        entry={renderEntry}
        template={renderTpl}
        fields={fields}
        onEditTemplate={() => {
          if (renderTpl) {
            setEditingTemplateId(renderTpl.id);
            setEditorOpen(true);
            setRenderFor(null);
          }
        }}
      />
      <TemplateEditor
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingTemplateId(null);
        }}
        boardId={boardId}
        template={editingTpl}
        fields={fields}
      />
    </>
  );
}
