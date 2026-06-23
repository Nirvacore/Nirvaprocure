import { describe, expect, it } from 'vitest';
import { MOCK_TOR_DRAFTS, patchChecklistFromBody, scanChecklistFromBody, sortTorList } from './tor-shared';

describe('scanChecklistFromBody', () => {
  it('detects timeline keywords in markdown', () => {
    const result = scanChecklistFromBody('## ระยะเวลาดำเนินการ\n12 เดือน (2026-01-01 ถึง 2026-12-31)');
    expect(result.has_timeline).toBe('passed');
  });

  it('flags missing budget section', () => {
    const result = scanChecklistFromBody('## ขอบเขต\nสั้น');
    expect(result.has_budget).toBe('failed');
  });
});

describe('patchChecklistFromBody', () => {
  it('updates has_timeline while preserving na qualifications for goods', () => {
    const base = MOCK_TOR_DRAFTS['tor-1'].compliance_checklist;
    const patched = patchChecklistFromBody(
      base,
      `${MOCK_TOR_DRAFTS['tor-1'].body_markdown}\n\n## ระยะเวลา\n12 เดือน`,
      { procurementKind: 'goods' },
    );
    expect(patched.has_timeline).toBe('passed');
    expect(patched.has_qualifications).toBe('na');
  });

  it('re-evaluates construction qualifications when kind is construction', () => {
    const base = { ...MOCK_TOR_DRAFTS['tor-3'].compliance_checklist, has_qualifications: 'failed' as const };
    const patched = patchChecklistFromBody(
      base,
      '## ขอบเขต\nก่อสร้าง\n## คุณสมบัติผู้ยื่นข้อเสนอ\nมีใบอนุญาต',
      { procurementKind: 'construction' },
    );
    expect(patched.has_qualifications).toBe('passed');
  });
});

describe('sortTorList', () => {
  it('orders by created_at descending', () => {
    const sorted = sortTorList([
      { id: 'a', title: 'old', procurement_kind: 'goods', status: 'draft', created_at: '2026-01-01T00:00:00Z' },
      { id: 'b', title: 'new', procurement_kind: 'goods', status: 'draft', created_at: '2026-06-01T00:00:00Z' },
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['b', 'a']);
  });
});
