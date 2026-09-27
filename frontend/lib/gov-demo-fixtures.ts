import type { ToRBrief, ToRDraft, ToRListItem, ToRTemplate } from './api';
import {
  advanceMockTorDraft,
  mergeMockTorList,
  readMockTorDraft,
  updateMockTorDraftBody,
} from './tor-mock-store';

const demoTorList: ToRListItem[] = [
  { id: 'tor-1', title: 'จัดซื้อเครื่องคอมพิวเตอร์ จำนวน 20 เครื่อง', procurement_kind: 'goods', status: 'draft', created_at: '2026-06-10T09:00:00Z' },
  { id: 'tor-2', title: 'จ้างเหมาบำรุงรักษาระบบเครือข่าย', procurement_kind: 'services', status: 'approved', created_at: '2026-06-05T14:30:00Z' },
  { id: 'tor-3', title: 'ก่อสร้างอาคารคลังสินค้า', procurement_kind: 'construction', status: 'published', created_at: '2026-05-28T11:00:00Z' },
];

const demoTemplates: ToRTemplate[] = [
  { id: 'tpl-goods', name: 'จัดซื้อครุภัณฑ์ทั่วไป', procurement_kind: 'goods', is_official: true },
  { id: 'tpl-services', name: 'จ้างเหมาบริการมาตรฐาน', procurement_kind: 'services', is_official: true },
  { id: 'tpl-construction', name: 'งานก่อสร้างขนาดเล็ก', procurement_kind: 'construction', is_official: false },
];

const demoDrafts: Record<string, ToRDraft> = {
  'tor-1': {
    id: 'tor-1', title: 'จัดซื้อเครื่องคอมพิวเตอร์ จำนวน 20 เครื่อง', status: 'draft',
    body_markdown: ['## ๑. ความเป็นมา', 'หน่วยงานมีความจำเป็นต้องจัดซื้อเครื่องคอมพิวเตอร์เพื่อทดแทนอุปกรณ์เดิม', '', '## ๒. วัตถุประสงค์', 'เพื่อสนับสนุนการปฏิบัติงานของเจ้าหน้าที่'].join('\n'),
    compliance_checklist: { has_scope: 'passed', has_budget: 'passed', has_deliverables: 'passed', has_evaluation_method: 'passed', has_timeline: 'failed', has_qualifications: 'na' },
    created_at: '2026-06-10T09:00:00Z',
  },
  'tor-2': {
    id: 'tor-2', title: 'จ้างเหมาบำรุงรักษาระบบเครือข่าย', status: 'approved',
    body_markdown: '## ขอบเขตของงาน\nบำรุงรักษาระบบเครือข่ายภายในหน่วยงานเป็นระยะเวลา 12 เดือน',
    compliance_checklist: { has_scope: 'passed', has_budget: 'passed', has_deliverables: 'passed', has_evaluation_method: 'passed', has_timeline: 'passed', has_qualifications: 'na' },
    created_at: '2026-06-05T14:30:00Z',
  },
  'tor-3': {
    id: 'tor-3', title: 'ก่อสร้างอาคารคลังสินค้า', status: 'archived',
    body_markdown: '## ขอบเขตของงาน\nก่อสร้างอาคารคลังสินค้าขนาด 500 ตร.ม.',
    compliance_checklist: { has_scope: 'passed', has_budget: 'passed', has_deliverables: 'passed', has_evaluation_method: 'passed', has_timeline: 'passed', has_qualifications: 'passed' },
    created_at: '2026-05-28T11:00:00Z',
  },
};

export function loadDemoTorList(): ToRListItem[] {
  return mergeMockTorList(demoTorList.map((row) => ({ ...row })));
}

export function loadDemoTorTemplates(): ToRTemplate[] {
  return demoTemplates.map((template) => ({ ...template }));
}

export function loadDemoTorDraft(id: string): ToRDraft {
  return readMockTorDraft(id) ?? demoDrafts[id] ?? {
    id,
    title: `ToR ${id}`,
    status: 'draft',
    body_markdown: null,
    compliance_checklist: {},
    created_at: new Date().toISOString(),
  };
}

export function advanceDemoTorDraft(id: string): ToRDraft {
  return advanceMockTorDraft(id, loadDemoTorDraft(id));
}

export function updateDemoTorDraftBody(id: string, body: string): ToRDraft {
  return updateMockTorDraftBody(id, loadDemoTorDraft(id), body);
}
