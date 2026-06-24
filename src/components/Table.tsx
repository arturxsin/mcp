import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, ArrowUpDown, Clock, GripVertical, History, MessageSquare, Settings2, Trash2 } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { StatusPicker } from './StatusPicker';
import { InlineCell } from './InlineCell';
import { ColumnResizer } from './ColumnResizer';
import { Popover } from './Popover';
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
import { bulkDeleteContacts, createContact, reorderFields, setColumnWidth, updateContact } from '../db';
import type { Board, Contact, FieldDef, Status } from '../types';
import type { TouchThreshold, BudgetThreshold } from '../settings';
import { formatPhone, formatBudget, calendarDaysSince } from '../utils';

const CHECKBOX_W = 36;
const TOUCH_COL_W = 120;
const LOCATION_COL_W = 140;
const BUDGET_COL_W = 150;
const DEFAULT_AVATAR = '/mcp/default-avatar.svg';

type SortDir = 'asc' | 'desc';
type SortKey = { type: 'name' } | { type: 'status' } | { type: 'touch' } | { type: 'budget' } | { type: 'field'; fieldId: string };

const DEFAULT_WIDTHS = {
  status: 140,
  name: 220,
  phones: 160,
  touch: TOUCH_COL_W,
  location: LOCATION_COL_W,
  budget: BUDGET_COL_W,
  field: 180,
};

