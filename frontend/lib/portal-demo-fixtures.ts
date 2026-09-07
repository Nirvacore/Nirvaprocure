import type { PortalOverview } from './api';

/** Supplier portal preview data, loaded only in explicit local demo mode. */
export function loadDemoPortal(): PortalOverview {
  return {
    supplier_name: 'บริษัท เทค ซัพพลาย จำกัด',
    expires_at: '2026-12-31T23:59:59Z',
    lines: [
      {
        pr_id: 'pr-mock-1',
        pr_number: 'PR-2026-0042',
        pr_title: 'จัดซื้ออุปกรณ์สำนักงาน',
        description: 'เครื่องพิมพ์เลเซอร์ A4',
        quantity: 2,
        unit: 'เครื่อง',
        unit_price_minor: 890_000,
        line_total_minor: 1_780_000,
        status: 'pending',
      },
    ],
  };
}
