/**
 * Unit tests for PrPdfService.
 *
 * The service fetches PR data from Postgres (via withOrg), then renders a
 * multi-section PDF using PDFKit. We test:
 *   - Data assembly from DB queries (PR, items, trail, locale)
 *   - NotFoundException when PR doesn't exist
 *   - PDF output piped to the sink stream
 *   - Locale resolution (caller > requester > default)
 *   - fmtBaht formatting
 *   - Handling of missing optional fields (department, justification, etc.)
 *
 * PDFKit is mocked to avoid real PDF rendering. DB access is mocked via the
 * standard mockPool pattern.
 */

import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PassThrough } from 'stream';
import { PrPdfService } from './pr-pdf.service';
import { PG_POOL } from '../../common/db/db.module';

// ── Mock PDFKit ─────────────────────────────────────────────────────────────

const mockDoc = {
  fontSize:      jest.fn().mockReturnThis(),
  fillColor:     jest.fn().mockReturnThis(),
  strokeColor:   jest.fn().mockReturnThis(),
  lineWidth:     jest.fn().mockReturnThis(),
  text:          jest.fn().mockReturnThis(),
  moveDown:      jest.fn().mockReturnThis(),
  moveTo:        jest.fn().mockReturnThis(),
  lineTo:        jest.fn().mockReturnThis(),
  stroke:        jest.fn().mockReturnThis(),
  pipe:          jest.fn().mockReturnThis(),
  end:           jest.fn(),
  registerFont:  jest.fn(),
  font:          jest.fn().mockReturnThis(),
  y:             100,
  info:          {} as Record<string, string>,
};

jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => mockDoc);
});

// ── Mock helpers ────────────────────────────────────────────────────────────

interface MockClient {
  query: jest.Mock;
  release: jest.Mock;
}

function mockPool(queryResponses: any[]) {
  let callIdx = 0;
  const mockClient: MockClient = {
    query: jest.fn().mockImplementation(() => {
      const resp = queryResponses[callIdx] ?? { rows: [], rowCount: 0 };
      callIdx++;
      return Promise.resolve(resp);
    }),
    release: jest.fn(),
  };
  return { connect: jest.fn().mockResolvedValue(mockClient), client: mockClient };
}

function samplePrRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pr-001',
    pr_number: 'PR-2026-0001',
    title: 'Office Supplies',
    status: 'approved',
    requester_id: 'u-req',
    requester_name: 'Somchai K.',
    requester_locale: 'th',
    department_id: 'dept-1',
    department_name: 'Procurement',
    org_id: 'org-1',
    org_name: 'Acme Thai Co.',
    total_minor: 245000,
    submitted_at: '2026-06-10T09:00:00Z',
    justification: 'Quarterly restock',
    ...overrides,
  };
}

function sampleItems() {
  return [
    { line_no: 1, description: 'Paper A4', quantity: 10, unit: 'ream', unit_price_minor: 15000, line_total_minor: 150000 },
    { line_no: 2, description: 'Pens',     quantity: 50, unit: 'pc',   unit_price_minor: 1900,  line_total_minor: 95000 },
  ];
}

function sampleTrail() {
  return [
    { step_no: 1, decision: 'approved', comment: 'LGTM', decided_at: '2026-06-11T10:00:00Z', approver_name: 'Manager A' },
  ];
}

/**
 * Build a standard set of query responses for the withOrg + PR queries.
 *
 * withOrg issues: BEGIN, SET LOCAL, then the service runs its queries, then COMMIT.
 * Inside withOrg(fn), the service runs 4 queries:
 *   1. SELECT pr (with joins)
 *   2. SELECT items
 *   3. SELECT approval trail
 *   4. SELECT caller locale
 */
function standardQueryResponses(opts: {
  pr?: Record<string, unknown>;
  items?: any[];
  trail?: any[];
  callerLocale?: string | null;
} = {}) {
  return [
    { rows: [], rowCount: 0 },                                          // BEGIN
    { rows: [], rowCount: 0 },                                          // SET LOCAL
    { rows: [samplePrRow(opts.pr ?? {})], rowCount: 1 },                // SELECT pr
    { rows: opts.items ?? sampleItems(), rowCount: (opts.items ?? sampleItems()).length },  // SELECT items
    { rows: opts.trail ?? sampleTrail(), rowCount: (opts.trail ?? sampleTrail()).length },  // SELECT trail
    { rows: [{ preferred_locale: opts.callerLocale ?? 'th' }], rowCount: 1 },              // SELECT caller locale
    { rows: [], rowCount: 0 },                                          // COMMIT
  ];
}

