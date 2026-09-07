import type { PrDetail, PrSummary } from './api';

type ReceiveDetail = Omit<PrDetail, 'items'> & {
  items: Array<PrDetail['items'][number] & { item_id?: string | null }>;
};

export async function loadDemoApprovedPrs(): Promise<PrSummary[]> {
  const { mockPrs } = await import('./mock-data');
  return mockPrs
    .filter((pr) => pr.status === 'approved')
    .map((pr) => ({
      id: pr.id,
      pr_number: pr.pr_number,
      title: pr.title,
      status: pr.status,
      requester_id: 'user-1',
      department_id: 'dept-1',
      total: { amount_minor: pr.total_minor, currency: 'THB' },
      submitted_at: '2026-06-01',
      created_at: pr.created_at,
    }));
}

export async function loadDemoDetail(id: string): Promise<ReceiveDetail> {
  const { mockPrs } = await import('./mock-data');
  const summary = (pr: typeof mockPrs[number]): PrSummary => ({
    id: pr.id,
    pr_number: pr.pr_number,
    title: pr.title,
    status: pr.status,
    requester_id: 'user-1',
    department_id: 'dept-1',
    total: { amount_minor: pr.total_minor, currency: 'THB' },
    submitted_at: '2026-06-01',
    created_at: pr.created_at,
  });
  const approved = mockPrs.find((pr) => pr.id === '2')!;
  const fallback: ReceiveDetail = {
    ...summary(approved),
    id: '2',
    pr_number: 'PR-2026-0041',
    title: 'ถุงมือแล็บ x 200 คู่',
    justification: 'เติมถุงมือแล็บประจำไตรมาส',
    items: [
      { id: 'li-2-1', line_no: 1, description: 'ถุงมือแล็บ ขนาด M', quantity: 200, unit: 'pair', unit_price_minor: 94500, line_total_minor: 18900000, supplier_id: null, source: 'makro', source_url: null, item_id: 'i2' },
    ],
    approval: null,
  };
  if (id === '5') {
    return {
      id: '5', pr_number: 'PR-2026-0038', title: 'ของกินทีม Q1', status: 'approved',
      requester_id: 'user-2', department_id: 'dept-2', total: { amount_minor: 250000, currency: 'THB' },
      submitted_at: '2026-05-25', created_at: '5 วัน', justification: 'ของว่างทีมประจำไตรมาส',
      items: [
        { id: 'li-5-1', line_no: 1, description: 'ขนมและเครื่องดื่มทีม', quantity: 1, unit: 'lot', unit_price_minor: 25000000, line_total_minor: 25000000, supplier_id: null, source: 'manual', source_url: null, item_id: 'i-snack' },
      ],
      approval: null,
    };
  }
  return id === '2' ? fallback : { ...fallback, id };
}
