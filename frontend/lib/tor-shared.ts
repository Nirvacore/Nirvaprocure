import type { ToRBrief, ToRDraft, ToRListItem, ToRTemplate } from './api';
import type { TranslationKey } from './i18n/dictionary';

/** Shared i18n keys for procurement kind badges. */
export const TOR_KIND_LABEL_KEYS: Record<ToRBrief['procurement_kind'], TranslationKey> = {
  goods: 'tor.kind.goods',
  services: 'tor.kind.services',
  construction: 'tor.kind.construction',
};

/** Shared i18n keys for compliance checklist rows. */
export const TOR_CHECKLIST_LABEL_KEYS: Record<string, TranslationKey> = {
  has_scope:             'tor.checklist.scope',
  has_budget:            'tor.checklist.budget',
  has_deliverables:      'tor.checklist.deliverables',
  has_evaluation_method: 'tor.checklist.evaluation',
  has_timeline:          'tor.checklist.timeline',
  has_qualifications:    'tor.checklist.qualifications',
};

export const MOCK_TOR_TEMPLATES: ToRTemplate[] = [
  { id: 'tpl-goods',        name: 'จัดซื้อครุภัณฑ์ทั่วไป',     procurement_kind: 'goods',        is_official: true },
  { id: 'tpl-services',     name: 'จ้างเหมาบริการมาตรฐาน',    procurement_kind: 'services',     is_official: true },
  { id: 'tpl-construction', name: 'งานก่อสร้างขนาดเล็ก',       procurement_kind: 'construction', is_official: false },
];

export const MOCK_TOR_LIST: ToRListItem[] = [
  {
    id: 'tor-1',
    title: 'จัดซื้อเครื่องคอมพิวเตอร์ จำนวน 20 เครื่อง',
    procurement_kind: 'goods',
    status: 'draft',
    created_at: '2026-06-10T09:00:00Z',
  },
  {
    id: 'tor-2',
    title: 'จ้างเหมาบำรุงรักษาระบบเครือข่าย',
    procurement_kind: 'services',
    status: 'approved',
    created_at: '2026-06-05T14:30:00Z',
  },
  {
    id: 'tor-3',
    title: 'ก่อสร้างอาคารคลังสินค้า',
    procurement_kind: 'construction',
    status: 'published',
    created_at: '2026-05-28T11:00:00Z',
  },
];

export const MOCK_TOR_DRAFTS: Record<string, ToRDraft> = {
  'tor-1': {
    id: 'tor-1',
    title: 'จัดซื้อเครื่องคอมพิวเตอร์ จำนวน 20 เครื่อง',
    status: 'draft',
    body_markdown: [
      '## ๑. ความเป็นมา',
      'หน่วยงานมีความจำเป็นต้องจัดซื้อเครื่องคอมพิวเตอร์เพื่อทดแทนอุปกรณ์เดิม',
      '',
      '## ๒. วัตถุประสงค์',
      'เพื่อสนับสนุนการปฏิบัติงานของเจ้าหน้าที่',
    ].join('\n'),
    compliance_checklist: {
      has_scope: 'passed',
      has_budget: 'passed',
      has_deliverables: 'passed',
      has_evaluation_method: 'passed',
      has_timeline: 'failed',
      has_qualifications: 'na',
    },
    created_at: '2026-06-10T09:00:00Z',
  },
  'tor-2': {
    id: 'tor-2',
    title: 'จ้างเหมาบำรุงรักษาระบบเครือข่าย',
    status: 'approved',
    body_markdown: '## ขอบเขตของงาน\nบำรุงรักษาระบบเครือข่ายภายในหน่วยงานเป็นระยะเวลา 12 เดือน',
    compliance_checklist: {
      has_scope: 'passed',
      has_budget: 'passed',
      has_deliverables: 'passed',
      has_evaluation_method: 'passed',
      has_timeline: 'passed',
      has_qualifications: 'na',
    },
    created_at: '2026-06-05T14:30:00Z',
  },
  'tor-3': {
    id: 'tor-3',
    title: 'ก่อสร้างอาคารคลังสินค้า',
    status: 'archived',
    body_markdown: '## ขอบเขตของงาน\nก่อสร้างอาคารคลังสินค้าขนาด 500 ตร.ม.',
    compliance_checklist: {
      has_scope: 'passed',
      has_budget: 'passed',
      has_deliverables: 'passed',
      has_evaluation_method: 'passed',
      has_timeline: 'passed',
      has_qualifications: 'passed',
    },
    created_at: '2026-05-28T11:00:00Z',
  },
};

export const TOR_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const TOR_DETAIL_STATUS_LABEL_KEYS: Record<ToRDraft['status'], TranslationKey> = {
  draft:     'tor.status.draft',
  review:    'tor.status.review',
  approved:  'tor.status.approved',
  archived:  'tor.status.archived',
};

export const TOR_ADVANCE_LABEL_KEYS: Partial<Record<ToRDraft['status'], TranslationKey>> = {
  draft:    'tor.action.submit_review',
  review:   'tor.action.approve',
  approved: 'tor.action.archive',
};