interface Props {
  contacts: Contact[];
  fields: FieldDef[];
  allFields: FieldDef[];
  statuses: Status[];
  board: Board | null;
  boardId: string;
  onOpenContact: (id: string) => void;
  onOpenStatusManager: () => void;
  search: string;
  statusFilter: Set<string>;
  sidebarTab: string | null;
  avatarEnabled: boolean;
  touchThresholds: TouchThreshold[];
  budgetThresholds: BudgetThreshold[];
  budgetColorEnabled: boolean;
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
  sidebarTab,
  avatarEnabled,
  touchThresholds,
  budgetThresholds,
  budgetColorEnabled,
}: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [tempWidths, setTempWidths] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);

  const widths = useMemo(() => {
    const persisted = board?.columnWidths ?? {};
    return {
      status: tempWidths.status ?? persisted.status ?? DEFAULT_WIDTHS.status,
      name: tempWidths.name ?? persisted.name ?? DEFAULT_WIDTHS.name,
      phones: tempWidths.phones ?? persisted.phones ?? DEFAULT_WIDTHS.phones,
      touch: tempWidths.touch ?? persisted.touch ?? DEFAULT_WIDTHS.touch,
      location: tempWidths.location ?? persisted.location ?? DEFAULT_WIDTHS.location,
      budget: tempWidths.budget ?? persisted.budget ?? DEFAULT_WIDTHS.budget,
      forField: (id: string) => tempWidths[id] ?? persisted[id] ?? DEFAULT_WIDTHS.field,
    };
  }, [board, tempWidths]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      const ids = c.statusIds ?? (c.statusId ? [c.statusId] : []);
      if (sidebarTab !== null) {
        if (!ids.includes(sidebarTab)) return false;
      } else if (statusFilter.size > 0) {
        if (!ids.some((id) => statusFilter.has(id))) return false;
      }
      if (!q) return true;
      if (c.name.toLowerCase().includes(q)) return true;
      for (const v of Object.values(c.values)) {
        if (v && v.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [contacts, search, statusFilter, sidebarTab]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const get = (c: Contact): string | number => {
      if (sort.key.type === 'name') return c.name.toLowerCase();
      if (sort.key.type === 'status') {
        const ids = c.statusIds ?? (c.statusId ? [c.statusId] : []);
        if (!ids.length) return Number.MAX_SAFE_INTEGER;
        const orders = ids.map((id) => statusMap.get(id)?.order ?? Number.MAX_SAFE_INTEGER);
        return Math.min(...orders);
      }
      if (sort.key.type === 'touch') {
        const ts = c.lastTouchedAt ?? 0;
        if (ts === 0) return Number.MAX_SAFE_INTEGER;
        return calendarDaysSince(ts);
      }
      if (sort.key.type === 'budget') return c.budget ?? 0;
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
    await reorderFields(boardId, newAll.map((f) => f.id));
  }

  async function addRow() {
    const id = await createContact(boardId, '', sidebarTab ?? undefined);
    onOpenContact(id);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((c) => c.id)));
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Удалить ${selectedIds.size} клиентов? Это действие необратимо.`)) return;
    await bulkDeleteContacts([...selectedIds]);
    setSelectedIds(new Set());
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
    const samples: string[] = [];
    if (key === 'status') {
      samples.push('Статус');
      for (const s of statuses) samples.push(s.name);
    } else if (key === 'name') {
      samples.push('Имя клиента');
      for (const c of sorted) samples.push(c.name);
    } else if (key === 'phones') {
      samples.push('Телефоны');
      for (const c of sorted) for (const p of (c.phones ?? [])) if (p.value) samples.push(formatPhone(p.value));
    } else if (key === 'location') {
      samples.push('Локация');
      for (const c of sorted) if (c.location) samples.push(c.location);
    } else if (key === 'budget') {
      samples.push('Бюджет');
      for (const c of sorted) if (c.budget) samples.push(formatBudget(c.budget));
    } else {
      const f = fields.find((x) => x.id === key);
      if (f) samples.push(f.name);
      for (const c of sorted) {
        const v = c.values[key];
        if (v) samples.push(v);
      }
    }
    const font = '500 13px -apple-system, BlinkMacSystemFont, Inter, Segoe UI, sans-serif';
    const w = measureMax(samples, font);
    const extra = key === 'status' ? 70 : key === 'name' ? 70 : 60;
    const finalW = Math.max(70, Math.min(720, Math.ceil(w) + extra));
    handleCommit(key, finalW);
  }

  const cols = fields.map((f) => f.id);

  const totalWidth =
    CHECKBOX_W + widths.status + widths.name + widths.phones + widths.location + widths.budget + widths.touch +
    fields.reduce((sum, f) => sum + widths.forField(f.id), 0) + 24;

  const allSelected = sorted.length > 0 && selectedIds.size === sorted.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="flex-1 overflow-auto relative">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <table
          className="border-separate border-spacing-0"
          style={{ minWidth: totalWidth }}
        >
          <colgroup>
            <col style={{ width: CHECKBOX_W }} />
            <col style={{ width: widths.status }} />
            <col style={{ width: widths.name }} />
            <col style={{ width: widths.phones }} />
            <col style={{ width: widths.location }} />
            <col style={{ width: widths.budget }} />
            <col style={{ width: widths.touch }} />
            {fields.map((f) => (
              <col key={f.id} style={{ width: widths.forField(f.id) }} />
            ))}
            <col />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-ink-50">
            <tr>
              <th
                style={{ width: CHECKBOX_W, minWidth: CHECKBOX_W, left: 0 }}
                className="sticky z-[5] bg-ink-50 border-b border-ink-200 px-2"
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleSelectAll}
                  className="cursor-pointer accent-ink-700"
                />
              </th>
              <StatusHeader
                width={widths.status}
                left={CHECKBOX_W}
                onSort={() => toggleSort({ type: 'status' })}
                sortDir={isSorted({ type: 'status' })}
                onOpenStatusManager={onOpenStatusManager}
                onDrag={(w) => handleDrag('status', w)}
                onCommit={(w) => handleCommit('status', w)}
                onAutoFit={() => autoFit('status')}
              />
              <NameHeader
                width={widths.name}
                left={CHECKBOX_W + widths.status}
                onSort={() => toggleSort({ type: 'name' })}
                sortDir={isSorted({ type: 'name' })}
                onDrag={(w) => handleDrag('name', w)}
                onCommit={(w) => handleCommit('name', w)}
                onAutoFit={() => autoFit('name')}
              />
              <th
                style={{ width: widths.phones, minWidth: widths.phones }}
                className="relative text-left text-[11px] uppercase tracking-wider font-medium text-ink-500 bg-ink-50 border-b border-ink-200"
              >
                <div className="px-3 py-2.5">Телефоны</div>
                <ColumnResizer
                  onDrag={(w) => handleDrag('phones', w)}
                  onCommit={(w) => handleCommit('phones', w)}
                  onAutoFit={() => autoFit('phones')}
                />
              </th>
              <th
                style={{ width: widths.location, minWidth: widths.location }}
                className="relative text-left text-[11px] uppercase tracking-wider font-medium text-ink-500 bg-ink-50 border-b border-ink-200"
              >
                <div className="px-3 py-2.5">Локация</div>
                <ColumnResizer
                  onDrag={(w) => handleDrag('location', w)}
                  onCommit={(w) => handleCommit('location', w)}
                  onAutoFit={() => autoFit('location')}
                />
              </th>
              <th
                style={{ width: widths.budget, minWidth: widths.budget }}
                className="relative text-left text-[11px] uppercase tracking-wider font-medium text-ink-500 bg-ink-50 border-b border-ink-200"
              >
                <button
                  type="button"
                  onClick={() => toggleSort({ type: 'budget' })}
                  className="w-full flex items-center justify-between gap-1 px-3 py-2.5 hover:bg-ink-100 transition-colors"
                >
                  <span className="truncate">Бюджет</span>
                  <SortIcon dir={isSorted({ type: 'budget' })} />
                </button>
                <ColumnResizer
                  onDrag={(w) => handleDrag('budget', w)}
                  onCommit={(w) => handleCommit('budget', w)}
                  onAutoFit={() => autoFit('budget')}
                />
              </th>
              <th
                style={{ width: widths.touch, minWidth: widths.touch }}
                className="relative text-left text-[11px] uppercase tracking-wider font-medium text-ink-500 bg-ink-50 border-b border-ink-200"
              >
                <button
                  type="button"
                  onClick={() => toggleSort({ type: 'touch' })}
                  className="w-full flex items-center justify-between gap-1 px-3 py-2.5 hover:bg-ink-100 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Clock size={11} />
                    Касание
                  </span>
                  <SortIcon dir={isSorted({ type: 'touch' })} />
                </button>
                <ColumnResizer
                  onDrag={(w) => handleDrag('touch', w)}
                  onCommit={(w) => handleCommit('touch', w)}
                  onAutoFit={() => {}}
                />
              </th>
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
                <td colSpan={fields.length + 8} className="py-16 text-center">
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
                  statuses={statuses}
                  widthStatus={widths.status}
                  widthName={widths.name}
                  widthPhones={widths.phones}
                  widthLocation={widths.location}
                  widthBudget={widths.budget}
                  widthTouch={widths.touch}
                  budgetThresholds={budgetThresholds}
                  budgetColorEnabled={budgetColorEnabled}
                  widthForField={widths.forField}
                  onOpenContact={onOpenContact}
                  onOpenStatusManager={onOpenStatusManager}
                  selected={selectedIds.has(c.id)}
                  onToggleSelect={() => toggleSelect(c.id)}
                  anySelected={selectedIds.size > 0}
                  avatarEnabled={avatarEnabled}
                  touchThresholds={touchThresholds}
                />
              ))
            )}
            <tr>
              <td colSpan={fields.length + 8} className="border-b border-ink-200">
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

      {selectedIds.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-ink-900 text-white rounded-xl px-4 py-2.5 shadow-2xl text-sm">
          <span className="text-ink-300">Выбрано: <span className="text-white font-medium">{selectedIds.size}</span></span>
          <div className="w-px h-4 bg-ink-700" />
          <button
            type="button"
            onClick={handleBulkDelete}
            className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 transition-colors font-medium"
          >
            <Trash2 size={14} /> Удалить
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-ink-400 hover:text-white transition-colors"
          >
            Снять выделение
          </button>
        </div>
      )}
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
  width, left, onSort, sortDir, onOpenStatusManager, onDrag, onCommit, onAutoFit,
}: {
  width: number; left: number; onSort: () => void; sortDir: SortDir | null;
  onOpenStatusManager: () => void; onDrag: (w: number) => void;
  onCommit: (w: number) => void; onAutoFit: () => void;
}) {
  return (
    <th
      style={{ width, minWidth: width, left }}
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
  width, left, onSort, sortDir, onDrag, onCommit, onAutoFit,
}: {
  width: number; left: number; onSort: () => void; sortDir: SortDir | null;
  onDrag: (w: number) => void; onCommit: (w: number) => void; onAutoFit: () => void;
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
  field, width, onClick, sortDir, onDrag, onCommit, onAutoFit,
}: {
  field: FieldDef; width: number; onClick: () => void; sortDir: SortDir | null;
  onDrag: (w: number) => void; onCommit: (w: number) => void; onAutoFit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  return (
    <th
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, width, minWidth: width }}
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

const PHOTO_W = 44;

function Row({
  contact, fields, statuses, widthStatus, widthName, widthPhones, widthLocation, widthBudget, widthTouch,
  widthForField, onOpenContact, onOpenStatusManager, selected, onToggleSelect,
  anySelected, avatarEnabled, touchThresholds, budgetThresholds, budgetColorEnabled,
}: {
  contact: Contact; fields: FieldDef[]; statuses: Status[];
  widthStatus: number; widthName: number; widthPhones: number; widthLocation: number; widthBudget: number; widthTouch: number;
  budgetThresholds: BudgetThreshold[]; budgetColorEnabled: boolean;
  widthForField: (id: string) => number; onOpenContact: (id: string) => void;
  onOpenStatusManager: () => void; selected: boolean; onToggleSelect: () => void;
  anySelected: boolean; avatarEnabled: boolean; touchThresholds: TouchThreshold[];
}) {
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const phones = (contact.phones ?? []).filter((p) => p.value?.trim());
  const companies = (contact.companies ?? []).filter((c) => c.name.trim() || c.url.trim());
  const nameUrl = contact.nameUrl?.trim() ?? '';
  const bg = selected ? 'bg-indigo-50' : 'bg-white group-hover:bg-ink-50';
  const rawIds = contact.statusIds ?? (contact.statusId ? [contact.statusId] : []);
  const currentIds = [...rawIds].sort((a, b) => {
    const oA = statuses.find((s) => s.id === a)?.order ?? 999;
    const oB = statuses.find((s) => s.id === b)?.order ?? 999;
    return oA - oB;
  });

  return (
    <tr className={`group hover:bg-ink-50 transition-colors ${selected ? 'bg-indigo-50' : ''}`}>
      <td
        style={{ width: CHECKBOX_W, minWidth: CHECKBOX_W, left: 0 }}
        className={`sticky z-[4] transition-colors border-b border-ink-200 px-2 ${bg}`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className={`cursor-pointer accent-ink-700 transition-opacity ${anySelected || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        />
      </td>
      <td
        style={{ width: widthStatus, maxWidth: widthStatus, left: CHECKBOX_W }}
        className={`sticky z-[4] transition-colors border-b border-ink-200 px-3 py-1.5 ${bg}`}
      >
        <button
          ref={setStatusAnchor}
          type="button"
          onClick={(e) => { e.stopPropagation(); setPickerOpen(true); }}
          className="flex flex-wrap gap-1 max-w-full"
        >
          {currentIds.length > 0
            ? currentIds.map((sid) => (
                <StatusBadge
                  key={sid}
                  status={statuses.find((x) => x.id === sid) ?? null}
                  size="sm"
                  placeholder=""
                />
              ))
            : <StatusBadge status={null} size="sm" placeholder="—" />
          }
        </button>
        <StatusPicker
          anchor={statusAnchor}
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          statuses={statuses}
          currentIds={currentIds}
          onToggle={(id) => {
            const next = currentIds.includes(id)
              ? currentIds.filter((x) => x !== id)
              : [...currentIds, id];
            updateContact(contact.id, { statusIds: next });
          }}
          onManage={onOpenStatusManager}
        />
      </td>
      {/* Name cell — sticky td is containing block; photo absolute-fills height */}
      <td
        style={{ width: widthName, maxWidth: widthName, left: CHECKBOX_W + widthStatus, padding: 0 }}
        className={`sticky z-[4] transition-colors border-b border-ink-200 overflow-hidden ${bg}`}
      >
        {avatarEnabled && (
          <img
            src={contact.photo || DEFAULT_AVATAR}
            alt=""
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: PHOTO_W, height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        <div style={{ paddingLeft: avatarEnabled ? PHOTO_W + 6 : 6, paddingRight: 6, paddingTop: 5, paddingBottom: 5 }}>
          <div className="flex items-center gap-1 min-w-0">
            <div className="flex-1 min-w-0">
              {nameUrl ? (
                <div className="min-h-[28px] px-2 py-1 text-sm font-medium">
                  <a
                    href={nameUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {contact.name || 'Без имени'}
                  </a>
                </div>
              ) : (
                <InlineCell
                  value={contact.name}
                  type="text"
                  onCommit={(v) => updateContact(contact.id, { name: v })}
                  placeholder="Без имени"
                  className="font-medium"
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenContact(contact.id)}
              title="Открыть карточку"
              className="shrink-0 opacity-0 group-hover:opacity-100 text-[10px] text-ink-400 hover:text-ink-700 px-1 py-0.5 rounded hover:bg-ink-100 transition-all"
            >
              ↗
            </button>
          </div>
          {companies.length > 0 && (
            <div className="mt-0.5 pl-2 leading-[1.35]">
              {companies.map((c) => (
                <div key={c.id} className="text-xs truncate">
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-ink-500 hover:text-ink-900 hover:underline"
                    >{c.name || c.url}</a>
                  ) : (
                    <span className="text-ink-400">{c.name}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
      <td
        style={{ width: widthPhones, maxWidth: widthPhones }}
        className="border-b border-ink-200 px-3 py-1.5"
      >
        {phones.map((p, i) => {
          const digits = p.value.replace(/\D/g, '');
          return (
            <div key={i} className="flex items-center gap-1 min-w-0">
              <span className="text-sm text-ink-700 truncate flex-1">{formatPhone(p.value)}</span>
              {(p.wa || p.tg) && digits.length >= 7 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  {p.wa && (
                    <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[9px] font-bold text-green-600 hover:text-green-700 inline-flex justify-center w-5 leading-none"
                      title="WhatsApp"
                    >WA</a>
                  )}
                  {p.tg && (
                    <a href={`https://t.me/+${digits}`} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[9px] font-bold text-sky-500 hover:text-sky-600 inline-flex justify-center w-5 leading-none"
                      title="Telegram"
                    >TG</a>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {phones.map((p, i) => {
          const tgVal = p.tgUsername ?? '';
          const tgClean = tgVal.replace(/^@/, '');
          if (!tgClean) return null;
          const display = tgVal.startsWith('@') ? tgVal : `@${tgVal}`;
          return (
            <div key={`tg-${i}`} className="flex items-center gap-1 min-w-0 mt-0.5">
              <span className="text-xs text-sky-500 truncate flex-1">{display}</span>
              <a href={`https://t.me/${tgClean}`} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-bold text-sky-500 hover:text-sky-600 shrink-0"
              >TG ↗</a>
            </div>
          );
        })}
      </td>
      <td
        style={{ width: widthLocation, maxWidth: widthLocation }}
        className="border-b border-ink-200 px-2 py-1"
      >
        <InlineCell
          value={contact.location ?? ''}
          type="text"
          onCommit={(v) => updateContact(contact.id, { location: v })}
          placeholder="Локация"
        />
      </td>
      <td
        style={{ width: widthBudget, maxWidth: widthBudget }}
        className="border-b border-ink-200 px-3 py-1.5"
      >
        <BudgetCell contact={contact} thresholds={budgetThresholds} colorEnabled={budgetColorEnabled} />
      </td>
      <td
        style={{ width: widthTouch, maxWidth: widthTouch }}
        className="border-b border-ink-200 px-3 py-1.5"
      >
        <TouchCell contact={contact} thresholds={touchThresholds} />
      </td>
      {fields.map((f) => {
        const w = widthForField(f.id);
        return (
          <td
            key={f.id}
            style={{ width: w, maxWidth: w }}
            className="border-b border-ink-200 px-2 py-1"
          >
            <InlineCell
              value={contact.values[f.id] ?? ''}
              type={f.type}
              onCommit={(v) =>
                updateContact(contact.id, { values: { ...contact.values, [f.id]: v } })
              }
            />
          </td>
        );
      })}
      <td className="border-b border-ink-200" />
    </tr>
  );
}

function BudgetCell({
  contact,
  thresholds,
  colorEnabled,
}: {
  contact: Contact;
  thresholds: BudgetThreshold[];
  colorEnabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const budget = contact.budget ?? 0;

  const sorted = [...thresholds].sort((a, b) => a.amount - b.amount);
  let color: string | undefined;
  if (colorEnabled && budget > 0) {
    color = sorted.length > 0 ? sorted[sorted.length - 1].color : '#22c55e';
    for (const t of sorted) {
      if (budget <= t.amount) { color = t.color; break; }
    }
  }

  function commit() {
    setEditing(false);
    updateContact(contact.id, { budget: parseInt(draft.replace(/\D/g, '')) || 0 });
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commit(); }}
        className="w-full text-sm bg-transparent focus:outline-none tabular-nums"
        style={{ color }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setEditing(true); setDraft(budget > 0 ? String(budget) : ''); }}
      className="w-full text-left text-sm tabular-nums"
    >
      {budget > 0
        ? <span style={{ color }}>{formatBudget(budget)}</span>
        : <span className="text-ink-300">—</span>
      }
    </button>
  );
}

function formatTouchDate(ts: number): string {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
}

function TouchCell({ contact, thresholds }: { contact: Contact; thresholds: TouchThreshold[] }) {
  const [commentAnchor, setCommentAnchor] = useState<HTMLElement | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [historyAnchor, setHistoryAnchor] = useState<HTMLElement | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draft, setDraft] = useState(contact.lastTouchComment ?? '');

  useEffect(() => {
    if (!commentOpen) setDraft(contact.lastTouchComment ?? '');
  }, [contact.lastTouchComment, commentOpen]);

  const ts = contact.lastTouchedAt ?? 0;
  const days = ts > 0 ? calendarDaysSince(ts) : null;

  const sortedT = [...thresholds].sort((a, b) => a.days - b.days);
  let badgeColor = sortedT.length > 0 ? sortedT[sortedT.length - 1].color : '#ef4444';
  if (days !== null) {
    for (const t of sortedT) {
      if (days <= t.days) { badgeColor = t.color; break; }
    }
  }

  function recordTouch() {
    const history = contact.touchHistory ?? [];
    const prevTs = contact.lastTouchedAt ?? 0;
    const updates: Partial<Contact> = { lastTouchedAt: Date.now(), lastTouchComment: '' };
    if (prevTs > 0) {
      updates.touchHistory = [
        { touchedAt: prevTs, comment: contact.lastTouchComment ?? '' },
        ...history,
      ];
    }
    updateContact(contact.id, updates);
  }

  function saveComment() {
    updateContact(contact.id, { lastTouchComment: draft });
    setCommentOpen(false);
  }

  const history = contact.touchHistory ?? [];
  const currentTs = contact.lastTouchedAt ?? 0;
  const displayHistory = [
    ...(currentTs > 0 ? [{ touchedAt: currentTs, comment: contact.lastTouchComment ?? '' }] : []),
    ...history,
  ];

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={recordTouch}
        title="Отметить касание"
        className="p-0.5 transition-colors shrink-0"
        style={{ color: days !== null ? badgeColor : '#9ca3af' }}
      >
        <Clock size={13} />
      </button>
      {days !== null ? (
        <span style={{ color: badgeColor }} className="text-sm font-medium tabular-nums whitespace-nowrap">
          {days}
        </span>
      ) : (
        <span className="text-ink-300 text-sm">—</span>
      )}
      <button
        ref={setCommentAnchor}
        type="button"
        onClick={(e) => { e.stopPropagation(); setCommentOpen((v) => !v); }}
        title="Комментарий"
        className="p-0.5 shrink-0"
      >
        <MessageSquare
          size={12}
          className={contact.lastTouchComment ? 'text-indigo-500' : 'text-ink-300 hover:text-ink-500'}
        />
      </button>
      <button
        ref={setHistoryAnchor}
        type="button"
        onClick={(e) => { e.stopPropagation(); setHistoryOpen((v) => !v); }}
        title="История касаний"
        className="p-0.5 shrink-0"
      >
        <History
          size={12}
          className={displayHistory.length > 0 ? 'text-ink-400 hover:text-ink-700' : 'text-ink-200 hover:text-ink-400'}
        />
      </button>
      <Popover anchor={commentAnchor} open={commentOpen} onClose={saveComment} width={240}>
        <div className="p-2.5">
          <div className="text-[10px] uppercase tracking-wider font-medium text-ink-400 mb-1.5">Комментарий</div>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') saveComment(); }}
            placeholder="Добавьте комментарий..."
            rows={3}
            className="w-full text-sm border border-ink-200 rounded-md p-2 focus:outline-none focus:border-indigo-400 resize-none placeholder:text-ink-300"
          />
          <div className="flex justify-end mt-1.5">
            <button
              type="button"
              onClick={saveComment}
              className="px-2.5 py-1 text-xs font-medium bg-ink-900 text-white rounded hover:bg-ink-700 transition-colors"
            >
              Сохранить
            </button>
          </div>
        </div>
      </Popover>
      <Popover anchor={historyAnchor} open={historyOpen} onClose={() => setHistoryOpen(false)} width={280}>
        <div className="p-2.5">
          <div className="text-[10px] uppercase tracking-wider font-medium text-ink-400 mb-2">История касаний</div>
          {displayHistory.length === 0 ? (
            <div className="text-sm text-ink-300 py-1">Нет записей</div>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-0.5">
              {displayHistory.map((entry, i) => (
                <div key={i}>
                  <div className="text-[11px] font-semibold text-ink-500">{formatTouchDate(entry.touchedAt)}</div>
                  {entry.comment ? (
                    <div className="text-sm text-ink-700 mt-0.5 whitespace-pre-wrap">{entry.comment}</div>
                  ) : (
                    <div className="text-sm text-ink-300 mt-0.5">—</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Popover>
    </div>
  );
}

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
