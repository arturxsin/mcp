import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Link2, Pencil, X, ChevronDown } from 'lucide-react';
import { Popover } from '../Popover';
import {
  createContactAndLink,
  linkSoldEntryToContact,
  updateSoldEntry,
} from '../../db';
import type { Contact, SoldEntry } from '../../types';

interface Props {
  entry: SoldEntry;
  boardId: string;
  contacts: Contact[];
}

export function ClientCell({ entry, boardId, contacts }: Props) {
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [urlAnchor, setUrlAnchor] = useState<HTMLElement | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);

  function onNameLeftClick(e: React.MouseEvent) {
    e.preventDefault();
    if (entry.contactUrl && entry.contactName) {
      // open the link
      let href = entry.contactUrl;
      if (!/^https?:\/\//i.test(href) && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        href = `https://${href}`;
      }
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    // No URL → open picker
    setPickerAnchor(e.currentTarget as HTMLElement);
    setPickerOpen(true);
  }

  function onNameContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setUrlAnchor(e.currentTarget as HTMLElement);
    setUrlOpen(true);
  }

  const hasName = !!entry.contactName.trim();

  return (
    <div className="flex items-center gap-1.5 min-w-0 group">
      {hasName ? (
        <button
          type="button"
          onClick={onNameLeftClick}
          onContextMenu={onNameContextMenu}
          title={entry.contactUrl ? `ЛКМ: открыть ${entry.contactUrl} • ПКМ: ссылку` : 'ПКМ: добавить ссылку'}
          className={`min-w-0 max-w-full truncate text-left px-2 py-1 rounded text-sm font-medium transition-colors ${
            entry.contactUrl
              ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 hover:underline'
              : 'text-ink-900 hover:bg-ink-100'
          }`}
        >
          {entry.contactUrl && <ExternalLink size={11} className="inline mr-1 -mt-0.5 opacity-70" />}
          {entry.contactName}
        </button>
      ) : (
        <button
          ref={setPickerAnchor}
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1 px-2 py-1 text-sm text-ink-400 hover:text-ink-900 hover:bg-ink-100 rounded transition-colors"
        >
          <ChevronDown size={12} /> Выбрать клиента
        </button>
      )}
      {hasName && (
        <button
          ref={setPickerAnchor}
          type="button"
          onClick={() => setPickerOpen(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-ink-400 hover:text-ink-900 hover:bg-ink-100 rounded"
          title="Изменить клиента"
        >
          <Pencil size={11} />
        </button>
      )}
      <ClientPicker
        anchor={pickerAnchor}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        contacts={contacts}
        currentContactId={entry.contactId}
        onPickExisting={async (c) => {
          await linkSoldEntryToContact(entry.id, c);
          setPickerOpen(false);
        }}
        onCreateNew={async (name, addToKanban) => {
          if (addToKanban) {
            await createContactAndLink(boardId, entry.id, name);
          } else {
            await updateSoldEntry(entry.id, { contactId: null, contactName: name });
          }
          setPickerOpen(false);
        }}
        onClear={async () => {
          await updateSoldEntry(entry.id, {
            contactId: null,
            contactName: '',
            contactUrl: undefined,
          });
          setPickerOpen(false);
        }}
      />
      <UrlEditor
        anchor={urlAnchor}
        open={urlOpen}
        onClose={() => setUrlOpen(false)}
        currentUrl={entry.contactUrl ?? ''}
        onSave={async (url) => {
          await updateSoldEntry(entry.id, { contactUrl: url || undefined });
          setUrlOpen(false);
        }}
      />
    </div>
  );
}

interface PickerProps {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  contacts: Contact[];
  currentContactId: string | null;
  onPickExisting: (c: Contact) => void;
  onCreateNew: (name: string, addToKanban: boolean) => void;
  onClear: () => void;
}

function ClientPicker({
  anchor,
  open,
  onClose,
  contacts,
  currentContactId,
  onPickExisting,
  onCreateNew,
  onClear,
}: PickerProps) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [addToKanban, setAddToKanban] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setCreating(false);
      setNewName('');
      setAddToKanban(true);
    }
  }, [open]);

  useEffect(() => {
    if (open && !creating) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open, creating]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? contacts.filter((c) => c.name.toLowerCase().includes(q))
    : contacts;

  return (
    <Popover anchor={anchor} open={open} onClose={onClose} width={280}>
      {!creating ? (
        <>
          <div className="px-2 py-1.5">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск клиента…"
              className="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-md focus:border-ink-400"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-xs text-ink-400 text-center">
                {q ? 'Не найдено в основном канбане' : 'В основном канбане пока нет клиентов'}
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onPickExisting(c)}
                className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-ink-100 rounded-md text-left text-sm transition-colors"
              >
                <span className="truncate">{c.name || <span className="text-ink-400">Без имени</span>}</span>
                {currentContactId === c.id && <span className="text-[10px] text-ink-400">текущий</span>}
              </button>
            ))}
          </div>
          <div className="border-t border-ink-200 mt-1 pt-1">
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                setNewName(query);
              }}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-ink-100 rounded-md text-left text-xs text-ink-700 transition-colors"
            >
              + Создать нового клиента{q && `: «${query}»`}
            </button>
            {currentContactId !== null || filtered.length > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-ink-100 rounded-md text-left text-xs text-ink-400 hover:text-ink-700 transition-colors"
              >
                Очистить
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="p-2 space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-ink-400 font-medium px-1">
            Новый клиент
          </div>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) {
                onCreateNew(newName.trim(), addToKanban);
              } else if (e.key === 'Escape') {
                setCreating(false);
              }
            }}
            placeholder="Имя клиента"
            className="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-md focus:border-ink-400"
          />
          <label className="flex items-center gap-2 px-1 cursor-pointer">
            <input
              type="checkbox"
              checked={addToKanban}
              onChange={(e) => setAddToKanban(e.target.checked)}
              className="h-3.5 w-3.5 accent-ink-900"
            />
            <span className="text-xs text-ink-700">Добавить в основной канбан</span>
          </label>
          <div className="flex items-center justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-2 py-1 text-xs text-ink-500 hover:bg-ink-100 rounded transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => newName.trim() && onCreateNew(newName.trim(), addToKanban)}
              disabled={!newName.trim()}
              className="px-2.5 py-1 text-xs font-medium bg-ink-900 text-white rounded hover:bg-ink-700 disabled:opacity-40 transition-colors"
            >
              Создать
            </button>
          </div>
        </div>
      )}
    </Popover>
  );
}

