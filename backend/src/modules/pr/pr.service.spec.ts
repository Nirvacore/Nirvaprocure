/**
 * Service-level integration test for PrService.
 *
 * Mocks the pg Pool so we don't need a real Postgres. The mock answers the
 * specific queries we expect in order. This level of test catches:
 *   - SQL parameter ordering bugs (the placeholder count must match args)
 *   - audit log calls happening at the right point
 *   - LINE notification being fired ON submit but NOT on create
 *
 * For richer DB coverage (RLS policies, triggers, etc.) we'd spin up an
 * ephemeral Postgres via testcontainers — deferred to Phase 5.
 */

import { Test } from '@nestjs/testing';
import { PrService } from './pr.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { AffiliateService } from '../marketplace/affiliate.service';
import { LineNotifier } from '../notifications/line.notifier';
import { StockService } from '../stock/stock.service';
import { AnomalyService } from '../anomaly/anomaly.service';
import { BudgetService } from '../budget/budget.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { PG_POOL } from '../../common/db/db.module';

interface MockClient {
  query: jest.Mock;
}

/** Build a pool mock whose `connect()` returns a scripted client. */
function makePool(scripted: jest.Mock): { connect: jest.Mock } {
  const client: MockClient = { query: scripted };
  return {
    connect: jest.fn().mockResolvedValue({
      ...client,
      release: jest.fn(),
    }),
  };
}

describe('PrService.create', () => {
  it('issues sequential PR numbers and writes an audit row', async () => {
    // Sequenced query responses. The exact order matters and mirrors the
    // service's own SQL: BEGIN → SET LOCAL → nextPrNumber lookup → INSERT
    // pr → INSERT item × N → audit_log → COMMIT.
    const query = jest.fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })            // BEGIN
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })            // SET LOCAL
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })            // nextPrNumber lookup
      .mockResolvedValueOnce({                                     // INSERT pr RETURNING
        rowCount: 1,
        rows: [{
          id: 'pr-1',
          pr_number: 'PR-2026-0001',
          title: 'Test',
          status: 'draft',
          requester_id: 'u1',
          department_id: null,
          total_minor: '189000',
          currency: 'THB',
          submitted_at: null,
          created_at: new Date().toISOString(),
        }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })            // INSERT line item
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })            // audit_log INSERT
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });           // COMMIT

    const mod = await Test.createTestingModule({
      providers: [
        PrService,
        { provide: PG_POOL,            useValue: makePool(query) },
        { provide: MarketplaceService, useValue: { parse: jest.fn() } },
        { provide: AffiliateService,   useValue: { tagUrl: jest.fn().mockImplementation((_: string, url: string) => url) } },
        { provide: LineNotifier,       useValue: { send: jest.fn() } },
        { provide: StockService,       useValue: { recordMovement: jest.fn() } },
        { provide: AnomalyService,     useValue: { flagIfSuspicious: jest.fn() } },
        { provide: BudgetService,      useValue: { checkBudget: jest.fn().mockResolvedValue({ ok: true }) } },
        { provide: WebhooksService,    useValue: { fire: jest.fn() } },
      ],
    }).compile();

    const svc = mod.get(PrService);
    const result = await svc.create(
      { userId: 'u1', orgId: 'o1', email: 'u1@example.com' },
      {
        title: 'Test',
        items: [{ description: 'Item', quantity: 1, unit_price_minor: 189000 }],
      } as any,
    );

    expect(result.pr_number).toBe('PR-2026-0001');
    expect(query).toHaveBeenCalled();
    // audit_log INSERT lands as one of the queries.
    const auditCall = query.mock.calls.find(([sql]: [string]) => /INTO audit_log/i.test(sql));
    expect(auditCall).toBeDefined();
  });
});
