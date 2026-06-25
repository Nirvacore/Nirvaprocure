/**
 * Unit tests for ApprovalsService.
 *
 * Covers the inbox query, the decide flow (approve / reject),
 * self-approve block, not-an-approver guard, step advancement,
 * and LINE notification on terminal states.
 */

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PG_POOL } from '../../common/db/db.module';
import { ApprovalsService } from './approvals.service';
import { LineNotifier } from '../notifications/line.notifier';

const OK = { rows: [], rowCount: 0 };

const makePool = (queryFn: jest.Mock) => ({
  connect: jest.fn().mockResolvedValue({
    query: queryFn,
    release: jest.fn(),
  }),
});

function enqueue(query: jest.Mock, response: { rows: unknown[]; rowCount: number }) {
  query.mockResolvedValueOnce(OK);       // BEGIN
  query.mockResolvedValueOnce(OK);       // SET LOCAL
  query.mockResolvedValueOnce(response); // actual query
  query.mockResolvedValueOnce(OK);       // COMMIT
}

const fakeUser = {
  userId: 'u-approver',
  orgId:  'org-1',
  email:  'approver@co.th',
};

const fakeInstance = {
  id: 'inst-1',
  pr_id: 'pr-1',
  workflow_id: 'wf-1',
  current_step: 1,
  status: 'pending',
  requester_id: 'u-requester',
};

