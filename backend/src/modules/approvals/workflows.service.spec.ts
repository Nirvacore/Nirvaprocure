/**
 * Unit tests for WorkflowsService.
 *
 * Covers CRUD operations: list (with and without steps), create (with steps),
 * update (fields only, steps only, both), remove, and NotFoundException
 * cases for update/remove.
 */

import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PG_POOL } from '../../common/db/db.module';
import { WorkflowsService, WorkflowStep } from './workflows.service';

const OK = { rows: [], rowCount: 0 };

const makePool = (queryFn: jest.Mock) => ({
  connect: jest.fn().mockResolvedValue({
    query: queryFn,
    release: jest.fn(),
  }),
});

const fakeUser = {
  userId: 'u-admin',
  orgId: 'org-1',
  email: 'admin@co.th',
};

const fakeWorkflowRow = {
  id: 'wf-1',
  name: 'Standard Approval',
  match_rules: { min_amount_minor: 100000 },
  is_active: true,
};

const fakeStepRows = [
  { workflow_id: 'wf-1', step_no: 1, approver_kind: 'role', approver_ref: 'manager', sla_hours: 24 },
  { workflow_id: 'wf-1', step_no: 2, approver_kind: 'user', approver_ref: 'u-cfo', sla_hours: 48 },
];

const stepsInput: WorkflowStep[] = [
  { step_no: 1, approver_kind: 'role', approver_ref: 'manager', sla_hours: 24 },
  { step_no: 2, approver_kind: 'user', approver_ref: 'u-cfo', sla_hours: 48 },
];

