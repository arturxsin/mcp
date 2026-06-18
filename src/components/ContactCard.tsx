import { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { StatusPicker } from './StatusPicker';
import { Plus, Trash2, GripVertical, Eye, EyeOff, X } from 'lucide-react';
import {
  createField,
  deleteContact,
  deleteField,
  reorderFields,
  updateContact,
  updateField,
} from '../db';
import type { Contact, FieldDef, NameSubItem, Status } from '../types';
import { FIELD_TYPE_OPTIONS, inputTypeFor, placeholderFor } from '../utils';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  open: boolean;
  onClose: () => void;
  contact: Contact | null;
  fields: FieldDef[];
  statuses: Status[];
  boardId: string;
  onOpenStatusManager: () => void;
}

export function ContactCard({
  open,
  onClose,
  contact,
  fields,
  statuses,
  boardId,
  onOpenStatusManager,
}: Props) {
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FieldDef['type']>('text');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    if (!open) {
      setAdding(false);
      setNewName('');
      setNewType('text');
    }
  }, [open]);

  async function handleClose() {
    if (contact) {
      const isEmpty =
        !contact.name.trim() &&
        Object.values(contact.values).every((v) => !v?.trim()) &&
        !(contact.nameSubItems ?? []).some((i) => i.value.trim());
      if (isEmpty) {
        await deleteContact(contact.id);
      }
    }
    onClose();
  }

  async function addField() {
    const name = newName.trim();
    if (!name || !contact) return;
    await createField(boardId, name, newType);
    setNewName('');
    setNewType('text');
    setAdding(false);
  }

  async function addSubItem() {
    if (!contact) return;
    const item: NameSubItem = { id: nanoid(), value: '' };
    await updateContact(contact.id, {
      nameSubItems: [...(contact.nameSubItems ?? []), item],
    });
  }

  async function updateSubItem(id: string, value: string) {
    if (!contact) return;
    await updateContact(contact.id, {
      nameSubItems: (contact.nameSubItems ?? []).map((i) => (i.id === id ? { ...i, value } : i)),
    });
  }

  async function deleteSubItem(id: string) {
    if (!contact) return;
    await updateContact(contact.id, {
      nameSubItems: (contact.nameSubItems ?? []).filter((i) => i.id !== id),
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const ordered = arrayMove(fields, oldIndex, newIndex).map((f) => f.id);
    await reorderFields(boardId, ordered);
  }

  if (!contact) return null;
  const currentStatus = statuses.find((s) => s.id === contact.statusId) ?? null;
  const subItems = contact.nameSubItems ?? [];

  return (
    <Modal open={open} onClose={handleClose} width={620}>
      <div className="p-5 space-y-4">
        {/* Name + Status row */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] uppercase tracking-wider font-medium text-ink-400 mb-1">
                Имя клиента
              </label>
              <input
                autoFocus
                value={contact.name}
                onChange={(e) => updateContact(contact.id, { name: e.target.value })}
                placeholder="Введите имя клиента"
                className="w-full px-3 py-2 text-[15px] font-medium bg-white border border-ink-200 rounded-lg focus:outline-none focus:border-ink-400 placeholder:text-ink-300"
              />
            </div>
            <div className="shrink-0 mt-5">
              <button
                ref={setStatusAnchor}
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
              >
                <StatusBadge status={currentStatus} placeholder="Без статуса" />
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
            </div>
          </div>

          {/* Sub-items under name */}
          {subItems.length > 0 && (
            <div className="pl-0 space-y-1">
              {subItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <input
                    value={item.value}
                    onChange={(e) => updateSubItem(item.id, e.target.value)}
                    placeholder="Компания, сайт, должность…"
                    className="flex-1 px-3 py-1.5 text-sm bg-white border border-ink-200 rounded-md focus:outline-none focus:border-ink-400 placeholder:text-ink-300"
                  />
                  <button
                    type="button"
                    onClick={() => deleteSubItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-ink-400 hover:text-red-500 transition-all rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={addSubItem}
            className="text-xs text-ink-400 hover:text-ink-700 inline-flex items-center gap-1 transition-colors"
          >
            <Plus size={12} /> Добавить подпункт
          </button>
        </div>

        {/* Divider */}
        {(fields.length > 0 || adding) && (
          <div className="border-t border-ink-100" />
        )}

        {/* Additional fields */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {fields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                value={contact.values[field.id] ?? ''}
                onChange={(v) => {
                  updateContact(contact.id, {
                    values: { ...contact.values, [field.id]: v },
                  });
                }}
                onToggleVisible={() =>
                  updateField(field.id, { visibleInTable: !field.visibleInTable })
                }
                onRename={(name) => updateField(field.id, { name })}
                onDelete={async () => {
                  if (
                    confirm(
                      `Удалить поле «${field.name}» из схемы?\nЗначения этого поля будут удалены у всех клиентов.`,
                    )
                  ) {
                    await deleteField(boardId, field.id);
                  }
                }}
              />
            ))}
          </SortableContext>
        </DndContext>

        {adding ? (
          <div className="border border-ink-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addField();
                  else if (e.key === 'Escape') setAdding(false);
                }}
                placeholder="Название поля (например, «Телефон»)"
                className="flex-1 px-3 py-2 text-sm border border-ink-200 rounded-md focus:border-ink-400 focus:outline-none"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as FieldDef['type'])}
                className="px-2 py-2 text-sm border border-ink-200 rounded-md bg-white"
              >
                {FIELD_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-100 rounded-md transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={addField}
                disabled={!newName.trim()}
                className="px-3 py-1.5 text-sm font-medium bg-ink-900 text-white rounded-md hover:bg-ink-700 disabled:opacity-40 transition-colors"
              >
                Добавить поле
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full px-3 py-2 text-sm text-ink-500 hover:text-ink-900 hover:bg-ink-100 rounded-md transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Plus size={14} /> Добавить поле
          </button>
        )}
      </div>

      <div className="border-t border-ink-200 px-5 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={async () => {
            if (confirm(`Удалить клиента «${contact.name || 'без имени'}»?`)) {
              await deleteContact(contact.id);
              onClose();
            }
          }}
          className="text-sm text-red-500 hover:text-red-600 inline-flex items-center gap-1.5 transition-colors"
        >
          <Trash2 size={14} /> Удалить клиента
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="px-3 py-1.5 text-sm font-medium bg-ink-100 hover:bg-ink-200 rounded-md transition-colors"
        >
          Закрыть
        </button>
      </div>
    </Modal>
  );
}

