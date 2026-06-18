import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, ArrowUpDown, GripVertical, Settings2 } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { StatusPicker } from './StatusPicker';
import { InlineCell } from './InlineCell';
import { ColumnResizer } from './ColumnResizer';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createContact, reorderFields, setColumnWidth, updateContact } from '../db';
import type { Board, Contact, FieldDef, Status } from '../types';

type SortDir = 'asc' | 'desc';
type SortKey = { type: 'name' } | { type: 'status' } | { type: 'field'; fieldId: string };

const DEFAULT_WIDTHS = {
  status: 140,
  name: 220,
  field: 180,
};

interface Props {
  contacts: Contact[];
  fields: FieldDef[]; // visible only
  allFields: FieldDef[]; // for reorder
  statuses: Status[];
  board: Board | null;
  boardId: string;
  onOpenContact: (id: string) => void;
  onOpenStatusManager: () => void;
  search: string;
  statusFilter: Set<string>;
}

export function Table({
  contacts,
  fields,
  allFields,
  statuses,
  board,
  boardId,
  onOpenContact,
  onOpenStatusManager,
  search,
  statusFilter,
}: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [tempWidths, setTempWidths] = useState<Record<string, number>>({});

  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);

  // Resolved widths: temp (during drag) > persisted (board.columnWidths) > defaults
  const widths = useMemo(() => {
    const persisted = board?.columnWidths ?? {};
    return {
      status: tempWidths.status ?? persisted.status ?? DEFAULT_WIDTHS.status,
      name: tempWidths.name ?? persisted.name ?? DEFAULT_WIDTHS.name,
      forField: (id: string) => tempWidths[id] ?? persisted[id] ?? DEFAULT_WIDTHS.field,
    };
  }, [board, tempWidths]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (statusFilter.size > 0) {
        if (!c.statusId || !statusFilter.has(c.statusId)) return false;
      }
      if (!q) return true;
      if (c.name.toLowerCase().includes(q)) return true;
      for (const v of Object.values(c.values)) {
        if (v && v.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [contacts, search, statusFilter]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const get = (c: Contact): string | number => {
      if (sort.key.type === 'name') return c.name.toLowerCase();
      if (sort.key.type === 'status') {
        if (!c.statusId) return Number.MAX_SAFE_INTEGER;
        return statusMap.get(c.statusId)?.order ?? Number.MAX_SAFE_INTEGER;
      }
      return (c.values[sort.key.fieldId] ?? '').toLowerCase();
    };
    return [...filtered].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [filtered, sort, statusMap]);

  function toggleSort(key: SortKey) {
    setSort((s) => {
      if (!s || sortKeyId(s.key) !== sortKeyId(key)) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }

  function isSorted(key: SortKey): SortDir | null {
    if (!sort) return null;
    return sortKeyId(sort.key) === sortKeyId(key) ? sort.dir : null;
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const draggable = fields.map((f) => f.id);
    const oldIndex = draggable.indexOf(String(active.id));
    const newIndex = draggable.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reorderedVisible = arrayMove(fields, oldIndex, newIndex);
    const newAll = [...allFields];
    const visibleIds = new Set(fields.map((f) => f.id));
    let vi = 0;
    for (let i = 0; i < newAll.length; i++) {
      if (visibleIds.has(newAll[i].id)) {
        newAll[i] = reorderedVisible[vi++];
      }
    }
    await reorderFields(
      boardId,
      newAll.map((f) => f.id),
    );
  }

  async function addRow() {
    const id = await createContact(boardId);
    onOpenContact(id);
  }

  function handleDrag(key: string, w: number) {
    setTempWidths((prev) => ({ ...prev, [key]: w }));
  }

  async function handleCommit(key: string, w: number) {
    await setColumnWidth(boardId, key, w);
    setTempWidths((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function autoFit(key: 'status' | 'name' | string) {
    // Measure widest displayed text for the column
    const samples: string[] = [];
    if (key === 'status') {
      // header
      samples.push('Статус');
      for (const s of statuses) samples.push(s.name);
    } else if (key === 'name') {
      samples.push('Имя клиента');
      for (const c of sorted) samples.push(c.name);
    } else {
      const f = fields.find((x) => x.id === key);
      if (f) samples.push(f.name);
      for (const c of sorted) {
        const v = c.values[key];
        if (v) samples.push(v);
      }
    }
    const font =
      '500 13px -apple-system, BlinkMacSystemFont, Inter, Segoe UI, sans-serif';
    const w = measureMax(samples, font);
    // Add padding: header has dragger+sort icon (~50px), cell has ~28px
    const extra = key === 'status' ? 70 : key === 'name' ? 70 : 60;
    const finalW = Math.max(70, Math.min(720, Math.ceil(w) + extra));
    handleCommit(key, finalW);
  }

  const cols = fields.map((f) => f.id);
  // Total table width for layout
  const totalWidth =
    widths.status + widths.name + fields.reduce((sum, f) => sum + widths.forField(f.id), 0) + 24;

  return (
    <div className="flex-1 overflow-auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <table
          className="border-separate border-spacing-0"
          style={{ minWidth: totalWidth }}
        >
          <colgroup>
            <col style={{ width: widths.status }} />
            <col style={{ width: widths.name }} />
            {fields.map((f) => (
              <col key={f.id} style={{ width: widths.forField(f.id) }} />
            ))}
            <col />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-ink-50">
            <tr>
              <StatusHeader
                width={widths.status}
                onSort={() => toggleSort({ type: 'status' })}
                sortDir={isSorted({ type: 'status' })}
                onOpenStatusManager={onOpenStatusManager}
                onDrag={(w) => handleDrag('status', w)}
                onCommit={(w) => handleCommit('status', w)}
                onAutoFit={() => autoFit('status')}
              />
              <NameHeader
                width={widths.name}
                left={widths.status}
                onSort={() => toggleSort({ type: 'name' })}
                sortDir={isSorted({ type: 'name' })}
                onDrag={(w) => handleDrag('name', w)}
                onCommit={(w) => handleCommit('name', w)}
                onAutoFit={() => autoFit('name')}
              />
              <SortableContext items={cols} strategy={horizontalListSortingStrategy}>
                {fields.map((f) => (
                  <SortableHeader
                    key={f.id}
                    field={f}
                    width={widths.forField(f.id)}
                    onClick={() => toggleSort({ type: 'field', fieldId: f.id })}
                    sortDir={isSorted({ type: 'field', fieldId: f.id })}
                    onDrag={(w) => handleDrag(f.id, w)}
                    onCommit={(w) => handleCommit(f.id, w)}
                    onAutoFit={() => autoFit(f.id)}
                  />
                ))}
              </SortableContext>
              <th className="bg-ink-50 border-b border-ink-200" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={fields.length + 3} className="py-16 text-center">
                  <div className="text-sm text-ink-400">
                    {contacts.length === 0
                      ? 'Пока нет клиентов. Нажмите «Новый клиент», чтобы создать первого.'
                      : 'Под этот поиск/фильтр ничего не найдено.'}
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((c) => (
                <Row
                  key={c.id}
                  contact={c}
                  fields={fields}
                  status={c.statusId ? statusMap.get(c.statusId) ?? null : null}
                  statuses={statuses}
                  widthStatus={widths.status}
                  widthName={widths.name}
                  widthForField={widths.forField}
                  onOpenContact={onOpenContact}
                  onOpenStatusManager={onOpenStatusManager}
                />
              ))
            )}
            <tr>
              <td colSpan={fields.length + 3} className="border-b border-ink-200">
                <button
                  type="button"
                  onClick={addRow}
                  className="w-full px-4 py-2.5 text-sm text-ink-500 hover:text-ink-900 hover:bg-ink-50 text-left inline-flex items-center gap-1.5 transition-colors"
                >
                  <Plus size={14} /> Новый клиент
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </DndContext>
    </div>
  );
}

function sortKeyId(k: SortKey): string {
  if (k.type === 'field') return `field:${k.fieldId}`;
  return k.type;
}

function SortIcon({ dir }: { dir: SortDir | null }) {
  if (dir === 'asc') return <ArrowUp size={12} className="text-ink-700" />;
  if (dir === 'desc') return <ArrowDown size={12} className="text-ink-700" />;
  return <ArrowUpDown size={12} className="text-ink-300" />;
}

function StatusHeader({
  width,
  onSort,
  sortDir,
  onOpenStatusManager,
  onDrag,
  onCommit,
  onAutoFit,
}: {
  width: number;
  onSort: () => void;
  sortDir: SortDir | null;
  onOpenStatusManager: () => void;
  onDrag: (w: number) => void;
  onCommit: (w: number) => void;
  onAutoFit: () => void;
}) {
  return (
    <th
      style={{ width, minWidth: width, left: 0 }}
      className="relative text-left text-[11px] uppercase tracking-wider font-medium text-ink-500 bg-ink-50 border-b border-ink-200 sticky z-[5] group"
    >
      <div className="flex items-center gap-1 pr-3 hover:bg-ink-100 transition-colors">
        <button
          type="button"
          onClick={onSort}
          className="flex-1 flex items-center justify-between gap-1 px-3 py-2.5 min-w-0"
        >
          <span className="truncate">Статус</span>
          <SortIcon dir={sortDir} />
        </button>
        <button
          type="button"
          onClick={onOpenStatusManager}
          title="Настройки статусов"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -mr-1 rounded hover:bg-ink-200 text-ink-500 hover:text-ink-900"
        >
          <Settings2 size={12} />
        </button>
      </div>
      <ColumnResizer onDrag={onDrag} onCommit={onCommit} onAutoFit={onAutoFit} />
    </th>
  );
}

function NameHeader({
  width,
  left,
  onSort,
  sortDir,
  onDrag,
  onCommit,
  onAutoFit,
}: {
  width: number;
  left: number;
  onSort: () => void;
  sortDir: SortDir | null;
  onDrag: (w: number) => void;
  onCommit: (w: number) => void;
  onAutoFit: () => void;
}) {
  return (
    <th
      style={{ width, minWidth: width, left }}
      className="relative text-left text-[11px] uppercase tracking-wider font-medium text-ink-500 bg-ink-50 border-b border-ink-200 sticky z-[5]"
    >
      <button
        type="button"
        onClick={onSort}
        className="w-full flex items-center justify-between gap-1 px-3 py-2.5 hover:bg-ink-100 transition-colors"
      >
        <span className="truncate">Имя клиента</span>
        <SortIcon dir={sortDir} />
      </button>
      <ColumnResizer onDrag={onDrag} onCommit={onCommit} onAutoFit={onAutoFit} />
    </th>
  );
}

function SortableHeader({
  field,
  width,
  onClick,
  sortDir,
  onDrag,
  onCommit,
  onAutoFit,
}: {
  field: FieldDef;
  width: number;
  onClick: () => void;
  sortDir: SortDir | null;
  onDrag: (w: number) => void;
  onCommit: (w: number) => void;
  onAutoFit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  return (
    <th
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        width,
        minWidth: width,
      }}
      className="relative text-left text-[11px] uppercase tracking-wider font-medium text-ink-500 bg-ink-50 border-b border-ink-200 group"
    >
      <div className="flex items-center px-3 py-2.5 gap-1 hover:bg-ink-100 transition-colors">
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="cursor-grab active:cursor-grabbing text-ink-300 hover:text-ink-700 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Перетащить колонку"
        >
          <GripVertical size={12} />
        </button>
        <button
          type="button"
          onClick={onClick}
          className="flex-1 flex items-center justify-between gap-1 min-w-0"
        >
          <span className="truncate">{field.name}</span>
          <SortIcon dir={sortDir} />
        </button>
      </div>
      <ColumnResizer onDrag={onDrag} onCommit={onCommit} onAutoFit={onAutoFit} />
    </th>
  );
}

function Row({
  contact,
  fields,
  status,
  statuses,
  widthStatus,
  widthName,
  widthForField,
  onOpenContact,
  onOpenStatusManager,
}: {
  contact: Contact;
  fields: FieldDef[];
  status: Status | null;
  statuses: Status[];
  widthStatus: number;
  widthName: number;
  widthForField: (id: string) => number;
  onOpenContact: (id: string) => void;
  onOpenStatusManager: () => void;
}) {
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <tr className="group hover:bg-ink-50 transition-colors">
      <td
        style={{ width: widthStatus, maxWidth: widthStatus, left: 0 }}
        className="sticky z-[4] bg-white group-hover:bg-ink-50 transition-colors border-b border-ink-200 px-3 py-1.5"
      >
        <button
          ref={setStatusAnchor}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen(true);
          }}
          className="inline-block max-w-full"
        >
          <StatusBadge status={status} size="sm" placeholder="—" />
        </button>
        <StatusPicker
          anchor={statusAnchor}
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          statuses={statuses}
          current={contact.statusId}
          onPick={(id) => updateContact(contact.id, { statusId: id })}
          onManage={onOpenStatusManager}
        />
      </td>
      <td
        style={{ width: widthName, maxWidth: widthName, left: widthStatus }}
        className="sticky z-[4] bg-white group-hover:bg-ink-50 transition-colors border-b border-ink-200 px-2 py-1"
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenContact(contact.id)}
            className="shrink-0 text-[10px] uppercase tracking-wider text-ink-300 hover:text-ink-700 px-1.5 py-0.5 rounded hover:bg-ink-100 transition-colors"
            title="Открыть карточку"
          >
            ↗
          </button>
          <div className="flex-1 min-w-0">
            <InlineCell
              value={contact.name}
              type="text"
              onCommit={(v) => updateContact(contact.id, { name: v })}
              placeholder="Без имени"
              className="font-medium"
            />
          </div>
        </div>
      </td>
      {fields.map((f) => {
        const w = widthForField(f.id);
        return (
          <td
            key={f.id}
            style={{ width: w, maxWidth: w }}
            className="border-b border-ink-200 px-2 py-1 align-top"
          >
            <InlineCell
              value={contact.values[f.id] ?? ''}
              type={f.type}
              onCommit={(v) =>
                updateContact(contact.id, {
                  values: { ...contact.values, [f.id]: v },
                })
              }
            />
          </td>
        );
      })}
      <td className="border-b border-ink-200" />
    </tr>
  );
}

// Measure max text width via canvas
let measureCtx: CanvasRenderingContext2D | null = null;
function measureMax(samples: string[], font: string): number {
  if (!measureCtx) {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
  }
  if (!measureCtx) return 0;
  measureCtx.font = font;
  let max = 0;
  for (const s of samples) {
    const w = measureCtx.measureText(s || '').width;
    if (w > max) max = w;
  }
  return max;
}
