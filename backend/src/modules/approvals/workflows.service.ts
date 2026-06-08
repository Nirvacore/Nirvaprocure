import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export interface WorkflowStep {
  step_no: number;
  approver_kind: 'user' | 'role' | 'manager_of_requester';
  approver_ref: string;
  sla_hours?: number | null;
}

export interface Workflow {
  id: string;
  name: string;
  match_rules: Record<string, unknown>;
  is_active: boolean;
  steps: WorkflowStep[];
}

/**
 * NirvaFlow CRUD service. Workflow + steps are tightly coupled — create/update
 * accepts the steps inline rather than as a separate sub-resource. The atomic
 * replace strategy on update keeps the "edit the chain visually then save"
 * UX simple at the cost of slightly larger payloads.
 */
@Injectable()
export class WorkflowsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  list(user: CurrentUser): Promise<Workflow[]> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const wf = await c.query(
        `SELECT id, name, match_rules, is_active FROM approval_workflows
         ORDER BY (match_rules->>'min_amount_minor')::BIGINT NULLS FIRST`,
      );
      const ids = wf.rows.map((r) => r.id);
      const steps = ids.length === 0 ? { rows: [] } : await c.query(
        `SELECT workflow_id, step_no, approver_kind, approver_ref, sla_hours
         FROM approval_steps WHERE workflow_id = ANY($1::uuid[])
         ORDER BY workflow_id, step_no`, [ids],
      );
      const byWf = new Map<string, WorkflowStep[]>();
      for (const s of steps.rows) {
        const list = byWf.get(s.workflow_id) ?? [];
        list.push({
          step_no: s.step_no, approver_kind: s.approver_kind,
          approver_ref: s.approver_ref, sla_hours: s.sla_hours,
        });
        byWf.set(s.workflow_id, list);
      }
      return wf.rows.map((r) => ({
        id: r.id, name: r.name, match_rules: r.match_rules,
        is_active: r.is_active, steps: byWf.get(r.id) ?? [],
      }));
    });
  }

  create(user: CurrentUser, body: {
    name: string; match_rules: Record<string, unknown>;
    is_active?: boolean; steps: WorkflowStep[];
  }) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const wf = await c.query(
        `INSERT INTO approval_workflows (org_id, name, match_rules, is_active)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, match_rules, is_active`,
        [user.orgId, body.name, body.match_rules, body.is_active ?? true],
      );
      const wfId = wf.rows[0].id as string;
      await this.replaceSteps(c, wfId, body.steps);
      return { ...wf.rows[0], steps: body.steps };
    });
  }

  update(user: CurrentUser, id: string, body: {
    name?: string; match_rules?: Record<string, unknown>;
    is_active?: boolean; steps?: WorkflowStep[];
  }) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const fields: string[] = [];
      const params: unknown[] = [];
      const set = (col: string, val: unknown) => {
        params.push(val);
        fields.push(`${col} = $${params.length}`);
      };
      if (body.name        !== undefined) set('name', body.name);
      if (body.match_rules !== undefined) set('match_rules', body.match_rules);
      if (body.is_active   !== undefined) set('is_active', body.is_active);
      if (fields.length > 0) {
        params.push(id);
        const r = await c.query(
          `UPDATE approval_workflows SET ${fields.join(', ')}, updated_at = now()
           WHERE id = $${params.length}
           RETURNING id, name, match_rules, is_active`,
          params,
        );
        if (r.rowCount === 0) throw new NotFoundException();
      }
      if (body.steps) await this.replaceSteps(c, id, body.steps);

      const wf = await c.query(
        `SELECT id, name, match_rules, is_active FROM approval_workflows WHERE id = $1`,
        [id],
      );
      const steps = await c.query(
        `SELECT step_no, approver_kind, approver_ref, sla_hours
         FROM approval_steps WHERE workflow_id = $1 ORDER BY step_no`, [id],
      );
      return { ...wf.rows[0], steps: steps.rows };
    });
  }

  remove(user: CurrentUser, id: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      // Hard delete is OK on workflows because they're an admin-only object
      // and approval_instances retain their own copy of `workflow_id` for
      // audit. If we ever need to recover, restore from the audit log.
      const r = await c.query(
        `DELETE FROM approval_workflows WHERE id = $1`, [id],
      );
      if (r.rowCount === 0) throw new NotFoundException();
      return { ok: true };
    });
  }

  /**
   * Atomic replace: clear the existing steps then insert the new set.
   * Runs inside the caller's transaction so a failure rolls back the wipe.
   */
  private async replaceSteps(client: any, workflowId: string, steps: WorkflowStep[]) {
    await client.query(`DELETE FROM approval_steps WHERE workflow_id = $1`, [workflowId]);
    for (const s of steps) {
      await client.query(
        `INSERT INTO approval_steps (workflow_id, step_no, approver_kind, approver_ref, sla_hours)
         VALUES ($1, $2, $3, $4, $5)`,
        [workflowId, s.step_no, s.approver_kind, s.approver_ref, s.sla_hours ?? null],
      );
    }
  }
}
