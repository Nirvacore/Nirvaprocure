import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { LineNotifier } from '../notifications/line.notifier';

@Injectable()
export class ApprovalsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly line: LineNotifier,
  ) {}

  inbox(user: CurrentUser) {
    return withOrg(this.pool, user.orgId, async (c) => {
      // Pending instances where the caller matches the current step's approver_ref.
      // Phase 1 supports approver_kind = 'user' (direct user id) and 'manager_of_requester'.
      const res = await c.query(
        `SELECT
           ai.id AS instance_id,
           ai.current_step AS step_no,
           ai.created_at AS waiting_since,
           pr.id, pr.pr_number, pr.title, pr.status, pr.requester_id,
           pr.department_id, pr.total_minor, pr.currency, pr.submitted_at, pr.created_at
         FROM approval_instances ai
         JOIN approval_steps s
           ON s.workflow_id = ai.workflow_id AND s.step_no = ai.current_step
         JOIN purchase_requests pr ON pr.id = ai.pr_id
         WHERE ai.status = 'pending'
           AND s.approver_kind = 'user'
           AND s.approver_ref = $1::text
         ORDER BY ai.created_at`,
        [user.userId],
      );
      return res.rows.map((r) => ({
        instance_id: r.instance_id,
        step_no: r.step_no,
        waiting_since: r.waiting_since,
        pr: {
          id: r.id,
          pr_number: r.pr_number,
          title: r.title,
          status: r.status,
          requester_id: r.requester_id,
          department_id: r.department_id,
          total: { amount_minor: Number(r.total_minor), currency: r.currency },
          submitted_at: r.submitted_at,
          created_at: r.created_at,
        },
      }));
    });
  }

  decide(user: CurrentUser, instanceId: string, decision: 'approved' | 'rejected', comment?: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const inst = await c.query(
        `SELECT ai.*, pr.requester_id
         FROM approval_instances ai
         JOIN purchase_requests pr ON pr.id = ai.pr_id
         WHERE ai.id = $1 FOR UPDATE OF ai`,
        [instanceId],
      );
      if (inst.rowCount === 0) throw new NotFoundException();
      if (inst.rows[0].status !== 'pending') {
        throw new ConflictException('Instance already finalized');
      }

      // Hard rule: a requester cannot approve their own PR — even if a
      // misconfigured workflow somehow lists them as the step's approver,
      // a rejection would still be allowed (used to recall), but approval
      // is blocked unconditionally.
      if (
        decision === 'approved' &&
        inst.rows[0].requester_id === user.userId
      ) {
        throw new ForbiddenException('Cannot approve your own purchase request');
      }

      const step = await c.query(
        `SELECT * FROM approval_steps
         WHERE workflow_id = $1 AND step_no = $2`,
        [inst.rows[0].workflow_id, inst.rows[0].current_step],
      );
      const allowed = step.rows.some(
        (s) => s.approver_kind === 'user' && s.approver_ref === user.userId,
      );
      if (!allowed) throw new ForbiddenException('Not an approver at this step');

      await c.query(
        `INSERT INTO approval_decisions (instance_id, step_no, approver_id, decision, comment)
         VALUES ($1, $2, $3, $4, $5)`,
        [instanceId, inst.rows[0].current_step, user.userId, decision, comment ?? null],
      );

      if (decision === 'rejected') {
        await c.query(
          `UPDATE approval_instances SET status = 'rejected', completed_at = now() WHERE id = $1`,
          [instanceId],
        );
        await c.query(
          `UPDATE purchase_requests SET status = 'rejected', decided_at = now(), updated_at = now() WHERE id = $1`,
          [inst.rows[0].pr_id],
        );
      } else {
        // Phase 1: single approver per step → advance immediately.
        const next = await c.query(
          `SELECT MIN(step_no) AS next_step FROM approval_steps
           WHERE workflow_id = $1 AND step_no > $2`,
          [inst.rows[0].workflow_id, inst.rows[0].current_step],
        );
        if (next.rows[0].next_step) {
          await c.query(
            `UPDATE approval_instances SET current_step = $1 WHERE id = $2`,
            [next.rows[0].next_step, instanceId],
          );
        } else {
          await c.query(
            `UPDATE approval_instances SET status = 'approved', completed_at = now() WHERE id = $1`,
            [instanceId],
          );
          await c.query(
            `UPDATE purchase_requests SET status = 'approved', decided_at = now(), updated_at = now() WHERE id = $1`,
            [inst.rows[0].pr_id],
          );
        }
      }
      // Notify the requester whenever the workflow reaches a terminal state.
      // Mid-flow decisions (still more steps to go) stay quiet on LINE so
      // we don't spam — only the final outcome triggers a chat message.
      const finalStatus = decision === 'rejected'
        ? 'rejected'
        : (await c.query(
            `SELECT status FROM approval_instances WHERE id = $1`, [instanceId],
          )).rows[0]?.status;

      if (finalStatus === 'approved' || finalStatus === 'rejected') {
        const ctx = await c.query(
          `SELECT pr.id, pr.pr_number, pr.title, pr.requester_id,
                  u.full_name AS approver_name
           FROM purchase_requests pr
           JOIN users u ON u.id = $2
           WHERE pr.id = $1`,
          [inst.rows[0].pr_id, user.userId],
        );
        const row = ctx.rows[0];
        if (row) {
          void this.line.send({
            user_id:  row.requester_id,
            org_id:   user.orgId,
            template: 'pr_decided',
            payload: {
              pr_number:  row.pr_number,
              title:      row.title,
              decision:   finalStatus,
              approver:   row.approver_name,
              comment:    comment ?? '—',
              detail_url: `${process.env.WEB_ORIGIN ?? ''}/pr/${row.id}`,
            },
          });
        }
      }
      return { ok: true };
    });
  }
}