describe('WorkflowsService', () => {
  let svc: WorkflowsService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        WorkflowsService,
        { provide: PG_POOL, useValue: makePool(query) },
      ],
    }).compile();
    svc = mod.get(WorkflowsService);
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns workflows with their steps grouped', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [fakeWorkflowRow], rowCount: 1 }); // SELECT workflows
      query.mockResolvedValueOnce({ rows: fakeStepRows, rowCount: 2 }); // SELECT steps
      query.mockResolvedValueOnce(OK); // COMMIT

      const result = await svc.list(fakeUser as any);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('wf-1');
      expect(result[0].name).toBe('Standard Approval');
      expect(result[0].steps).toHaveLength(2);
      expect(result[0].steps[0]).toEqual({
        step_no: 1, approver_kind: 'role', approver_ref: 'manager', sla_hours: 24,
      });
      expect(result[0].steps[1]).toEqual({
        step_no: 2, approver_kind: 'user', approver_ref: 'u-cfo', sla_hours: 48,
      });
    });

    it('returns workflows with empty steps array when no steps exist', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [fakeWorkflowRow], rowCount: 1 }); // SELECT workflows
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT steps (none)
      query.mockResolvedValueOnce(OK); // COMMIT

      const result = await svc.list(fakeUser as any);
      expect(result).toHaveLength(1);
      expect(result[0].steps).toEqual([]);
    });

    it('returns empty array when no workflows exist', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT workflows (none)
      // No steps query when ids is empty
      query.mockResolvedValueOnce(OK); // COMMIT

      const result = await svc.list(fakeUser as any);
      expect(result).toEqual([]);
    });

    it('groups steps correctly across multiple workflows', async () => {
      const wf2 = { id: 'wf-2', name: 'High Value', match_rules: { min_amount_minor: 500000 }, is_active: true };
      const allSteps = [
        ...fakeStepRows,
        { workflow_id: 'wf-2', step_no: 1, approver_kind: 'user', approver_ref: 'u-ceo', sla_hours: null },
      ];

      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [fakeWorkflowRow, wf2], rowCount: 2 }); // SELECT workflows
      query.mockResolvedValueOnce({ rows: allSteps, rowCount: 3 }); // SELECT steps
      query.mockResolvedValueOnce(OK); // COMMIT

      const result = await svc.list(fakeUser as any);
      expect(result).toHaveLength(2);
      expect(result[0].steps).toHaveLength(2);
      expect(result[1].steps).toHaveLength(1);
      expect(result[1].steps[0].approver_ref).toBe('u-ceo');
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('inserts a workflow and its steps, returns the result', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [{ ...fakeWorkflowRow }], rowCount: 1 }); // INSERT workflow
      query.mockResolvedValueOnce(OK); // DELETE old steps (replaceSteps)
      query.mockResolvedValueOnce(OK); // INSERT step 1
      query.mockResolvedValueOnce(OK); // INSERT step 2
      query.mockResolvedValueOnce(OK); // COMMIT

      const result = await svc.create(fakeUser as any, {
        name: 'Standard Approval',
        match_rules: { min_amount_minor: 100000 },
        steps: stepsInput,
      });

      expect(result.id).toBe('wf-1');
      expect(result.name).toBe('Standard Approval');
      expect(result.steps).toEqual(stepsInput);
      // Verify the INSERT workflow query received the right params
      const insertCall = query.mock.calls[2]; // 3rd call (after BEGIN, SET LOCAL)
      expect(insertCall[1]).toEqual(['org-1', 'Standard Approval', { min_amount_minor: 100000 }, true]);
    });

    it('defaults is_active to true when omitted', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [{ ...fakeWorkflowRow }], rowCount: 1 }); // INSERT
      query.mockResolvedValueOnce(OK); // DELETE old steps
      query.mockResolvedValueOnce(OK); // COMMIT

      await svc.create(fakeUser as any, {
        name: 'Test',
        match_rules: {},
        steps: [],
      });

      const insertCall = query.mock.calls[2];
      // 4th param is is_active, defaulting to true
      expect(insertCall[1][3]).toBe(true);
    });

    it('respects explicit is_active = false', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [{ ...fakeWorkflowRow, is_active: false }], rowCount: 1 }); // INSERT
      query.mockResolvedValueOnce(OK); // DELETE old steps
      query.mockResolvedValueOnce(OK); // COMMIT

      const result = await svc.create(fakeUser as any, {
        name: 'Disabled Workflow',
        match_rules: {},
        is_active: false,
        steps: [],
      });

      const insertCall = query.mock.calls[2];
      expect(insertCall[1][3]).toBe(false);
    });

    it('handles step with null sla_hours', async () => {
      const stepNoSla: WorkflowStep[] = [
        { step_no: 1, approver_kind: 'manager_of_requester', approver_ref: 'auto' },
      ];

      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [{ ...fakeWorkflowRow }], rowCount: 1 }); // INSERT workflow
      query.mockResolvedValueOnce(OK); // DELETE old steps
      query.mockResolvedValueOnce(OK); // INSERT step 1 (sla_hours null)
      query.mockResolvedValueOnce(OK); // COMMIT

      await svc.create(fakeUser as any, {
        name: 'Auto Approval',
        match_rules: {},
        steps: stepNoSla,
      });

      // The INSERT step call — 5th call (BEGIN, SET LOCAL, INSERT wf, DELETE steps, INSERT step)
      const stepInsertCall = query.mock.calls[4];
      expect(stepInsertCall[1][4]).toBeNull(); // sla_hours defaults to null
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates fields and replaces steps', async () => {
      const updatedRow = { ...fakeWorkflowRow, name: 'Updated Workflow' };

      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 }); // UPDATE workflow
      query.mockResolvedValueOnce(OK); // DELETE old steps (replaceSteps)
      query.mockResolvedValueOnce(OK); // INSERT step 1
      query.mockResolvedValueOnce(OK); // INSERT step 2
      query.mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 }); // SELECT workflow
      query.mockResolvedValueOnce({ rows: fakeStepRows, rowCount: 2 }); // SELECT steps
      query.mockResolvedValueOnce(OK); // COMMIT

      const result = await svc.update(fakeUser as any, 'wf-1', {
        name: 'Updated Workflow',
        steps: stepsInput,
      });

      expect(result.name).toBe('Updated Workflow');
      expect(result.steps).toHaveLength(2);
    });

    it('updates only fields without replacing steps', async () => {
      const updatedRow = { ...fakeWorkflowRow, is_active: false };

      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 }); // UPDATE workflow
      // No replaceSteps calls because body.steps is undefined
      query.mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 }); // SELECT workflow
      query.mockResolvedValueOnce({ rows: fakeStepRows, rowCount: 2 }); // SELECT steps
      query.mockResolvedValueOnce(OK); // COMMIT

      const result = await svc.update(fakeUser as any, 'wf-1', {
        is_active: false,
      });

      expect(result.is_active).toBe(false);
      expect(result.steps).toHaveLength(2);
    });

    it('replaces steps without updating fields when only steps provided', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      // No UPDATE call because fields.length === 0
      query.mockResolvedValueOnce(OK); // DELETE old steps (replaceSteps)
      query.mockResolvedValueOnce(OK); // INSERT step 1
      query.mockResolvedValueOnce({ rows: [fakeWorkflowRow], rowCount: 1 }); // SELECT workflow
      query.mockResolvedValueOnce({ rows: [fakeStepRows[0]], rowCount: 1 }); // SELECT steps
      query.mockResolvedValueOnce(OK); // COMMIT

      const result = await svc.update(fakeUser as any, 'wf-1', {
        steps: [stepsInput[0]],
      });

      expect(result.id).toBe('wf-1');
      expect(result.steps).toHaveLength(1);
    });

    it('throws NotFoundException when workflow does not exist', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE returns 0 rows
      query.mockResolvedValueOnce(OK); // ROLLBACK

      await expect(
        svc.update(fakeUser as any, 'wf-nonexistent', { name: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates all three fields simultaneously', async () => {
      const updatedRow = {
        id: 'wf-1',
        name: 'New Name',
        match_rules: { doc_type: 'po' },
        is_active: false,
      };

      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 }); // UPDATE
      query.mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 }); // SELECT workflow
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT steps
      query.mockResolvedValueOnce(OK); // COMMIT

      const result = await svc.update(fakeUser as any, 'wf-1', {
        name: 'New Name',
        match_rules: { doc_type: 'po' },
        is_active: false,
      });

      expect(result.name).toBe('New Name');
      expect(result.match_rules).toEqual({ doc_type: 'po' });
      expect(result.is_active).toBe(false);
      expect(result.steps).toEqual([]);

      // Verify the UPDATE query built the SET clause correctly
      const updateCall = query.mock.calls[2];
      expect(updateCall[0]).toContain('name = $1');
      expect(updateCall[0]).toContain('match_rules = $2');
      expect(updateCall[0]).toContain('is_active = $3');
      expect(updateCall[1]).toEqual(['New Name', { doc_type: 'po' }, false, 'wf-1']);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes a workflow and returns { ok: true }', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // DELETE
      query.mockResolvedValueOnce(OK); // COMMIT

      const result = await svc.remove(fakeUser as any, 'wf-1');
      expect(result).toEqual({ ok: true });

      // Verify the DELETE query used the right id
      const deleteCall = query.mock.calls[2];
      expect(deleteCall[1]).toEqual(['wf-1']);
    });

    it('throws NotFoundException when workflow does not exist', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // DELETE returns 0
      query.mockResolvedValueOnce(OK); // ROLLBACK

      await expect(
        svc.remove(fakeUser as any, 'wf-nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── replaceSteps (tested via create/update) ───────────────────────────────

  describe('replaceSteps (via create)', () => {
    it('inserts steps in order with correct parameters', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [{ ...fakeWorkflowRow }], rowCount: 1 }); // INSERT workflow
      query.mockResolvedValueOnce(OK); // DELETE old steps
      query.mockResolvedValueOnce(OK); // INSERT step 1
      query.mockResolvedValueOnce(OK); // INSERT step 2
      query.mockResolvedValueOnce(OK); // COMMIT

      await svc.create(fakeUser as any, {
        name: 'Test',
        match_rules: {},
        steps: stepsInput,
      });

      // DELETE call (index 3)
      expect(query.mock.calls[3][0]).toContain('DELETE FROM approval_steps');
      expect(query.mock.calls[3][1]).toEqual(['wf-1']);

      // INSERT step 1 (index 4)
      expect(query.mock.calls[4][0]).toContain('INSERT INTO approval_steps');
      expect(query.mock.calls[4][1]).toEqual(['wf-1', 1, 'role', 'manager', 24]);

      // INSERT step 2 (index 5)
      expect(query.mock.calls[5][1]).toEqual(['wf-1', 2, 'user', 'u-cfo', 48]);
    });

    it('handles empty steps array (only deletes, no inserts)', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [{ ...fakeWorkflowRow }], rowCount: 1 }); // INSERT workflow
      query.mockResolvedValueOnce(OK); // DELETE old steps
      query.mockResolvedValueOnce(OK); // COMMIT

      await svc.create(fakeUser as any, {
        name: 'Empty Steps',
        match_rules: {},
        steps: [],
      });

      // Only 5 calls: BEGIN, SET LOCAL, INSERT wf, DELETE steps, COMMIT
      // (no step INSERT calls)
      expect(query).toHaveBeenCalledTimes(5);
    });
  });

  // ── transaction safety ────────────────────────────────────────────────────

  describe('transaction safety', () => {
    it('rolls back on query failure during create', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockRejectedValueOnce(new Error('unique_violation')); // INSERT fails
      query.mockResolvedValueOnce(OK); // ROLLBACK

      await expect(
        svc.create(fakeUser as any, {
          name: 'Duplicate',
          match_rules: {},
          steps: [],
        }),
      ).rejects.toThrow('unique_violation');

      // Verify ROLLBACK was called (4th query)
      expect(query.mock.calls[3][0]).toBe('ROLLBACK');
    });

    it('rolls back on query failure during step insertion', async () => {
      query.mockResolvedValueOnce(OK); // BEGIN
      query.mockResolvedValueOnce(OK); // SET LOCAL
      query.mockResolvedValueOnce({ rows: [{ ...fakeWorkflowRow }], rowCount: 1 }); // INSERT workflow
      query.mockResolvedValueOnce(OK); // DELETE old steps
      query.mockRejectedValueOnce(new Error('fk_violation')); // INSERT step fails
      query.mockResolvedValueOnce(OK); // ROLLBACK

      await expect(
        svc.create(fakeUser as any, {
          name: 'Bad Steps',
          match_rules: {},
          steps: [{ step_no: 1, approver_kind: 'user', approver_ref: 'u-ghost' }],
        }),
      ).rejects.toThrow('fk_violation');

      expect(query.mock.calls[5][0]).toBe('ROLLBACK');
    });
  });
});
