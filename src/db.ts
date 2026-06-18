import Dexie, { type Table } from 'dexie';
import { nanoid } from 'nanoid';
import type {
  Board,
  Contact,
  FieldDef,
  Status,
  AppMeta,
  SoldEntry,
  SoldCheckKey,
  SoldField,
  SoldFieldKey,
  SoldTemplate,
  SoldFieldType,
  NameSubItem,
} from './types';

class CrmDB extends Dexie {
  boards!: Table<Board, string>;
  statuses!: Table<Status, string>;
  fields!: Table<FieldDef, string>;
  contacts!: Table<Contact, string>;
  meta!: Table<AppMeta, string>;
  sold!: Table<SoldEntry, string>;
  soldFields!: Table<SoldField, string>;
  soldTemplates!: Table<SoldTemplate, string>;

  constructor() {
    super('crm-kanban');
    this.version(1).stores({
      boards: 'id, order',
      statuses: 'id, boardId, order',
      fields: 'id, boardId, order',
      contacts: 'id, boardId, statusId, createdAt, updatedAt',
      meta: 'key',
    });
    this.version(2).stores({
      boards: 'id, order',
      statuses: 'id, boardId, order',
      fields: 'id, boardId, order',
      contacts: 'id, boardId, statusId, createdAt, updatedAt',
      meta: 'key',
      sold: 'id, boardId, contactId, order, createdAt',
    });
    this.version(3)
      .stores({
        boards: 'id, order',
        statuses: 'id, boardId, order',
        fields: 'id, boardId, order',
        contacts: 'id, boardId, statusId, createdAt, updatedAt',
        meta: 'key',
        sold: 'id, boardId, contactId, order, createdAt',
        soldFields: 'id, boardId, order',
        soldTemplates: 'id, boardId, order',
      })
      .upgrade(async (tx) => {
        const boards = await tx.table('boards').toArray();
        for (const b of boards) {
          await seedSoldDefaultsInTx(tx, b.id);
        }
      });
  }
}

export const db = new CrmDB();

const DEFAULT_STATUSES: Array<{ name: string; color: string }> = [
  { name: 'Новый', color: '#6366f1' },
  { name: 'В работе', color: '#f59e0b' },
  { name: 'Переговоры', color: '#8b5cf6' },
  { name: 'Сделка', color: '#10b981' },
  { name: 'Отказ', color: '#ef4444' },
];

let seedPromise: Promise<string> | null = null;

export function ensureSeed(): Promise<string> {
  if (!seedPromise) seedPromise = doEnsureSeed();
  return seedPromise;
}

async function doEnsureSeed(): Promise<string> {
  return db.transaction('rw', db.boards, db.statuses, db.meta, async () => {
    const boardCount = await db.boards.count();
    if (boardCount === 0) {
      const boardId = nanoid();
      const now = Date.now();
      await db.boards.add({
        id: boardId,
        name: 'Клиенты',
        order: 0,
        createdAt: now,
      });
      await db.statuses.bulkAdd(
        DEFAULT_STATUSES.map((s, i) => ({
          id: nanoid(),
          boardId,
          name: s.name,
          color: s.color,
          order: i,
        })),
      );
      await db.meta.put({ key: 'currentBoardId', value: boardId });
      return boardId;
    }
    const stored = await db.meta.get('currentBoardId');
    if (stored) {
      const exists = await db.boards.get(stored.value);
      if (exists) return stored.value;
    }
    const first = await db.boards.orderBy('order').first();
    if (first) {
      await db.meta.put({ key: 'currentBoardId', value: first.id });
      return first.id;
    }
    // Should never reach here, but TS demands a return
    const boardId = nanoid();
    await db.boards.add({ id: boardId, name: 'Клиенты', order: 0, createdAt: Date.now() });
    await db.meta.put({ key: 'currentBoardId', value: boardId });
    return boardId;
  });
}

export async function setCurrentBoard(boardId: string) {
  await db.meta.put({ key: 'currentBoardId', value: boardId });
}

export async function createBoard(name: string): Promise<string> {
  const id = nanoid();
  const max = await db.boards.orderBy('order').last();
  const order = max ? max.order + 1 : 0;
  await db.boards.add({ id, name, order, createdAt: Date.now() });
  // Seed default statuses for the new board
  await db.statuses.bulkAdd(
    DEFAULT_STATUSES.map((s, i) => ({
      id: nanoid(),
      boardId: id,
      name: s.name,
      color: s.color,
      order: i,
    })),
  );
  // Seed default sold fields + template
  await ensureSoldDefaults(id);
  return id;
}

