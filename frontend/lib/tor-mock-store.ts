import type { ToRDraft } from './api';

const KEY_PREFIX = 'tor-mock:';

/** Persist a client-side mock draft so the detail page can load it after redirect. */
export function storeMockTorDraft(draft: ToRDraft) {
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${draft.id}`, JSON.stringify(draft));
  } catch {
    // sessionStorage may be unavailable in some embedded contexts
  }
}

export function readMockTorDraft(id: string): ToRDraft | null {
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${id}`);
    return raw ? (JSON.parse(raw) as ToRDraft) : null;
  } catch {
    return null;
  }
}
