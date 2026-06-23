export type FieldType = 'text' | 'phone' | 'email' | 'note' | 'link';

export interface FieldDef {
  id: string;
  boardId: string;
  name: string;
  type: FieldType;
  visibleInTable: boolean;
  order: number;
}

export interface Status {
  id: string;
  boardId: string;
  name: string;
  color: string;
  order: number;
}

export interface NameSubItem {
  id: string;
  value: string;
}

export interface TouchHistoryEntry {
  touchedAt: number;
  comment: string;
}

export interface CompanyEntry {
  id: string;
  name: string;
  url: string;
}

export interface PhoneEntry {
  value: string;
  wa: boolean;
  tg: boolean;
}

export interface Contact {
  id: string;
  boardId: string;
  name: string;
  statusId: string | null;
  values: Record<string, string>; // fieldId -> value
  nameSubItems?: NameSubItem[]; // legacy
  statusIds?: string[];       // replaces statusId after v4 migration
  phones?: PhoneEntry[];
  companies?: CompanyEntry[];
  nameUrl?: string;
  lastTouchedAt?: number;     // ms timestamp; 0 = never
  lastTouchComment?: string;
  tgUsername?: string;
  location?: string;
  budget?: number;
  touchHistory?: TouchHistoryEntry[];
  photo?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Board {
  id: string;
  name: string;
  order: number;
  createdAt: number;
  /** Width in pixels per column key: 'status' | 'name' | <fieldId> */
  columnWidths?: Record<string, number>;
}

export interface AppMeta {
  key: string;
  value: string;
}

export type SoldCheckKey = 'ustavnye' | 'contractSpec' | 'invoice' | 'pp' | 'upd' | 'shipping';

export type SoldFieldType = 'text' | 'textarea' | 'number';

/**
 * Semantic key for a few special fields the rest of the UI hooks into
 * (e.g. the Долг column mirrors the field marked `key === 'debt'`).
 * User-created fields have `key` undefined.
 */
export type SoldFieldKey =
  | 'contractNo'
  | 'miner'
  | 'quantity'
  | 'debt'
  | 'deliveryDate'
  | 'tk'
  | 'address';

export interface SoldField {
  id: string;
  boardId: string;
  label: string;
  type: SoldFieldType;
  key?: SoldFieldKey;
  placeholder?: string;
  order: number;
}

export interface SoldTemplate {
  id: string;
  boardId: string;
  name: string;
  /** Template body. Placeholders look like `{{Имя поля}}` (matches SoldField.label). */
  content: string;
  order: number;
}

export interface SoldEntry {
  id: string;
  boardId: string;
  contactId: string | null;
  contactName: string;
  contactUrl?: string;
  /** fieldId -> value */
  info: Record<string, string>;
  checks: Record<SoldCheckKey, boolean>;
  order: number;
  createdAt: number;
  updatedAt: number;
}