export async function deleteBoard(boardId: string) {
  await db.transaction('rw', db.boards, db.statuses, db.fields, db.contacts, async () => {
    await db.contacts.where('boardId').equals(boardId).delete();
    await db.statuses.where('boardId').equals(boardId).delete();
    await db.fields.where('boardId').equals(boardId).delete();
    await db.boards.delete(boardId);
  });
}

export async function createContact(boardId: string, name = ''): Promise<string> {
  const id = nanoid();
  const now = Date.now();
  // Default to first status
  const firstStatus = await db.statuses
    .where('boardId')
    .equals(boardId)
    .sortBy('order')
    .then((arr) => arr[0]);
  await db.contacts.add({
    id,
    boardId,
    name,
    statusId: firstStatus?.id ?? null,
    values: {},
    nameSubItems: [],
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateContact(id: string, patch: Partial<Contact>) {
  await db.contacts.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteContact(id: string) {
  await db.contacts.delete(id);
}

export async function bulkDeleteContacts(ids: string[]) {
  await db.contacts.bulkDelete(ids);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type { NameSubItem };

export async function createField(
  boardId: string,
  name: string,
  type: FieldDef['type'],
): Promise<string> {
  const id = nanoid();
  const max = await db.fields.where('boardId').equals(boardId).sortBy('order').then((arr) => arr.at(-1));
  const order = max ? max.order + 1 : 0;
  await db.fields.add({
    id,
    boardId,
    name,
    type,
    visibleInTable: true,
    order,
  });
  return id;
}

export async function updateField(id: string, patch: Partial<FieldDef>) {
  await db.fields.update(id, patch);
}

export async function deleteField(boardId: string, fieldId: string) {
  await db.transaction('rw', db.fields, db.contacts, async () => {
    await db.fields.delete(fieldId);
    const contacts = await db.contacts.where('boardId').equals(boardId).toArray();
    for (const c of contacts) {
      if (fieldId in c.values) {
        const next = { ...c.values };
        delete next[fieldId];
        await db.contacts.update(c.id, { values: next, updatedAt: Date.now() });
      }
    }
  });
}

export async function reorderFields(boardId: string, orderedIds: string[]) {
  await db.transaction('rw', db.fields, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.fields.update(orderedIds[i], { order: i });
    }
  });
}

export async function createStatus(boardId: string, name: string, color: string): Promise<string> {
  const id = nanoid();
  const max = await db.statuses.where('boardId').equals(boardId).sortBy('order').then((arr) => arr.at(-1));
  const order = max ? max.order + 1 : 0;
  await db.statuses.add({ id, boardId, name, color, order });
  return id;
}

export async function updateStatus(id: string, patch: Partial<Status>) {
  await db.statuses.update(id, patch);
}

export async function deleteStatus(boardId: string, statusId: string) {
  await db.transaction('rw', db.statuses, db.contacts, async () => {
    await db.statuses.delete(statusId);
    // Clear status on contacts that used it
    const affected = await db.contacts.where('boardId').equals(boardId).toArray();
    for (const c of affected) {
      if (c.statusId === statusId) {
        await db.contacts.update(c.id, { statusId: null, updatedAt: Date.now() });
      }
    }
  });
}

export async function reorderStatuses(boardId: string, orderedIds: string[]) {
  await db.transaction('rw', db.statuses, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.statuses.update(orderedIds[i], { order: i });
    }
  });
}

/**
 * Persist a column width. Pass `null` to remove (reset to default).
 */
export async function setColumnWidth(boardId: string, key: string, width: number | null) {
  await db.transaction('rw', db.boards, async () => {
    const b = await db.boards.get(boardId);
    if (!b) return;
    const next = { ...(b.columnWidths ?? {}) };
    if (width == null) delete next[key];
    else next[key] = Math.round(width);
    await db.boards.update(boardId, { columnWidths: next });
  });
}

// ─── SOLD ENTRIES ───────────────────────────────────────────────────────────

const DEFAULT_CHECKS: Record<SoldCheckKey, boolean> = {
  ustavnye: false,
  contractSpec: false,
  invoice: false,
  pp: false,
  upd: false,
  shipping: false,
};

interface SoldFieldSeed {
  key: SoldFieldKey;
  label: string;
  type: SoldFieldType;
  placeholder?: string;
}

const DEFAULT_SOLD_FIELDS: SoldFieldSeed[] = [
  { key: 'contractNo', label: '№ Договора', type: 'text', placeholder: 'D-2026-001' },
  { key: 'miner', label: 'Майнер', type: 'text', placeholder: 'Antminer S21 Pro' },
  { key: 'quantity', label: 'Кол-во', type: 'number', placeholder: '10' },
  { key: 'debt', label: 'Долг', type: 'number', placeholder: '0' },
  { key: 'deliveryDate', label: 'Срок поставки', type: 'text', placeholder: 'до 20.06.2026' },
  { key: 'tk', label: 'ТК', type: 'text', placeholder: 'СДЭК / Деловые / …' },
  { key: 'address', label: 'Адрес', type: 'textarea', placeholder: 'г. Москва, …' },
];

const DEFAULT_TEMPLATE_CONTENT = [
  `Поручение к Договору {{№ Договора}}`,
  ``,
  `Настоящим поручаем направить {{Майнер}} в количестве {{Кол-во}} шт. за наш счет по адресу: {{Адрес}}.`,
  `Согласны с тем, что доставка осуществляется по цене транспортной компании ({{ТК}}) и включает услуги по упаковке, погрузке и страхованию оборудования, которые оплачиваются за наш счет.`,
  `Также уведомлены, что переход риска случайной гибели или повреждения оборудования происходит в момент передачи оборудования уполномоченному представителю транспортной компании, а в период доставки оборудования от места отгрузки до адреса, указанного нами, ответственность за сохранность оборудования несет транспортная компания.`,
].join('\n');

/**
 * Internal core that performs the seed against whatever Table accessor is
 * provided (real `db` at runtime, or an upgrade Transaction during migration).
 */
async function seedSoldDefaultsCore(
  getFields: () => any,
  getTemplates: () => any,
  getSold: () => any,
  boardId: string,
): Promise<void> {
  const existing: number = await getFields().where('boardId').equals(boardId).count();
  if (existing > 0) return;
  const keyToId: Record<string, string> = {};
  const rows = DEFAULT_SOLD_FIELDS.map((f, i) => {
    const id = nanoid();
    keyToId[f.key] = id;
    return {
      id,
      boardId,
      label: f.label,
      type: f.type,
      placeholder: f.placeholder,
      key: f.key,
      order: i,
    };
  });
  await getFields().bulkAdd(rows);
  await getTemplates().add({
    id: nanoid(),
    boardId,
    name: 'Шаблон поручения',
    content: DEFAULT_TEMPLATE_CONTENT,
    order: 0,
  });
  // Migrate existing sold entries: remap old hardcoded keys → new field IDs
  const entries = await getSold().where('boardId').equals(boardId).toArray();
  for (const entry of entries) {
    const oldInfo = entry.info || {};
    const newInfo: Record<string, string> = {};
    let changed = false;
    for (const [oldKey, value] of Object.entries(oldInfo)) {
      const newId = keyToId[oldKey as string];
      if (newId) {
        newInfo[newId] = String(value ?? '');
        changed = true;
      } else {
        newInfo[oldKey] = String(value ?? '');
      }
    }
    if (changed) {
      await getSold().update(entry.id, { info: newInfo });
    }
  }
}

/**
 * Upgrade-time variant — uses the transaction tables.
 */
async function seedSoldDefaultsInTx(tx: any, boardId: string): Promise<void> {
  await seedSoldDefaultsCore(
    () => tx.table('soldFields'),
    () => tx.table('soldTemplates'),
    () => tx.table('sold'),
    boardId,
  );
}

/**
 * Ensure default sold fields + template exist for a board.
 * Safe to call repeatedly — only seeds when the board has no fields yet.
 */
export async function ensureSoldDefaults(boardId: string): Promise<void> {
  const existing = await db.soldFields.where('boardId').equals(boardId).count();
  if (existing > 0) return;
  await db.transaction('rw', db.soldFields, db.soldTemplates, db.sold, async () => {
    await seedSoldDefaultsCore(
      () => db.soldFields,
      () => db.soldTemplates,
      () => db.sold,
      boardId,
    );
  });
}

// CRUD: SoldField

export async function createSoldField(
  boardId: string,
  label: string,
  type: SoldFieldType = 'text',
): Promise<string> {
  const id = nanoid();
  const max = await db.soldFields
    .where('boardId')
    .equals(boardId)
    .sortBy('order')
    .then((arr) => arr.at(-1));
  const order = max ? max.order + 1 : 0;
  await db.soldFields.add({ id, boardId, label, type, order });
  return id;
}

export async function updateSoldField(id: string, patch: Partial<SoldField>) {
  await db.soldFields.update(id, patch);
}

export async function deleteSoldField(boardId: string, fieldId: string) {
  await db.transaction('rw', db.soldFields, db.sold, async () => {
    await db.soldFields.delete(fieldId);
    // Cleanup values in sold entries
    const entries = await db.sold.where('boardId').equals(boardId).toArray();
    for (const e of entries) {
      if (fieldId in e.info) {
        const next = { ...e.info };
        delete next[fieldId];
        await db.sold.update(e.id, { info: next, updatedAt: Date.now() });
      }
    }
  });
}

export async function reorderSoldFields(boardId: string, orderedIds: string[]) {
  await db.transaction('rw', db.soldFields, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.soldFields.update(orderedIds[i], { order: i });
    }
  });
}

