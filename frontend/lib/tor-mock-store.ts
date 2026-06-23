import type { ToRDraft, ToRListItem } from './api';
import { MOCK_TOR_LIST, patchChecklistFromBody } from './tor-shared';

export const TOR_MOCK_STORAGE = {
  draftPrefix: 'tor-mock:',
  listKey: 'tor-mock-list',
  statusOverridesKey: 'tor-mock-status-overrides',
} as const;

const DRAFT_KEY_PREFIX = TOR_MOCK_STORAGE.draftPrefix;
const LIST_KEY = TOR_MOCK_STORAGE.listKey;
const STATUS_OVERRIDES_KEY = TOR_MOCK_STORAGE.statusOverridesKey;

const TOR_NEXT_STATUS: Record<ToRDraft['status'], ToRDraft['status'] | null> = {
  draft:     'review',
  review:    'approved',
  approved:  'archived',
  archived:  null,
};

function listStatusFromDraft(status: ToRDraft['status']): ToRListItem['status'] {
  if (status === 'approved') return 'approved';
  if (status === 'archived') return 'published';
  if (status === 'review') return 'review';
  return 'draft';
}

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

export function readMockTorStatusOverrides(): Record<string, ToRListItem['status']> {
  try {
    const raw = sessionStorage.getItem(STATUS_OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ToRListItem['status']>) : {};
  } catch {
    return {};
  }
}

function setMockTorStatusOverride(id: string, status: ToRListItem['status']) {
  try {
    const overrides = readMockTorStatusOverrides();
    overrides[id] = status;
    sessionStorage.setItem(STATUS_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // ignore
  }
}

export function mergeMockTorList(base: ToRListItem[]): ToRListItem[] {
  const overrides = readMockTorStatusOverrides();
  const withOverrides = base.map((row) =>
    overrides[row.id] ? { ...row, status: overrides[row.id] } : row,
  );
  const extra = readMockTorListItems();
  if (extra.length === 0) return withOverrides;
  const extraIds = new Set(extra.map((row) => row.id));
  return [...extra, ...withOverrides.filter((row) => !extraIds.has(row.id))];
}

export function advanceMockTorDraft(id: string, fallback: ToRDraft): ToRDraft {
  const draft = readMockTorDraft(id) ?? fallback;
  const next = TOR_NEXT_STATUS[draft.status];
  if (!next) throw new Error('TOR is already at the final status');
  return { ...draft, status: next };
}

export function updateMockTorDraftBody(id: string, fallback: ToRDraft, body_markdown: string): ToRDraft {
  const draft = readMockTorDraft(id) ?? fallback;
  if (draft.status !== 'draft' && draft.status !== 'review') {
    throw new Error('TOR body can only be edited while draft or in review');
  }
  const listRow = MOCK_TOR_LIST.find((row) => row.id === id);
  const compliance_checklist = patchChecklistFromBody(
    draft.compliance_checklist,
    body_markdown,
    { procurementKind: listRow?.procurement_kind },
  );
  return { ...draft, body_markdown, compliance_checklist };
}

export function syncMockTorListStatus(id: string, status: ToRDraft['status']) {
  const listStatus = listStatusFromDraft(status);
  const items = readMockTorListItems();
  const idx = items.findIndex((row) => row.id === id);
  if (idx >= 0) {
    items[idx] = { ...items[idx], status: listStatus };
    try {
      sessionStorage.setItem(LIST_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
    return;
  }
  setMockTorStatusOverride(id, listStatus);
}
