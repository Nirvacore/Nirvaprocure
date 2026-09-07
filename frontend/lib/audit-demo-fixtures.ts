import type { AuditRow } from './api';

export type AuditDemoPage = { data: AuditRow[]; next_cursor: string | null };

const firstPage: AuditDemoPage = {
  data: [
    { id: 1, action: 'pr.create', entity_type: 'purchase_request', entity_id: '1', actor_user_id: 'u1', actor_name: 'สุดา จันทร์', created_at: '2026-06-07T10:21:00Z', diff: { title: 'หมึกเครื่องพิมพ์ ชั้น 5' } },
    { id: 2, action: 'pr.submit', entity_type: 'purchase_request', entity_id: '1', actor_user_id: 'u1', actor_name: 'สุดา จันทร์', created_at: '2026-06-07T10:22:00Z', diff: null },
    { id: 3, action: 'approval.decide', entity_type: 'approval_instance', entity_id: 'ai-1', actor_user_id: 'u2', actor_name: 'ปอ นวลรัตน์', created_at: '2026-06-07T14:00:00Z', diff: { decision: 'approved' } },
    { id: 4, action: 'workflow.update', entity_type: 'workflow', entity_id: 'wf-1', actor_user_id: 'u3', actor_name: 'Admin', created_at: '2026-06-06T09:00:00Z', diff: { min_amount_minor: 50000 } },
    { id: 5, action: 'user.login', entity_type: 'user', entity_id: 'u2', actor_user_id: 'u2', actor_name: 'ปอ นวลรัตน์', created_at: '2026-06-06T08:30:00Z', diff: { ip: '203.150.1.1' } },
  ],
  next_cursor: 'audit-mock-2',
};

const secondPage: AuditDemoPage = {
  data: [
    { id: 6, action: 'po.create', entity_type: 'purchase_order', entity_id: 'po-1', actor_user_id: 'u1', actor_name: 'สุดา จันทร์', created_at: '2026-06-05T16:00:00Z', diff: { po_number: 'PO-2026-0016' } },
    { id: 7, action: 'supplier.update', entity_type: 'supplier', entity_id: 'sup-1', actor_user_id: 'u3', actor_name: 'Admin', created_at: '2026-06-05T10:00:00Z', diff: { is_active: true } },
  ],
  next_cursor: null,
};

function clonePage(page: AuditDemoPage): AuditDemoPage {
  return { data: page.data.map((row) => ({ ...row })), next_cursor: page.next_cursor };
}

export function loadDemoAuditPage(entity: string | null): AuditDemoPage {
  if (entity) return { data: firstPage.data.filter((row) => row.entity_type === entity), next_cursor: null };
  return { data: firstPage.data.slice(0, 3), next_cursor: firstPage.next_cursor };
}

export function loadDemoAuditPageByCursor(cursor: string): AuditDemoPage {
  return cursor === 'audit-mock-2' ? clonePage(secondPage) : { data: [], next_cursor: null };
}