// CRUD: SoldTemplate

export async function createSoldTemplate(
  boardId: string,
  name: string,
  content = '',
): Promise<string> {
  const id = nanoid();
  const max = await db.soldTemplates
    .where('boardId')
    .equals(boardId)
    .sortBy('order')
    .then((arr) => arr.at(-1));
  const order = max ? max.order + 1 : 0;
  await db.soldTemplates.add({ id, boardId, name, content, order });
  return id;
}

export async function updateSoldTemplate(id: string, patch: Partial<SoldTemplate>) {
  await db.soldTemplates.update(id, patch);
}

export async function deleteSoldTemplate(id: string) {
  await db.soldTemplates.delete(id);
}

export async function reorderSoldTemplates(boardId: string, orderedIds: string[]) {
  await db.transaction('rw', db.soldTemplates, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.soldTemplates.update(orderedIds[i], { order: i });
    }
  });
}

export async function createSoldEntry(
  boardId: string,
  init?: { contactId?: string | null; contactName?: string },
): Promise<string> {
  const id = nanoid();
  const now = Date.now();
  const max = await db.sold.where('boardId').equals(boardId).sortBy('order').then((arr) => arr.at(-1));
  const order = max ? max.order + 1 : 0;
  await db.sold.add({
    id,
    boardId,
    contactId: init?.contactId ?? null,
    contactName: init?.contactName ?? '',
    info: {},
    checks: { ...DEFAULT_CHECKS },
    order,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateSoldEntry(id: string, patch: Partial<SoldEntry>) {
  await db.sold.update(id, { ...patch, updatedAt: Date.now() });
}

export async function updateSoldInfo(id: string, infoPatch: Record<string, string>) {
  const cur = await db.sold.get(id);
  if (!cur) return;
  await db.sold.update(id, {
    info: { ...cur.info, ...infoPatch },
    updatedAt: Date.now(),
  });
}

export async function toggleSoldCheck(id: string, key: SoldCheckKey) {
  const cur = await db.sold.get(id);
  if (!cur) return;
  await db.sold.update(id, {
    checks: { ...cur.checks, [key]: !cur.checks[key] },
    updatedAt: Date.now(),
  });
}

export async function deleteSoldEntry(id: string) {
  await db.sold.delete(id);
}

/**
 * Link a sold entry to an existing contact. Copies the contact's current name.
 */
export async function linkSoldEntryToContact(soldId: string, contact: Contact) {
  await db.sold.update(soldId, {
    contactId: contact.id,
    contactName: contact.name || '',
    updatedAt: Date.now(),
  });
}

/**
 * Create a new contact in the main kanban AND link this sold entry to it.
 */
export async function createContactAndLink(
  boardId: string,
  soldId: string,
  name: string,
): Promise<string> {
  const contactId = await createContact(boardId, name);
  const c = await db.contacts.get(contactId);
  if (c) await linkSoldEntryToContact(soldId, c);
  return contactId;
}