const testUser = { userId: 'u-caller', orgId: 'org-1', email: 'caller@acme.th' };

// ── Tests ───────────────────────────────────────────────────────────────────

describe('PrPdfService', () => {
  let service: PrPdfService;
  let pool: ReturnType<typeof mockPool>;

  beforeEach(async () => {
    // Reset PDFKit mock state between tests
    Object.values(mockDoc).forEach((fn) => {
      if (typeof fn === 'function') (fn as jest.Mock).mockClear?.();
    });
    mockDoc.y = 100;
    mockDoc.info = {};
    // Re-apply return-this chaining after clear
    for (const key of [
      'fontSize', 'fillColor', 'strokeColor', 'lineWidth', 'text',
      'moveDown', 'moveTo', 'lineTo', 'stroke', 'pipe', 'font',
    ] as const) {
      (mockDoc as any)[key].mockReturnThis();
    }
  });

  function buildModule(queryResponses: any[]) {
    pool = mockPool(queryResponses);
    return Test.createTestingModule({
      providers: [
        PrPdfService,
        { provide: PG_POOL, useValue: pool },
      ],
    }).compile();
  }

  // ── Successful render ─────────────────────────────────────────────────

  it('renders a PDF and pipes to the sink', async () => {
    const mod = await buildModule(standardQueryResponses());
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(testUser, 'pr-001', sink);

    // PDFKit doc.pipe should have been called with our sink
    expect(mockDoc.pipe).toHaveBeenCalledWith(sink);
    // doc.end() must be called to finalize the PDF
    expect(mockDoc.end).toHaveBeenCalled();
  });

  it('includes the PR number and title in the PDF text calls', async () => {
    const mod = await buildModule(standardQueryResponses());
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(testUser, 'pr-001', sink);

    // doc.text should have been called with the PR number
    const textCalls = mockDoc.text.mock.calls.map(([txt]: [string]) => String(txt));
    expect(textCalls).toContain('PR-2026-0001');
    expect(textCalls).toContain('Office Supplies');
  });

  it('renders line items from the query', async () => {
    const mod = await buildModule(standardQueryResponses());
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(testUser, 'pr-001', sink);

    const textCalls = mockDoc.text.mock.calls.map(([txt]: [string]) => String(txt));
    expect(textCalls).toContain('Paper A4');
    expect(textCalls).toContain('Pens');
  });

  it('renders the approval trail', async () => {
    const mod = await buildModule(standardQueryResponses());
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(testUser, 'pr-001', sink);

    const textCalls = mockDoc.text.mock.calls.map(([txt]: [string]) => String(txt));
    // Should contain the approver name somewhere in the trail output
    const trailLine = textCalls.find((t: string) => t.includes('Manager A'));
    expect(trailLine).toBeDefined();
    expect(trailLine).toContain('APPROVED');
  });

  // ── NotFoundException ─────────────────────────────────────────────────

  it('throws NotFoundException when PR is not found', async () => {
    const responses = [
      { rows: [], rowCount: 0 },   // BEGIN
      { rows: [], rowCount: 0 },   // SET LOCAL
      { rows: [], rowCount: 0 },   // SELECT pr — empty!
      // withOrg will ROLLBACK on exception
      { rows: [], rowCount: 0 },   // ROLLBACK
    ];
    const mod = await buildModule(responses);
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await expect(service.render(testUser, 'pr-nonexistent', sink)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── Justification section ─────────────────────────────────────────────

  it('renders justification when present', async () => {
    const mod = await buildModule(standardQueryResponses({ pr: { justification: 'Urgent restock needed' } }));
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(testUser, 'pr-001', sink);

    const textCalls = mockDoc.text.mock.calls.map(([txt]: [string]) => String(txt));
    expect(textCalls).toContain('Urgent restock needed');
  });

  it('skips justification section when null', async () => {
    const mod = await buildModule(standardQueryResponses({ pr: { justification: null } }));
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(testUser, 'pr-001', sink);

    const textCalls = mockDoc.text.mock.calls.map(([txt]: [string]) => String(txt));
    // The justification label should not appear since there's no justification
    // (we can't check the exact Thai label, but 'Quarterly restock' from default shouldn't appear)
    expect(textCalls).not.toContain('Quarterly restock');
  });

  // ── No approval trail ─────────────────────────────────────────────────

  it('shows no-decisions text when trail is empty', async () => {
    const mod = await buildModule(standardQueryResponses({ trail: [] }));
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(testUser, 'pr-001', sink);

    // doc.text should have been called; with empty trail, it should NOT
    // contain any approver names
    const textCalls = mockDoc.text.mock.calls.map(([txt]: [string]) => String(txt));
    expect(textCalls.find((t: string) => t.includes('Manager A'))).toBeUndefined();
  });

  // ── Department not set ────────────────────────────────────────────────

  it('handles missing department gracefully', async () => {
    const mod = await buildModule(
      standardQueryResponses({ pr: { department_id: null, department_name: null } }),
    );
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    // Should not throw
    await expect(service.render(testUser, 'pr-001', sink)).resolves.toBeUndefined();
    expect(mockDoc.end).toHaveBeenCalled();
  });

  // ── Locale resolution ─────────────────────────────────────────────────

  it('uses caller locale when available', async () => {
    const mod = await buildModule(
      standardQueryResponses({ callerLocale: 'en', pr: { requester_locale: 'th' } }),
    );
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(testUser, 'pr-001', sink);

    // Verify it didn't throw — locale resolution is internal,
    // but we ensure render completes successfully with 'en' locale
    expect(mockDoc.end).toHaveBeenCalled();
  });

  it('falls back to requester locale when caller has none', async () => {
    const mod = await buildModule(
      standardQueryResponses({ callerLocale: null, pr: { requester_locale: 'en' } }),
    );
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(testUser, 'pr-001', sink);
    expect(mockDoc.end).toHaveBeenCalled();
  });

  // ── Thai font fallback ────────────────────────────────────────────────

  it('marks missing Thai font in document metadata', async () => {
    // Make registerFont throw (font not found)
    mockDoc.registerFont.mockImplementation(() => { throw new Error('ENOENT'); });

    const mod = await buildModule(standardQueryResponses());
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(testUser, 'pr-001', sink);

    expect(mockDoc.info.Subject).toContain('Thai font missing');
  });

  it('does NOT set warning subject when Thai font loads successfully', async () => {
    mockDoc.registerFont.mockImplementation(() => {});

    const mod = await buildModule(standardQueryResponses());
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(testUser, 'pr-001', sink);

    expect(mockDoc.info.Subject).toBeUndefined();
  });

  // ── Multiple approval steps ───────────────────────────────────────────

  it('renders multiple approval steps in order', async () => {
    const trail = [
      { step_no: 1, decision: 'approved', comment: null,       decided_at: '2026-06-11T10:00:00Z', approver_name: 'Lead A' },
      { step_no: 2, decision: 'approved', comment: 'OK budget', decided_at: '2026-06-11T14:00:00Z', approver_name: 'Manager B' },
      { step_no: 3, decision: 'rejected', comment: 'Over budget', decided_at: '2026-06-12T09:00:00Z', approver_name: 'Director C' },
    ];
    const mod = await buildModule(standardQueryResponses({ trail }));
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(testUser, 'pr-001', sink);

    const textCalls = mockDoc.text.mock.calls.map(([txt]: [string]) => String(txt));
    expect(textCalls.find((t: string) => t.includes('Lead A'))).toBeDefined();
    expect(textCalls.find((t: string) => t.includes('Manager B'))).toBeDefined();
    expect(textCalls.find((t: string) => t.includes('Director C'))).toBeDefined();
    expect(textCalls.find((t: string) => t.includes('REJECTED'))).toBeDefined();
    // Comment should appear for step 2 and 3
    expect(textCalls.find((t: string) => t.includes('OK budget'))).toBeDefined();
    expect(textCalls.find((t: string) => t.includes('Over budget'))).toBeDefined();
  });

  // ── Org name fallback ─────────────────────────────────────────────────

  it('falls back to NIRVAPROCURE when org_name is null', async () => {
    const mod = await buildModule(standardQueryResponses({ pr: { org_name: null } }));
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(testUser, 'pr-001', sink);

    const textCalls = mockDoc.text.mock.calls.map(([txt]: [string]) => String(txt));
    expect(textCalls).toContain('NIRVAPROCURE');
  });

  // ── DB transaction lifecycle ──────────────────────────────────────────

  it('releases the DB client after successful render', async () => {
    pool = mockPool(standardQueryResponses());
    const mod = await Test.createTestingModule({
      providers: [
        PrPdfService,
        { provide: PG_POOL, useValue: pool },
      ],
    }).compile();
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(testUser, 'pr-001', sink);

    expect(pool.client.release).toHaveBeenCalled();
  });

  it('releases the DB client even when PR is not found', async () => {
    const responses = [
      { rows: [], rowCount: 0 },   // BEGIN
      { rows: [], rowCount: 0 },   // SET LOCAL
      { rows: [], rowCount: 0 },   // SELECT pr — empty
      { rows: [], rowCount: 0 },   // ROLLBACK
    ];
    pool = mockPool(responses);
    const mod = await Test.createTestingModule({
      providers: [
        PrPdfService,
        { provide: PG_POOL, useValue: pool },
      ],
    }).compile();
    service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(testUser, 'pr-001', sink).catch(() => {});

    expect(pool.client.release).toHaveBeenCalled();
  });
});

// ── fmtBaht (module-private, tested indirectly) ─────────────────────────

describe('fmtBaht formatting (via PDF rendering)', () => {
  beforeEach(() => {
    Object.values(mockDoc).forEach((fn) => {
      if (typeof fn === 'function') (fn as jest.Mock).mockClear?.();
    });
    mockDoc.y = 100;
    mockDoc.info = {};
    for (const key of [
      'fontSize', 'fillColor', 'strokeColor', 'lineWidth', 'text',
      'moveDown', 'moveTo', 'lineTo', 'stroke', 'pipe', 'font',
    ] as const) {
      (mockDoc as any)[key].mockReturnThis();
    }
  });

  it('formats amounts in baht with 2 decimal places', async () => {
    const items = [
      { line_no: 1, description: 'Test', quantity: 1, unit: 'pc', unit_price_minor: 189050, line_total_minor: 189050 },
    ];
    const pool = mockPool([
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [samplePrRow({ total_minor: 189050 })], rowCount: 1 },
      { rows: items, rowCount: 1 },
      { rows: [], rowCount: 0 },           // trail (empty)
      { rows: [{ preferred_locale: 'th' }], rowCount: 1 },
      { rows: [], rowCount: 0 },
    ]);

    const mod = await Test.createTestingModule({
      providers: [
        PrPdfService,
        { provide: PG_POOL, useValue: pool },
      ],
    }).compile();
    const service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(
      { userId: 'u1', orgId: 'org-1', email: 'u1@test.com' },
      'pr-001',
      sink,
    );

    // fmtBaht(189050) => 189050 / 100 => "1,890.50"
    const textCalls = mockDoc.text.mock.calls.map(([txt]: [string]) => String(txt));
    expect(textCalls.find((t: string) => t.includes('1,890.50'))).toBeDefined();
  });

  it('formats zero amount correctly', async () => {
    const items = [
      { line_no: 1, description: 'Free sample', quantity: 1, unit: 'pc', unit_price_minor: 0, line_total_minor: 0 },
    ];
    const pool = mockPool([
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [samplePrRow({ total_minor: 0 })], rowCount: 1 },
      { rows: items, rowCount: 1 },
      { rows: [], rowCount: 0 },
      { rows: [{ preferred_locale: 'th' }], rowCount: 1 },
      { rows: [], rowCount: 0 },
    ]);

    const mod = await Test.createTestingModule({
      providers: [
        PrPdfService,
        { provide: PG_POOL, useValue: pool },
      ],
    }).compile();
    const service = mod.get(PrPdfService);

    const sink = new PassThrough();
    await service.render(
      { userId: 'u1', orgId: 'org-1', email: 'u1@test.com' },
      'pr-001',
      sink,
    );

    // fmtBaht(0) => "0.00"
    const textCalls = mockDoc.text.mock.calls.map(([txt]: [string]) => String(txt));
    expect(textCalls.find((t: string) => t.includes('0.00'))).toBeDefined();
  });
});
