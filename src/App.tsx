import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Settings } from 'lucide-react';
import { db, ensureSeed, createContact, createSoldEntry, ensureSoldDefaults } from './db';
import { Table } from './components/Table';
import { Toolbar } from './components/Toolbar';
import { ContactCard } from './components/ContactCard';
import { StatusManager } from './components/StatusManager';
import { BoardSwitcher } from './components/BoardSwitcher';
import { ColumnPicker } from './components/ColumnPicker';
import { TabsNav, type ViewKey } from './components/TabsNav';
import { SoldTable } from './components/sold/SoldTable';
import { StatusSidebar } from './components/StatusSidebar';
import { SettingsModal } from './components/SettingsModal';
import { loadSettings, saveSettings, type AppSettings } from './settings';

export default function App() {
  const [ready, setReady] = useState(false);
  const [currentBoardId, setCurrentBoardId] = useState<string>('');
  const [view, setView] = useState<ViewKey>('kanban');
  const [openContactId, setOpenContactId] = useState<string | null>(null);
  const [statusMgrOpen, setStatusMgrOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsBtnRef = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [sidebarTab, setSidebarTab] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  function handleSettingsChange(s: AppSettings) {
    setSettings(s);
    saveSettings(s);
  }

  useEffect(() => {
    ensureSeed().then((id) => {
      setCurrentBoardId(id);
      setReady(true);
    });
  }, []);

  const boards = useLiveQuery(() => db.boards.orderBy('order').toArray(), [], []);
  const currentBoard = useLiveQuery(
    () => (currentBoardId ? db.boards.get(currentBoardId) : undefined),
    [currentBoardId],
    null,
  );
  const allFields = useLiveQuery(
    () => (currentBoardId ? db.fields.where('boardId').equals(currentBoardId).sortBy('order') : []),
    [currentBoardId],
    [],
  );
  const statuses = useLiveQuery(
    () =>
      currentBoardId ? db.statuses.where('boardId').equals(currentBoardId).sortBy('order') : [],
    [currentBoardId],
    [],
  );
  const contacts = useLiveQuery(
    () =>
      currentBoardId
        ? db.contacts.where('boardId').equals(currentBoardId).reverse().sortBy('createdAt')
        : [],
    [currentBoardId],
    [],
  );
  const soldEntries = useLiveQuery(
    () =>
      currentBoardId ? db.sold.where('boardId').equals(currentBoardId).sortBy('createdAt') : [],
    [currentBoardId],
    [],
  );
  const soldFields = useLiveQuery(
    () =>
      currentBoardId ? db.soldFields.where('boardId').equals(currentBoardId).sortBy('order') : [],
    [currentBoardId],
    [],
  );
  const soldTemplates = useLiveQuery(
    () =>
      currentBoardId
        ? db.soldTemplates.where('boardId').equals(currentBoardId).sortBy('order')
        : [],
    [currentBoardId],
    [],
  );

  // Ensure SOLD defaults seeded for current board (idempotent)
  useEffect(() => {
    if (currentBoardId) ensureSoldDefaults(currentBoardId);
  }, [currentBoardId]);

  const visibleFields = useMemo(() => allFields.filter((f) => f.visibleInTable), [allFields]);
  const allLocations = useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts) {
      const loc = (c.location ?? '').trim();
      if (loc) set.add(loc);
    }
    return [...set].sort();
  }, [contacts]);
  const openContact = useMemo(
    () => contacts.find((c) => c.id === openContactId) ?? null,
    [contacts, openContactId],
  );

  // Reset filters when switching boards or views
  useEffect(() => {
    setStatusFilter(new Set());
    setSearch('');
    setSidebarTab(null);
  }, [currentBoardId, view]);

  // Hotkey: Cmd/Ctrl + N → new contact / new sold entry (depending on view)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (!currentBoardId) return;
        if (view === 'kanban') createContact(currentBoardId, '', sidebarTab ?? undefined).then(setOpenContactId);
        else createSoldEntry(currentBoardId);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentBoardId, view]);

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center text-ink-400 text-sm">Загрузка…</div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="border-b border-ink-200 px-4 py-2.5 flex items-center gap-3 flex-wrap bg-white">
        <BoardSwitcher
          boards={boards}
          currentBoardId={currentBoardId}
          onSwitch={setCurrentBoardId}
        />
        <TabsNav current={view} onChange={setView} />
        <div className="text-ink-300 text-xs">
          {view === 'kanban' &&
            contacts.length > 0 &&
            `${contacts.length} ${plural(contacts.length, ['клиент', 'клиента', 'клиентов'])}`}
          {view === 'sold' &&
            soldEntries.length > 0 &&
            `${soldEntries.length} ${plural(soldEntries.length, ['сделка', 'сделки', 'сделок'])}`}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          title="Настройки"
          className="p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 rounded-md transition-colors"
        >
          <Settings size={16} />
        </button>
        {view === 'kanban' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusMgrOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-ink-200 text-ink-700 rounded-md hover:bg-ink-50 transition-colors"
            >
              <Plus size={14} /> Статус
            </button>
            <button
              type="button"
              onClick={async () => {
                const id = await createContact(currentBoardId, '', sidebarTab ?? undefined);
                setOpenContactId(id);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-ink-900 text-white rounded-md hover:bg-ink-700 transition-colors"
            >
              <Plus size={14} /> Клиент
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={async () => {
              await createSoldEntry(currentBoardId);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-ink-900 text-white rounded-md hover:bg-ink-700 transition-colors"
          >
            <Plus size={14} /> Новая сделка
          </button>
        )}
      </header>

      {view === 'kanban' && (
        <div className="flex flex-1 overflow-hidden">
          <StatusSidebar
            statuses={statuses}
            contacts={contacts}
            active={sidebarTab}
            onChange={setSidebarTab}
          />
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-ink-200 bg-white">
              <Toolbar
                search={search}
                onSearch={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                statuses={statuses}
                onColumnsClick={() => setColumnsOpen((v) => !v)}
                columnsBtnRef={columnsBtnRef}
              />
            </div>

            <Table
              contacts={contacts}
              fields={visibleFields}
              allFields={allFields}
              statuses={statuses}
              board={currentBoard ?? null}
              boardId={currentBoardId}
              onOpenContact={setOpenContactId}
              onOpenStatusManager={() => setStatusMgrOpen(true)}
              search={search}
              statusFilter={statusFilter}
              sidebarTab={sidebarTab}
              avatarEnabled={settings.avatarEnabled}
              touchThresholds={settings.touchThresholds}
              budgetThresholds={settings.budgetThresholds}
              budgetColorEnabled={settings.budgetColorEnabled}
            />

            <ColumnPicker
              anchor={columnsBtnRef.current}
              open={columnsOpen}
              onClose={() => setColumnsOpen(false)}
              fields={allFields}
            />
          </div>
        </div>
      )}

      {view === 'sold' && (
        <SoldTable
          entries={soldEntries}
          contacts={contacts}
          fields={soldFields}
          templates={soldTemplates}
          boardId={currentBoardId}
        />
      )}

      <ContactCard
        open={!!openContact}
        onClose={() => setOpenContactId(null)}
        contact={openContact}
        fields={allFields}
        statuses={statuses}
        boardId={currentBoardId}
        onOpenStatusManager={() => setStatusMgrOpen(true)}
        avatarEnabled={settings.avatarEnabled}
        locations={allLocations}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={handleSettingsChange}
      />

      <StatusManager
        open={statusMgrOpen}
        onClose={() => setStatusMgrOpen(false)}
        boardId={currentBoardId}
        statuses={statuses}
      />
    </div>
  );
}

function plural(n: number, forms: [string, string, string]): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}