interface UrlProps {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  currentUrl: string;
  onSave: (url: string) => void;
}

function UrlEditor({ anchor, open, onClose, currentUrl, onSave }: UrlProps) {
  const [url, setUrl] = useState(currentUrl);

  useEffect(() => {
    if (open) setUrl(currentUrl);
  }, [open, currentUrl]);

  return (
    <Popover anchor={anchor} open={open} onClose={onClose} width={300}>
      <div className="p-2 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-ink-400 font-medium px-1 flex items-center gap-1">
          <Link2 size={11} /> Ссылка на клиента
        </div>
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave(url.trim());
            else if (e.key === 'Escape') onClose();
          }}
          placeholder="https://t.me/username, mailto:…, https://…"
          className="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-md focus:border-ink-400"
        />
        <div className="flex items-center justify-between gap-1.5 pt-1">
          {currentUrl ? (
            <button
              type="button"
              onClick={() => onSave('')}
              className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded transition-colors inline-flex items-center gap-1"
            >
              <X size={11} /> Удалить
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 text-xs text-ink-500 hover:bg-ink-100 rounded transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => onSave(url.trim())}
              className="px-2.5 py-1 text-xs font-medium bg-ink-900 text-white rounded hover:bg-ink-700 transition-colors"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </Popover>
  );
}
