import type { PrSummary, SupplierRow } from './api';

export async function loadSearchDemo(): Promise<{ prs: PrSummary[]; suppliers: SupplierRow[] }> {
  const { mockPrs } = await import('./mock-data');
  return {
    prs: mockPrs.map((p) => ({ id: p.id, pr_number: p.pr_number, title: p.title, status: p.status, requester_id: 'user-1', department_id: 'dept-1', total: { amount_minor: p.total_minor, currency: 'THB' }, submitted_at: '2026-06-01', created_at: p.created_at })),
    suppliers: [
      { id: 'sup-1', code: 'SUP-001', name: 'HP Authorized Store Thailand', contact_name: 'คุณวิภา', contact_email: 'sales@hp-th.co.th', contact_phone: '02-111-2222', category: 'IT', tax_id: '0105555000001', is_active: true, risk_tier: 'low', total_pr_count: 12, total_spent_minor: 180000_00, created_at: '2026-01-10' },
      { id: 'sup-2', code: 'SUP-002', name: 'บริษัท แม็คโคร จำกัด', contact_name: 'คุณสมชาย', contact_email: 'b2b@makro.co.th', contact_phone: '02-222-3333', category: 'อาหาร', tax_id: '0105555000002', is_active: true, risk_tier: 'low', total_pr_count: 28, total_spent_minor: 540000_00, created_at: '2026-01-05' },
      { id: 'sup-3', code: 'SUP-003', name: 'ร้านเครื่องเขียนสยาม', contact_name: null, contact_email: null, contact_phone: '02-333-4444', category: 'สำนักงาน', tax_id: null, is_active: true, risk_tier: 'medium', total_pr_count: 5, total_spent_minor: 24000_00, created_at: '2026-02-01' },
    ],
  };
}
