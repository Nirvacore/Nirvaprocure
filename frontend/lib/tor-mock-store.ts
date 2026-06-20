import type { ToRDraft, ToRListItem } from './api';

const DRAFT_KEY_PREFIX = 'tor-mock:';
const LIST_KEY = 'tor-mock-list';

/** Persist a client-side mock draft so the detail page can load it after redirect. */
export function storeMockTorDraft(draft: ToRDraft) {
  try {
    sessionStorage.setItem(`${DRAFT_KEY_PREFIX}${draft.id}`, JSON.stringify(draft));
  } catch {
    // sessionStorage may be unavailable in some embedded contexts
  }
}

export function readMockTorDraft(id: string): ToRDraft | null {
  try {
    const raw = sessionStorage.getItem(`${DRAFT_KEY_PREFIX}${id}`);
    return raw ? (JSON.parse(raw) as ToRDraft) : null;
  } catch {
    return null;
  }
}

/** Track mock list rows created in this browser session (offline create flow). */
export function appendMockTorListItem(item: ToRListItem) {
  try {
    const items = readMockTorListItems().filter((row) => row.id !== item.id);
    sessionStorage.setItem(LIST_KEY, JSON.stringify([item, ...items]));
  } catch {
    // ignore
  }
}

export function readMockTorListItems(): ToRListItem[] {
  try {
    const raw = sessionStorage.getItem(LIST_KEY);
    return raw ? (JSON.parse(raw) as ToRListItem[]) : [];
  } catch {
    return [];
  }
}

export function mergeMockTorList(base: ToRListItem[]): ToRListItem[] {
  const extra = readMockTorListItems();
  if (extra.length === 0) return base;
  const extraIds = new Set(extra.map((row) => row.id));
  return [...extra, ...base.filter((row) => !extraIds.has(row.id))];
}
