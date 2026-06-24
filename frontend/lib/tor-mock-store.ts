import type { ToRDraft, ToRListItem, ToRTemplate } from './api';
import type { ToRBrief } from './api';
import { MOCK_TOR_DRAFTS, MOCK_TOR_LIST, patchChecklistFromBody } from './tor-shared';

export const TOR_MOCK_STORAGE = {
  draftPrefix: 'tor-mock:',
  listKey: 'tor-mock-list',
  statusOverridesKey: 'tor-mock-status-overrides',
  prLinkPrefix: 'tor-mock-pr:',
  prToTorPrefix: 'pr-mock-tor-src:',
  customTemplatesKey: 'tor-mock-custom-templates',
} as const;

const DRAFT_KEY_PREFIX = TOR_MOCK_STORAGE.draftPrefix;
const LIST_KEY = TOR_MOCK_STORAGE.listKey;
const STATUS_OVERRIDES_KEY = TOR_MOCK_STORAGE.statusOverridesKey;
const PR_LINK_PREFIX = TOR_MOCK_STORAGE.prLinkPrefix;
const PR_TO_TOR_PREFIX = TOR_MOCK_STORAGE.prToTorPrefix;
const CUSTOM_TEMPLATES_KEY = TOR_MOCK_STORAGE.customTemplatesKey;

const TOR_NEXT_STATUS: Record<ToRDraft['status'], ToRDraft['status'] | null> = {
  draft:     'review',
  review:    'approved',
  approved:  'archived',
  archived:  null,
};

const TOR_PREV_STATUS: Partial<Record<ToRDraft['status'], ToRDraft['status']>> = {
  review: 'draft',
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
    if (!raw) return null;
    return mergeMockTorPrLink(JSON.parse(raw) as ToRDraft);
  } catch {
    return null;
  }
}

export function readMockTorPrLink(id: string): { pr_id: string; pr_number: string } | null {
  try {
    const raw = sessionStorage.getItem(`${PR_LINK_PREFIX}${id}`);
    return raw ? (JSON.parse(raw) as { pr_id: string; pr_number: string }) : null;
  } catch {
    return null;
  }
}

function storeMockTorPrLink(id: string, link: { pr_id: string; pr_number: string }) {
  try {
    sessionStorage.setItem(`${PR_LINK_PREFIX}${id}`, JSON.stringify(link));
  } catch {
    // ignore
  }
}

export function mergeMockTorPrLink(draft: ToRDraft): ToRDraft {
  const link = readMockTorPrLink(draft.id);
  if (!link) return draft;
  return { ...draft, linked_pr_id: link.pr_id, linked_pr_number: link.pr_number };
}

export function findMockTorByPrId(prId: string): { id: string; title: string; status: ToRDraft['status'] } | null {
  try {
    const raw = sessionStorage.getItem(`${PR_TO_TOR_PREFIX}${prId}`);
    if (raw) return JSON.parse(raw) as { id: string; title: string; status: ToRDraft['status'] };
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith(PR_LINK_PREFIX)) continue;
      const link = JSON.parse(sessionStorage.getItem(key)!) as { pr_id: string; pr_number: string };
      if (link.pr_id !== prId) continue;
      const torId = key.slice(PR_LINK_PREFIX.length);
      const draft = readMockTorDraft(torId) ?? MOCK_TOR_DRAFTS[torId];
      if (draft) return { id: draft.id, title: draft.title, status: draft.status };
    }
  } catch {
    // ignore
  }
  return null;
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

function readCustomMockTemplates(): ToRTemplate[] {
  try {
    const raw = sessionStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return raw ? (JSON.parse(raw) as ToRTemplate[]) : [];
  } catch {
    return [];
  }
}

function writeCustomMockTemplates(items: ToRTemplate[]) {
  try {
    sessionStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function mergeMockTorTemplates(base: ToRTemplate[]): ToRTemplate[] {
  const extra = readCustomMockTemplates();
  if (extra.length === 0) return base;
  const extraIds = new Set(extra.map((row) => row.id));
  return [...extra, ...base.filter((row) => !extraIds.has(row.id))];
}

export function createMockTorTemplate(
  name: string,
  procurement_kind: ToRBrief['procurement_kind'],
  _body_markdown?: string,
): ToRTemplate {
  const tpl: ToRTemplate = {
    id: `tpl-custom-${Date.now()}`,
    name: name.trim(),
    procurement_kind,
    is_official: false,
  };
  const items = readCustomMockTemplates().filter((row) => row.id !== tpl.id);
  writeCustomMockTemplates([tpl, ...items]);
  return tpl;
}

export function deleteMockTorTemplate(id: string) {
  if (!id.startsWith('tpl-custom-')) {
    throw new Error('Official templates cannot be deleted');
  }
  writeCustomMockTemplates(readCustomMockTemplates().filter((row) => row.id !== id));
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

export function revertMockTorDraft(id: string, fallback: ToRDraft): ToRDraft {
  const draft = readMockTorDraft(id) ?? fallback;
  const prev = TOR_PREV_STATUS[draft.status];
  if (!prev) throw new Error('TOR cannot be sent back from this status');
  return { ...draft, status: prev };
}

export function createMockPrFromTor(
  id: string,
  draft: ToRDraft,
  _brief: ToRBrief,
): ToRDraft {
  const current = mergeMockTorPrLink(readMockTorDraft(id) ?? draft);
  if (current.status !== 'approved') {
    throw new Error('PR can only be created from an approved TOR');
  }
  if (current.linked_pr_id) {
    throw new Error('A purchase request already exists for this TOR');
  }

  const prId = `pr-mock-tor-${Date.now()}`;
  const prNumber = `PR-TOR-${String(Date.now()).slice(-6)}`;
  const link = { pr_id: prId, pr_number: prNumber };
  storeMockTorPrLink(id, link);
  try {
    sessionStorage.setItem(
      `${PR_TO_TOR_PREFIX}${prId}`,
      JSON.stringify({ id: current.id, title: current.title, status: current.status }),
    );
  } catch {
    // ignore
  }
  const updated = { ...current, linked_pr_id: link.pr_id, linked_pr_number: link.pr_number };
  storeMockTorDraft(updated);
  return updated;
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
