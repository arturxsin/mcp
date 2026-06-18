import { useState } from 'react';
import { Modal } from './Modal';
import { ColorSwatch } from './ColorSwatch';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { createStatus, deleteStatus, reorderStatuses, updateStatus } from '../db';
import { STATUS_PALETTE, contrastText } from '../utils';
import type { Status } from '../types';
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
  boardId: string;
  statuses: Status[];
}

export function StatusManager({ open, onClose, boardId, statuses }: Props) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(STATUS_PALETTE[0]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function add() {
    const name = newName.trim();
    if (!name) return;
    await createStatus(boardId, name, newColor);
    setNewName('');
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = statuses.findIndex((s) => s.id === active.id);
    const newIndex = statuses.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const ordered = arrayMove(statuses, oldIndex, newIndex).map((s) => s.id);
    await reorderStatuses(boardId, ordered);
  }

  return (
    <Modal open={open} onClose={onClose} title="Статусы" width={520}>
      <div className="p-5 space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-400 font-medium mb-2">
            Очерёдность
          </div>
          <div className="text-xs text-ink-500 mb-3">
            Перетащите за иконку слева, чтобы изменить порядок. Этот порядок используется для сортировки клиентов.
          </div>
          {statuses.length === 0 ? (
            <div className="text-sm text-ink-400 py-4 text-center">Пока нет статусов</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext
                items={statuses.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {statuses.map((s) => (
                    <StatusRow key={s.id} status={s} canDelete={statuses.length > 1} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="border-t border-ink-200 pt-4 space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-ink-400 font-medium">
            Добавить статус
          </div>
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') add();
              }}
              placeholder="Название статуса"
              className="flex-1 px-3 py-2 text-sm border border-ink-200 rounded-md focus:border-ink-400"
            />
            <button
              type="button"
              onClick={add}
              disabled={!newName.trim()}
              className="px-3 py-2 text-sm font-medium bg-ink-900 text-white rounded-md hover:bg-ink-700 disabled:opacity-40 transition-colors inline-flex items-center gap-1.5"
            >
              <Plus size={14} /> Добавить
            </button>
          </div>
          <ColorSwatch value={newColor} onChange={setNewColor} />
        </div>
      </div>
    </Modal>
  );
}

function StatusRow({ status, canDelete }: { status: Status; canDelete: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(status.name);
  const [colorOpen, setColorOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: status.id,
  });

  async function save() {
    if (name.trim() && name !== status.name) {
      await updateStatus(status.id, { name: name.trim() });
    } else {
      setName(status.name);
    }
    setEditing(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="flex items-center gap-2 group py-1 -mx-1 px-1 rounded hover:bg-ink-50"
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="cursor-grab active:cursor-grabbing text-ink-300 hover:text-ink-700 transition-colors"
        aria-label="Перетащить"
      >
        <GripVertical size={14} />
      </button>
      <div className="relative">
        <button
          type="button"
          className="h-7 w-7 rounded-md ring-1 ring-inset ring-black/5"
          style={{ backgroundColor: status.color }}
          onClick={() => setColorOpen((v) => !v)}
          aria-label="Изменить цвет"
        />
        {colorOpen && (
          <div className="absolute z-20 mt-1 bg-white rounded-lg shadow-lg border border-ink-200 p-2">
            <ColorSwatch
              value={status.color}
              onChange={async (c) => {
                await updateStatus(status.id, { color: c });
                setColorOpen(false);
              }}
            />
          </div>
        )}
      </div>
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            else if (e.key === 'Escape') {
              setName(status.name);
              setEditing(false);
            }
          }}
          className="flex-1 px-2 py-1 text-sm border border-ink-300 rounded-md"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex-1 text-left px-2 py-1 text-sm rounded-md hover:bg-ink-100 transition-colors"
        >
          <span
            style={{ backgroundColor: status.color, color: contrastText(status.color) }}
            className="px-2 py-0.5 rounded text-[11px] font-medium"
          >
            {status.name}
          </span>
        </button>
      )}
      <button
        type="button"
        onClick={async () => {
          if (
            canDelete &&
            confirm(
              `Удалить статус «${status.name}»?\nУ клиентов с этим статусом он будет очищен.`,
            )
          ) {
            await deleteStatus(status.boardId, status.id);
          }
        }}
        disabled={!canDelete}
        className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-500 transition-all disabled:opacity-0 p-1"
        aria-label="Удалить"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
