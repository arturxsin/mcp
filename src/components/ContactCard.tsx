import { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { StatusPicker } from './StatusPicker';
import { Plus, Trash2, GripVertical, Eye, EyeOff, X, Link2 } from 'lucide-react';
import {
  createField,
  deleteContact,
  deleteField,
  reorderFields,
  updateContact,
  updateField,
} from '../db';
import type { CompanyEntry, Contact, FieldDef, PhoneEntry, Status } from '../types';
import { FIELD_TYPE_OPTIONS, encodeLinkValue, formatBudget, inputTypeFor, parseLinkValue, placeholderFor } from '../utils';
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
  avatarEnabled?: boolean;
  locations?: string[];
  allTags?: string[];
}

const DEFAULT_AVATAR = '/mcp/default-avatar.svg';

export function ContactCard({
  open,
  onClose,
  contact,
  fields,
  statuses,
  boardId,
  onOpenStatusManager,
  avatarEnabled = false,
  locations = [],
  allTags = [],
}: Props) {
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FieldDef['type']>('text');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    if (!open) {
      setAdding(false);
      setNewName('');
      setNewType('text');
      setTagInput('');
    }
  }, [open]);

  async function handleClose() {
    if (contact) {
      const phones = contact.phones ?? [];
      const companies = contact.companies ?? [];
      const isEmpty =
        !contact.name.trim() &&
        Object.values(contact.values).every((v) => !v?.trim()) &&
        !phones.some((p) => p.value?.trim()) &&
        !companies.some((c) => c.name.trim() || c.url.trim()) &&
        !contact.nameUrl?.trim();
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

  // --- Phones ---
  async function addPhone() {
    if (!contact) return;
    const entry: PhoneEntry = { value: '', wa: false, tg: false };
    await updateContact(contact.id, { phones: [...(contact.phones ?? []), entry] });
  }

  async function updatePhone(idx: number, value: string) {
    if (!contact) return;
    const next = [...(contact.phones ?? [])];
    next[idx] = { ...next[idx], value };
    await updateContact(contact.id, { phones: next });
  }

  async function updatePhoneFlag(idx: number, flag: 'wa' | 'tg', val: boolean) {
    if (!contact) return;
    const next = [...(contact.phones ?? [])];
    next[idx] = { ...next[idx], [flag]: val };
    await updateContact(contact.id, { phones: next });
  }

  async function updatePhoneTgUsername(idx: number, value: string) {
    if (!contact) return;
    const next = [...(contact.phones ?? [])];
    next[idx] = { ...next[idx], tgUsername: value };
    await updateContact(contact.id, { phones: next });
  }

  async function removePhone(idx: number) {
    if (!contact) return;
    await updateContact(contact.id, {
      phones: (contact.phones ?? []).filter((_, i) => i !== idx),
    });
  }

  // --- Companies ---
  async function addCompany() {
    if (!contact) return;
    await updateContact(contact.id, {
      companies: [...(contact.companies ?? []), { id: nanoid(), name: '', url: '' }],
    });
  }

  async function updateCompany(id: string, patch: Partial<CompanyEntry>) {
    if (!contact) return;
    await updateContact(contact.id, {
      companies: (contact.companies ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }

  async function removeCompany(id: string) {
    if (!contact) return;
    await updateContact(contact.id, {
      companies: (contact.companies ?? []).filter((c) => c.id !== id),
    });
  }

  // --- Locations ---
  async function addLocation() {
    if (!contact) return;
    await updateContact(contact.id, { locations: [...(contact.locations ?? []), ''] });
  }

  async function updateLocation(idx: number, value: string) {
    if (!contact) return;
    const next = [...(contact.locations ?? [])];
    next[idx] = value;
    await updateContact(contact.id, { locations: next });
  }

  async function removeLocation(idx: number) {
    if (!contact) return;
    await updateContact(contact.id, {
      locations: (contact.locations ?? []).filter((_, i) => i !== idx),
    });
  }

  // --- Tags ---
  async function addTag(raw: string) {
    if (!contact) return;
    const tag = raw.trim().replace(/^#+/, '');
    if (!tag) return;
    const existing = contact.tags ?? [];
    if (existing.some((t) => t.toLowerCase() === tag.toLowerCase())) { setTagInput(''); return; }
    await updateContact(contact.id, { tags: [...existing, tag] });
    setTagInput('');
  }

  async function removeTag(idx: number) {
    if (!contact) return;
    await updateContact(contact.id, { tags: (contact.tags ?? []).filter((_, i) => i !== idx) });
  }

  // --- Fields DnD ---
  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const ordered = arrayMove(fields, oldIndex, newIndex).map((f) => f.id);
    await reorderFields(boardId, ordered);
  }

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !contact) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      await updateContact(contact.id, { photo: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  if (!contact) return null;

  const phones = contact.phones ?? [];
  const companies = contact.companies ?? [];
  const nameUrl = contact.nameUrl ?? '';

  return (
    <Modal open={open} onClose={handleClose} width={620}>
      <div className="p-5 space-y-5">

        {/* Avatar section */}
        {avatarEnabled && (
          <div className="flex items-start gap-4 pb-1">
            <div className="relative shrink-0">
              <img
                src={contact.photo || DEFAULT_AVATAR}
                alt="Фото клиента"
                className="w-20 h-20 rounded-xl object-cover border border-ink-200"
              />
              <button
                type="button"
                onClick={() => document.getElementById(`photo-upload-${contact.id}`)?.click()}
                className="absolute -bottom-1.5 -right-1.5 bg-ink-900 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-ink-700 transition-colors"
                title="Загрузить фото"
              >
                <Plus size={12} />
              </button>
              <input
                id={`photo-upload-${contact.id}`}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoFile}
              />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="text-xs text-ink-400 uppercase tracking-wider font-medium">Фото</div>
              <input
                type="url"
                value={contact.photo?.startsWith('data:') ? '' : (contact.photo ?? '')}
                onChange={(e) => updateContact(contact.id, { photo: e.target.value })}
                placeholder="https://... (ссылка на фото)"
                className="w-full px-3 py-1.5 text-sm border border-ink-200 rounded-md focus:outline-none focus:border-ink-400 placeholder:text-ink-300"
              />
              {contact.photo && (
                <button
                  type="button"
                  onClick={() => updateContact(contact.id, { photo: '' })}
                  className="text-xs text-ink-400 hover:text-red-500 transition-colors"
                >
                  Удалить фото
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Главный блок: Имя + Компании + CRM ──────────────────── */}
        <div className="border border-ink-200 rounded-xl overflow-hidden">

          {/* Имя + статус */}
          <div className="flex items-start gap-3 px-4 py-3 border-b border-ink-100">
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-ink-400 mb-1">
                Имя клиента
              </label>
              <input
                autoFocus
                value={contact.name}
                onChange={(e) => updateContact(contact.id, { name: e.target.value })}
                placeholder="Введите имя клиента"
                className="w-full text-[15px] font-medium bg-transparent focus:outline-none placeholder:text-ink-300"
              />
              {/* Optional URL — makes name a hyperlink */}
              <div className="flex items-center gap-1.5 mt-2">
                <Link2 size={11} className="text-ink-300 shrink-0" />
                <input
                  type="url"
                  value={nameUrl}
                  onChange={(e) => updateContact(contact.id, { nameUrl: e.target.value })}
                  placeholder="Ссылка (имя станет кликабельным)"
                  className="flex-1 text-xs text-ink-500 bg-transparent focus:outline-none placeholder:text-ink-300 border-b border-transparent focus:border-ink-300"
                />
                {nameUrl && (
                  <a href={nameUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-500 hover:underline shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >↗</a>
                )}
              </div>
            </div>
            <div className="shrink-0 pt-4">
              {(() => {
                const raw = contact.statusIds ?? (contact.statusId ? [contact.statusId] : []);
                const ids = [...raw].sort((a, b) => {
                  const oA = statuses.find((s) => s.id === a)?.order ?? 999;
                  const oB = statuses.find((s) => s.id === b)?.order ?? 999;
                  return oA - oB;
                });
                return (
                  <>
                    <button
                      ref={setStatusAnchor}
                      type="button"
                      onClick={() => setPickerOpen((v) => !v)}
                      className="flex flex-wrap gap-1 max-w-[160px]"
                    >
                      {ids.length > 0
                        ? ids.map((sid) => (
                            <StatusBadge
                              key={sid}
                              status={statuses.find((x) => x.id === sid) ?? null}
                              placeholder=""
                            />
                          ))
                        : <StatusBadge status={null} placeholder="Без статуса" />
                      }
                    </button>
                    <StatusPicker
                      anchor={statusAnchor}
                      open={pickerOpen}
                      onClose={() => setPickerOpen(false)}
                      statuses={statuses}
                      currentIds={ids}
                      onToggle={(id) => {
                        const next = ids.includes(id)
                          ? ids.filter((x) => x !== id)
                          : [...ids, id];
                        updateContact(contact.id, { statusIds: next });
                      }}
                      onManage={onOpenStatusManager}
                    />
                  </>
                );
              })()}
            </div>
          </div>

          {/* Компании */}
          <div className="px-4 py-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400">Компании</div>
            {companies.map((c) => (
              <div key={c.id} className="flex items-center gap-2 group">
                <input
                  value={c.name}
                  onChange={(e) => updateCompany(c.id, { name: e.target.value })}
                  placeholder="Название компании"
                  className="flex-1 px-2 py-1 text-sm bg-ink-50 border border-ink-200 rounded-md focus:outline-none focus:border-indigo-400 placeholder:text-ink-300"
                />
                <input
                  type="url"
                  value={c.url}
                  onChange={(e) => updateCompany(c.id, { url: e.target.value })}
                  placeholder="https://..."
                  className="flex-1 px-2 py-1 text-sm bg-ink-50 border border-ink-200 rounded-md focus:outline-none focus:border-indigo-400 placeholder:text-ink-300"
                />
                <button
                  type="button"
                  onClick={() => removeCompany(c.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-ink-400 hover:text-red-500 transition-all rounded shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <AddButton onClick={addCompany} label="Добавить компанию" />
          </div>

          {/* Бюджет */}
          <div className="px-4 py-3 border-t border-ink-100">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400 mb-1.5">Бюджет</div>
            <BudgetInput value={contact.budget ?? 0} contactId={contact.id} />
          </div>

          {/* Локация */}
          <div className="px-4 py-3 border-t border-ink-100 space-y-2">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400">Локация</div>
            <datalist id={`loc-opts-${contact.id}`}>
              {locations.filter(Boolean).map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
            {(contact.locations ?? []).map((loc, idx) => (
              <div key={idx} className="flex items-center gap-2 group">
                <input
                  type="text"
                  list={`loc-opts-${contact.id}`}
                  value={loc}
                  onChange={(e) => updateLocation(idx, e.target.value)}
                  placeholder="Город или регион"
                  className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-ink-300 border-b border-transparent focus:border-ink-300 pb-0.5 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => removeLocation(idx)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-ink-400 hover:text-red-500 transition-all rounded shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <AddButton onClick={addLocation} label="Добавить локацию" />
          </div>

          {/* Хэштеги */}
          <div className="px-4 py-3 border-t border-ink-100">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400 mb-2">#хештег</div>
            {(contact.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {(contact.tags ?? []).map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
                    <span className="text-violet-400 font-bold text-[10px]">#</span>{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(i)}
                      className="text-violet-400 hover:text-violet-700 transition-colors ml-0.5"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <datalist id={`tags-opts-${contact.id}`}>
              {allTags.filter((t) => !(contact.tags ?? []).some((x) => x.toLowerCase() === t.toLowerCase())).map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <div className="flex items-center gap-1.5">
              <span className="text-ink-400 text-sm font-medium shrink-0">#</span>
              <input
                list={`tags-opts-${contact.id}`}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }
                  if (e.key === ',') { e.preventDefault(); addTag(tagInput); }
                }}
                placeholder="Введите тег и нажмите Enter"
                className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-ink-300 border-b border-transparent focus:border-ink-300 pb-0.5 transition-colors"
              />
              {tagInput.trim() && (
                <button
                  type="button"
                  onClick={() => addTag(tagInput)}
                  className="text-xs text-violet-600 hover:text-violet-800 font-medium shrink-0 transition-colors"
                >
                  + Добавить
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Телефоны + Telegram — один блок */}
        <div className="border border-ink-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400">Телефоны</div>
            {phones.map((p, idx) => {
              const digits = p.value.replace(/\D/g, '');
              return (
                <div key={idx} className="flex items-center gap-2 group">
                  <input
                    type="tel"
                    value={p.value}
                    onChange={(e) => updatePhone(idx, e.target.value)}
                    placeholder="+7 999 123-45-67"
                    className="flex-1 px-3 py-1.5 text-sm bg-white border border-ink-200 rounded-md focus:outline-none focus:border-indigo-400 placeholder:text-ink-300"
                  />
                  <label className="flex items-center gap-0.5 text-[10px] font-bold text-green-600 cursor-pointer shrink-0 select-none">
                    <input
                      type="checkbox"
                      checked={p.wa}
                      onChange={(e) => updatePhoneFlag(idx, 'wa', e.target.checked)}
                      className="accent-green-600 w-3 h-3"
                    />
                    WA
                  </label>
                  <label className="flex items-center gap-0.5 text-[10px] font-bold text-sky-500 cursor-pointer shrink-0 select-none">
                    <input
                      type="checkbox"
                      checked={p.tg}
                      onChange={(e) => updatePhoneFlag(idx, 'tg', e.target.checked)}
                      className="accent-sky-500 w-3 h-3"
                    />
                    TG
                  </label>
                  {p.wa && digits.length >= 7 && (
                    <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] font-bold text-green-600 hover:text-green-700 px-1 py-0.5 rounded hover:bg-green-50 transition-colors shrink-0"
                      title="WhatsApp"
                    >↗</a>
                  )}
                  {p.tg && (p.tgUsername || digits.length >= 7) && (() => {
                    const tgClean = (p.tgUsername ?? '').replace(/^@/, '');
                    const href = tgClean ? `https://t.me/${tgClean}` : `https://t.me/+${digits}`;
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] font-bold text-sky-500 hover:text-sky-600 px-1 py-0.5 rounded hover:bg-sky-50 transition-colors shrink-0"
                        title={tgClean ? `@${tgClean}` : 'Telegram'}
                      >↗</a>
                    );
                  })()}
                  <button type="button" onClick={() => removePhone(idx)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-ink-400 hover:text-red-500 transition-all rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
            <AddButton onClick={addPhone} label="Добавить номер" />
          </div>

          <div className="px-4 py-3 border-t border-ink-100 space-y-3">
            {phones.length === 0 ? (
              <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400">Telegram</div>
            ) : (
              phones.map((p, idx) => {
                const tgVal = p.tgUsername ?? '';
                const tgClean = tgVal.replace(/^@/, '');
                const label = phones.length > 1 ? `Telegram ${idx + 1}` : 'Telegram';
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400">{label}</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tgVal}
                        onChange={(e) => updatePhoneTgUsername(idx, e.target.value)}
                        placeholder="@username"
                        className="flex-1 px-3 py-1.5 text-sm bg-white border border-ink-200 rounded-md focus:outline-none focus:border-indigo-400 placeholder:text-ink-300"
                      />
                      {tgClean && (
                        <a href={`https://t.me/${tgClean}`} target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] font-bold text-sky-500 hover:text-sky-600 px-1.5 py-0.5 rounded hover:bg-sky-50 transition-colors shrink-0"
                        >TG ↗</a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Custom fields */}
        {(fields.length > 0 || adding) && (
          <div className="border-t border-ink-100 pt-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                {fields.map((field) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    value={contact.values[field.id] ?? ''}
                    onChange={(v) =>
                      updateContact(contact.id, {
                        values: { ...contact.values, [field.id]: v },
                      })
                    }
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
          </div>
        )}

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
                className="flex-1 px-3 py-2 text-sm border border-ink-200 rounded-md focus:border-indigo-400 focus:outline-none"
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

function BudgetInput({ value, contactId }: { value: number; contactId: string }) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  return (
    <input
      type="text"
      inputMode="numeric"
      value={focused ? draft : (value > 0 ? formatBudget(value) : '')}
      onFocus={() => { setFocused(true); setDraft(value > 0 ? String(value) : ''); }}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
      onBlur={() => {
        setFocused(false);
        updateContact(contactId, { budget: parseInt(draft) || 0 });
      }}
      placeholder="0"
      className="w-full text-sm bg-transparent focus:outline-none placeholder:text-ink-300 border-b border-transparent focus:border-ink-300 pb-0.5 tabular-nums transition-colors"
    />
  );
}

function SectionBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400">{label}</div>
      {children}
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-ink-400 hover:text-indigo-600 inline-flex items-center gap-1 transition-colors"
    >
      <Plus size={12} /> {label}
    </button>
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

function LinkFieldInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { url, label } = parseLinkValue(value);
  return (
    <div className="space-y-1">
      <input
        type="url"
        value={url}
        onChange={(e) => onChange(encodeLinkValue(e.target.value, label))}
        placeholder="https://example.com"
        className="w-full px-2 py-1.5 text-sm bg-transparent border border-transparent hover:border-ink-200 focus:border-ink-300 focus:bg-white rounded-md transition-colors placeholder:text-ink-300"
      />
      <input
        type="text"
        value={label}
        onChange={(e) => onChange(encodeLinkValue(url, e.target.value))}
        placeholder="Текст ссылки (необязательно)"
        className="w-full px-2 py-1.5 text-sm bg-transparent border border-transparent hover:border-ink-200 focus:border-ink-300 focus:bg-white rounded-md transition-colors placeholder:text-ink-300 text-ink-500"
      />
    </div>
  );
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
            className="w-full text-xs font-medium text-ink-700 border-b border-ink-300 focus:outline-none bg-transparent pb-0.5"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setRenaming(true)}
            title="Двойной клик — переименовать"
            className="text-xs font-medium text-ink-500 text-left w-full truncate hover:text-ink-900 transition-colors"
          >
            {field.name}
          </button>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {field.type === 'link' ? (
          <LinkFieldInput value={value} onChange={onChange} />
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
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pt-1.5">
        <button
          type="button"
          onClick={onToggleVisible}
          title={field.visibleInTable ? 'Скрыть в таблице' : 'Показать в таблице'}
          className="p-1 text-ink-400 hover:text-ink-700 rounded transition-colors"
        >
          {field.visibleInTable ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Удалить поле"
          className="p-1 text-ink-400 hover:text-red-500 rounded transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