interface RowProps {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  onToggleVisible: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

function FieldRow({ field, value, onChange, onToggleVisible, onRename, onDelete }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(field.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) setName(field.name);
  }, [field.name, renaming]);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="group flex items-start gap-2 py-1.5 -mx-2 px-2 rounded-md hover:bg-ink-50"
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-ink-400 hover:text-ink-700 pt-2 transition-opacity"
        aria-label="Перетащить"
      >
        <GripVertical size={14} />
      </button>
      <div className="w-32 shrink-0 pt-2">
        {renaming ? (
          <input
            ref={inputRef}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim() && name !== field.name) onRename(name.trim());
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') inputRef.current?.blur();
              else if (e.key === 'Escape') {
                setName(field.name);
                setRenaming(false);
              }
            }}
            className="w-full text-xs text-ink-700 bg-white border border-ink-300 rounded px-1.5 py-0.5"
          />
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="text-xs text-ink-500 hover:text-ink-900 text-left"
          >
            {field.name}
          </button>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {field.type === 'note' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholderFor(field.type)}
            rows={2}
            className="w-full px-2 py-1.5 text-sm bg-transparent border border-transparent hover:border-ink-200 focus:border-ink-300 focus:bg-white rounded-md resize-none transition-colors placeholder:text-ink-300"
          />
        ) : (
          <input
            type={inputTypeFor(field.type)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholderFor(field.type)}
            className="w-full px-2 py-1.5 text-sm bg-transparent border border-transparent hover:border-ink-200 focus:border-ink-300 focus:bg-white rounded-md transition-colors placeholder:text-ink-300"
          />
        )}
      </div>
      <button
        type="button"
        onClick={onToggleVisible}
        title={field.visibleInTable ? 'Скрыть в таблице' : 'Показывать в таблице'}
        className={`shrink-0 p-1.5 rounded-md transition-colors ${
          field.visibleInTable
            ? 'text-ink-700 hover:bg-ink-100'
            : 'text-ink-300 hover:text-ink-500 hover:bg-ink-100'
        }`}
      >
        {field.visibleInTable ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 shrink-0 p-1.5 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
        aria-label="Удалить поле"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