describe('ApprovalsService', () => {
  let svc: ApprovalsService;
  let query: jest.Mock;
  let lineSend: jest.Mock;

  beforeEach(async () => {
    query = jest.fn();
    lineSend = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: PG_POOL, useValue: makePool(query) },
        { provide: LineNotifier, useValue: { send: lineSend } },
      ],
    }).compile();
    svc = mod.get(ApprovalsService);
  });

  // ── inbox ─────────────────────────────────────────────────────────────────

  describe('inbox', () => {
    it('returns pending approval items for the user', async () => {
      const row = {
        instance_id: 'inst-1', step_no: 1, waiting_since: '2026-01-01',
        id: 'pr-1', pr_number: 'PR-2026-0001', title: 'Office Supplies',
        status: 'in_approval', requester_id: 'u-requester',
        department_id: 'dept-1', total_minor: '250000', currency: 'THB',
        submitted_at: '2026-01-01', created_at: '2026-01-01',
      };
      enqueue(query, { rows: [row], rowCount: 1 });

      const result = await svc.inbox(fakeUser);
      expect(result).toHaveLength(1);
      expect(result[0].instance_id).toBe('inst-1');
      expect(result[0].pr.pr_number).toBe('PR-2026-0001');
      expect(result[0].pr.total.amount_minor).toBe(250000);
      expect(result[0].pr.total.currency).toBe('THB');
    });

    it('returns empty array when no pending approvals', async () => {
      enqueue(query, { rows: [], rowCount: 0 });
      const result = await svc.inbox(fakeUser);
      expect(result).toEqual([]);
    });
  });

  // ── decide: rejection ─────────────────────────────────────────────────────

  describe('decide — rejection', () => {
    it('rejects a PR and notifies via LINE', async () => {
      // BEGIN, SET LOCAL
      query.mockResolvedValueOnce(OK);
      query.mockResolvedValueOnce(OK);
      // SELECT approval_instance + pr
      query.mockResolvedValueOnce({ rows: [fakeInstance], rowCount: 1 });
      // SELECT approval_steps (user is valid approver)
      query.mockResolvedValueOnce({
        rows: [{ approver_kind: 'user', approver_ref: 'u-approver' }],
        rowCount: 1,
      });
      // INSERT decision
      query.mockResolvedValueOnce(OK);
      // UPDATE approval_instance → rejected
      query.mockResolvedValueOnce(OK);
      // UPDATE purchase_request → rejected
      query.mockResolvedValueOnce(OK);
      // SELECT pr context for LINE notification
      query.mockResolvedValueOnce({
        rows: [{ id: 'pr-1', pr_number: 'PR-2026-0001', title: 'Supplies', requester_id: 'u-requester', approver_name: 'John' }],
        rowCount: 1,
      });
      // COMMIT
      query.mockResolvedValueOnce(OK);

      const result = await svc.decide(fakeUser, 'inst-1', 'rejected', 'Too expensive');
      expect(result).toEqual({ ok: true });
      expect(lineSend).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'u-requester',
          template: 'pr_decided',
        }),
      );
    });
  });

  // ── decide: approval with next step ───────────────────────────────────────

  describe('decide — approval mid-flow', () => {
    it('advances to next step without LINE notification', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [fakeInstance], rowCount: 1 }); // instance
      query.mockResolvedValueOnce({
        rows: [{ approver_kind: 'user', approver_ref: 'u-approver' }],
        rowCount: 1,
      }); // step check
      query.mockResolvedValueOnce(OK); // INSERT decision
      // next step exists
      query.mockResolvedValueOnce({ rows: [{ next_step: 2 }], rowCount: 1 });
      // UPDATE approval_instance current_step
      query.mockResolvedValueOnce(OK);
      // SELECT status (still pending)
      query.mockResolvedValueOnce({ rows: [{ status: 'pending' }], rowCount: 1 });
      // COMMIT
      query.mockResolvedValueOnce(OK);

      const result = await svc.decide(fakeUser, 'inst-1', 'approved');
      expect(result).toEqual({ ok: true });
      // Mid-flow: no LINE notification
      expect(lineSend).not.toHaveBeenCalled();
    });
  });

  // ── decide: final approval ────────────────────────────────────────────────

  describe('decide — final approval', () => {
    it('marks instance approved and sends LINE notification', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [fakeInstance], rowCount: 1 }); // instance
      query.mockResolvedValueOnce({
        rows: [{ approver_kind: 'user', approver_ref: 'u-approver' }],
        rowCount: 1,
      }); // step check
      query.mockResolvedValueOnce(OK); // INSERT decision
      // no next step
      query.mockResolvedValueOnce({ rows: [{ next_step: null }], rowCount: 1 });
      // UPDATE instance → approved
      query.mockResolvedValueOnce(OK);
      // UPDATE PR → approved
      query.mockResolvedValueOnce(OK);
      // SELECT instance status (now approved)
      query.mockResolvedValueOnce({ rows: [{ status: 'approved' }], rowCount: 1 });
      // SELECT PR context for LINE
      query.mockResolvedValueOnce({
        rows: [{ id: 'pr-1', pr_number: 'PR-2026-0001', title: 'Supplies', requester_id: 'u-requester', approver_name: 'John' }],
        rowCount: 1,
      });
      // COMMIT
      query.mockResolvedValueOnce(OK);

      const result = await svc.decide(fakeUser, 'inst-1', 'approved');
      expect(result).toEqual({ ok: true });
      expect(lineSend).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'pr_decided',
          payload: expect.objectContaining({ decision: 'approved' }),
        }),
      );
    });
  });

  // ── decide: error cases ───────────────────────────────────────────────────

  describe('decide — error cases', () => {
    it('throws NotFoundException when instance does not exist', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // instance not found
      query.mockResolvedValueOnce(OK); // ROLLBACK

      await expect(svc.decide(fakeUser, 'bad-id', 'approved')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when instance already finalized', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({
        rows: [{ ...fakeInstance, status: 'approved' }],
        rowCount: 1,
      });
      query.mockResolvedValueOnce(OK); // ROLLBACK

      await expect(svc.decide(fakeUser, 'inst-1', 'approved')).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when requester tries to approve own PR', async () => {
      const selfApprover = { userId: 'u-requester', orgId: 'org-1', email: 'req@co.th' };
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [fakeInstance], rowCount: 1 }); // instance
      query.mockResolvedValueOnce(OK); // ROLLBACK

      await expect(svc.decide(selfApprover, 'inst-1', 'approved')).rejects.toThrow(ForbiddenException);
    });

    it('allows requester to reject own PR (recall)', async () => {
      const selfRejecter = { userId: 'u-requester', orgId: 'org-1', email: 'req@co.th' };
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [fakeInstance], rowCount: 1 }); // instance
      // step approver check — the requester is listed as approver in this weird workflow
      query.mockResolvedValueOnce({
        rows: [{ approver_kind: 'user', approver_ref: 'u-requester' }],
        rowCount: 1,
      });
      query.mockResolvedValueOnce(OK); // INSERT decision
      query.mockResolvedValueOnce(OK); // UPDATE instance → rejected
      query.mockResolvedValueOnce(OK); // UPDATE PR → rejected
      // LINE notification context
      query.mockResolvedValueOnce({
        rows: [{ id: 'pr-1', pr_number: 'PR-2026-0001', title: 'Test', requester_id: 'u-requester', approver_name: 'Self' }],
        rowCount: 1,
      });
      query.mockResolvedValueOnce(OK); // COMMIT

      const result = await svc.decide(selfRejecter, 'inst-1', 'rejected');
      expect(result).toEqual({ ok: true });
    });

    it('throws ForbiddenException when user is not an approver at current step', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [fakeInstance], rowCount: 1 }); // instance
      // step check — different user is the approver
      query.mockResolvedValueOnce({
        rows: [{ approver_kind: 'user', approver_ref: 'u-other-person' }],
        rowCount: 1,
      });
      query.mockResolvedValueOnce(OK); // ROLLBACK

      await expect(svc.decide(fakeUser, 'inst-1', 'approved')).rejects.toThrow(ForbiddenException);
    });
  });
});
