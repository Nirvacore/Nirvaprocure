import type { AiRunSummary, AnalyticsSummary, SupplierRiskRow } from './api';

export function loadHomeSummary(): AnalyticsSummary {
  return {
    month_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    pr_counts: { in_approval: 3, approved: 8, rejected: 1, draft: 2 },
    approved_spend_minor: 4_829_000, avg_approval_hours: 19.3, top_suppliers: [], by_department: [],
  };
}

export function loadAnalyticsSummary(): AnalyticsSummary {
  return {
    ...loadHomeSummary(),
    top_suppliers: [
      { name: 'HP Authorized Store', spend_minor: 1_512_000, po_count: 3 },
      { name: 'Makro คลังกลางบางพลี', spend_minor: 780_000, po_count: 2 },
      { name: 'Lazada Mall Office Supply', spend_minor: 640_000, po_count: 1 },
    ],
    by_department: [
      { department: 'การเงิน', spend_minor: 1_812_000, pr_count: 4 }, { department: 'ไอที', spend_minor: 1_540_000, pr_count: 2 },
      { department: 'การตลาด', spend_minor: 980_000, pr_count: 3 }, { department: 'บริหาร', spend_minor: 497_000, pr_count: 1 },
    ],
  };
}

export function loadAnalyticsAiSummary(): AiRunSummary { return { total_cost_usd: 0.42, total_tokens: 1200, calls: 3 }; }
export function loadAnalyticsRisks(): SupplierRiskRow[] {
  return [
    { supplier_id: 'sup-4', supplier_name: 'Global Tech Import Co.', score: 76, tier: 'high', factors: { spend_minor: 840000_00, spend_pct: 35, price_cov: 31, rejection_rate: 18, has_coi: true, anomaly_count_90d: 2 }, computed_at: '2026-06-01' },
    { supplier_id: 'sup-3', supplier_name: 'ร้านเครื่องเขียนสยาม', score: 48, tier: 'medium', factors: { spend_minor: 24000_00, spend_pct: 5, price_cov: 22, rejection_rate: 8, has_coi: false, anomaly_count_90d: 1 }, computed_at: '2026-06-01' },
    { supplier_id: 'sup-1', supplier_name: 'HP Authorized Store Thailand', score: 18, tier: 'low', factors: { spend_minor: 180000_00, spend_pct: 12, price_cov: 8, rejection_rate: 2, has_coi: false, anomaly_count_90d: 0 }, computed_at: '2026-06-01' },
  ];
}