/** Allowed send-back transitions (review → draft). */
export const TOR_REVERT_LABEL_KEYS: Partial<Record<ToRDraft['status'], TranslationKey>> = {
  review: 'tor.action.send_back',
};

export const TOR_PREV_STATUS: Partial<Record<ToRDraft['status'], ToRDraft['status']>> = {
  review: 'draft',
};

export const TOR_DETAIL_STATUS_STYLE: Record<ToRDraft['status'], { bg: string; text: string }> = {
  draft:     { bg: 'bg-gray-100',   text: 'text-ink-soft' },
  review:    { bg: 'bg-amber-100',  text: 'text-amber-800' },
  approved:  { bg: 'bg-green-100',  text: 'text-green-800' },
  archived:  { bg: 'bg-brand-100',  text: 'text-brand-700' },
};

export const TOR_LIST_STATUS_STYLE: Record<ToRListItem['status'], { bg: string; text: string; labelKey: TranslationKey }> = {
  draft:     { bg: 'bg-gray-100',   text: 'text-ink-soft',   labelKey: 'tor.status.draft' },
  review:    { bg: 'bg-amber-100',  text: 'text-amber-800',  labelKey: 'tor.status.review' },
  approved:  { bg: 'bg-green-100',  text: 'text-green-800',  labelKey: 'tor.status.approved' },
  published: { bg: 'bg-brand-100',  text: 'text-brand-700',  labelKey: 'tor.status.published' },
};

export function mockTorDraft(id: string, stored?: ToRDraft | null): ToRDraft {
  return stored ?? MOCK_TOR_DRAFTS[id] ?? {
    id,
    title: `ToR ${id}`,
    status: 'draft',
    body_markdown: null,
    compliance_checklist: {},
    created_at: new Date().toISOString(),
  };
}

export function runBriefChecklist(brief: ToRBrief): ToRDraft['compliance_checklist'] {
  return {
    has_scope:              brief.scope.trim().length > 30 ? 'passed' : 'failed',
    has_budget:             brief.budget_minor > 0 ? 'passed' : 'failed',
    has_deliverables:       brief.deliverables.length > 0 ? 'passed' : 'failed',
    has_evaluation_method:  brief.evaluation_method ? 'passed' : 'failed',
    has_timeline:           !!(brief.timeline?.start && brief.timeline?.end) ? 'passed' : 'failed',
    has_qualifications:     brief.procurement_kind === 'construction'
      ? ((brief.qualifications?.length ?? 0) > 0 ? 'passed' : 'failed')
      : 'na',
  };
}

/** Scan markdown body for compliance signals (used after inline edits). */
export function scanChecklistFromBody(
  body: string,
  options?: { procurementKind?: ToRBrief['procurement_kind'] },
): ToRDraft['compliance_checklist'] {
  const trimmed = body.trim();
  return {
    has_scope: (trimmed.length > 80 || (/ขอบเขต|scope/i.test(trimmed) && trimmed.length > 30))
      ? 'passed' : 'failed',
    has_budget: /งบประมาณ|ราคากลาง|วงเงิน|budget|THB|บาท/i.test(trimmed) || /\d{1,3}(,\d{3})+/.test(trimmed)
      ? 'passed' : 'failed',
    has_deliverables: /ส่งมอบ|deliverable|รายการ|^\s*[-*•]/m.test(trimmed)
      ? 'passed' : 'failed',
    has_evaluation_method: /เกณฑ์การพิจารณา|evaluation|ราคาต่ำสุด|most.advantageous|lowest.price/i.test(trimmed)
      ? 'passed' : 'failed',
    has_timeline: /ระยะเวลา|timeline|เดือน|วัน|start|end/i.test(trimmed) || /\d{4}-\d{2}-\d{2}/.test(trimmed)
      ? 'passed' : 'failed',
    has_qualifications: options?.procurementKind === 'construction'
      ? (/คุณสมบัติ|qualification/i.test(trimmed) ? 'passed' : 'failed')
      : 'na',
  };
}

/** Re-evaluate checklist items from edited body markdown (preserves `na` rows). */
export function patchChecklistFromBody(
  checklist: ToRDraft['compliance_checklist'],
  body: string,
  options?: { procurementKind?: ToRBrief['procurement_kind'] },
): ToRDraft['compliance_checklist'] {
  const scanned = scanChecklistFromBody(body, options);
  const next: ToRDraft['compliance_checklist'] = { ...checklist };

  for (const key of Object.keys(scanned) as Array<keyof typeof scanned>) {
    const current = next[key];
    const fresh = scanned[key];
    if (fresh === 'na') continue;
    if (current === 'na' && key !== 'has_qualifications') continue;
    if (key === 'has_qualifications' && current === 'na' && options?.procurementKind !== 'construction') {
      continue;
    }
    next[key] = fresh;
  }
  return next;
}

export function sortTorList(rows: ToRListItem[]): ToRListItem[] {
  return [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
