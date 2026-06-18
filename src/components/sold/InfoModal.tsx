import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Modal } from '../Modal';
import {
  createSoldField,
  deleteSoldField,
  reorderSoldFields,
  updateSoldField,
  updateSoldInfo,
} from '../../db';
import type { SoldEntry, SoldField, SoldFieldType } from '../../types';
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
  entry: SoldEntry | null;
  fields: SoldField[];
  boardId: string;
}

const TYPE_OPTIONS: Array<{ value: SoldFieldType; label: string }> = [
  { value: 'text', label: 'Текст' },
  { value: 'textarea', label: 'Длинный текст' },
  { value: 'number', label: 'Число' },
];

export function InfoModal({ open, onClose, entry, fields, boardId }: Props) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<SoldFieldType>('text');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    if (!open) {
      setAdding(false);
      setNewLabel('');
      setNewType('text');
    }
  }, [open]);

  async function addField() {
    const label = newLabel.trim();
    if (!label) return;
    await createSoldField(boardId, label, newType);
    setNewLabel('');
    setNewType('text');
    setAdding(false);
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const ordered = arrayMove(fields, oldIndex, newIndex).map((f) => f.id);
    await reorderSoldFields(boardId, ordered);
  }

  if (!entry) return null;
  const filled = fields.filter((f) => (entry.info[f.id] ?? '').toString().trim()).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={580}
      title={
        <div className="flex items-baseline gap-3">
          <span>Инфо</span>
          <span className="text-xs font-normal text-ink-400">
            {entry.contactName || 'без клиента'} · заполнено {filled}/{fields.length}
          </span>
        </div>
      }
    >
      <div className="p-5 space-y-1">
        {fields.length === 0 && !adding && (
          <div className="text-sm text-ink-400 py-6 text-center">
            Пока нет полей. Добавьте первое.
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {fields.map((f) => (
              <FieldRow
                key={f.id}
                field={f}
                value={entry.info[f.id] ?? ''}
                onChange={(v) => updateSoldInfo(entry.id, { [f.id]: v })}
                onRename={(label) => updateSoldField(f.id, { label })}
                onDelete={async () => {
                  if (
                    confirm(
                      `Удалить поле «${f.label}»?\nЗначения этого поля будут удалены у всех сделок.\nЕсли поле используется в шаблонах — там появится «???».`,
                    )
                  ) {
                    await deleteSoldField(boardId, f.id);
                  }
                }}
              />
            ))}
          </SortableContext>
        </DndContext>

        {adding ? (
          <div className="border border-ink-200 rounded-lg p-3 mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addField();
                  else if (e.key === 'Escape') setAdding(false);
                }}
                placeholder="Название поля"
                className="flex-1 px-3 py-2 text-sm border border-ink-200 rounded-md focus:border-ink-400"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as SoldFieldType)}
                className="px-2 py-2 text-sm border border-ink-200 rounded-md bg-white"
              >
                {TYPE_OPTIONS.map((o) => (
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
                disabled={!newLabel.trim()}
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
            className="mt-3 w-full px-3 py-2 text-sm text-ink-500 hover:text-ink-900 hover:bg-ink-100 rounded-md transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Plus size={14} /> Добавить поле
          </button>
        )}
      </div>
      <div className="border-t border-ink-200 px-5 py-3 flex items-center justify-end">
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

interface RowProps {
  field: SoldField;
  value: string;
  onChange: (v: string) => void;
  onRename: (label: string) => void;
  onDelete: () => void;
}

function FieldRow({ field, value, onChange, onRename, onDelete }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState(field.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) setLabel(field.label);
  }, [field.label, renaming]);

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
      <div className="w-36 shrink-0 pt-2">
        {renaming ? (
          <input
            ref={inputRef}
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => {
              if (label.trim() && label !== field.label) onRename(label.trim());
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') inputRef.current?.blur();
              else if (e.key === 'Escape') {
                setLabel(field.label);
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
            title="Кликни, чтобы переименовать"
          >
            {field.label}
          </button>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {field.type === 'textarea' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={2}
            className="w-full px-2 py-1.5 text-sm bg-transparent border border-transparent hover:border-ink-200 focus:border-ink-300 focus:bg-white rounded-md resize-none transition-colors placeholder:text-ink-300"
          />
        ) : (
          <input
            type={field.type === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-2 py-1.5 text-sm bg-transparent border border-transparent hover:border-ink-200 focus:border-ink-300 focus:bg-white rounded-md transition-colors placeholder:text-ink-300"
          />
        )}
      </div>
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
