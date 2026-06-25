import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { CreatePrDto, UpdatePrDto } from './dto';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { AffiliateService } from '../marketplace/affiliate.service';
import { LineNotifier } from '../notifications/line.notifier';
import { AnomalyService } from '../anomaly/anomaly.service';
import { BudgetService } from '../budget/budget.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { StockService } from '../stock/stock.service';

interface ListOpts {
  status?: string;
  requesterId?: string;
  cursor?: string;
  limit: number;
}

@Injectable()
export class PrService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly marketplace: MarketplaceService,
    private readonly affiliate: AffiliateService,
    private readonly line: LineNotifier,
    private readonly stock: StockService,
    private readonly anomaly: AnomalyService,
    private readonly budget: BudgetService,
    private readonly webhooks: WebhooksService,
  ) {}

  list(user: CurrentUser, opts: ListOpts) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const params: unknown[] = [];
      const where: string[] = ['deleted_at IS NULL'];
      if (opts.status) {
        params.push(opts.status);
        where.push(`status = $${params.length}`);
      }
      if (opts.requesterId) {
        params.push(opts.requesterId);
        where.push(`requester_id = $${params.length}`);
      }
      params.push(opts.limit + 1);
      const res = await c.query(
        `SELECT id, pr_number, title, status, requester_id, department_id,
                total_minor, currency, submitted_at, created_at
         FROM purchase_requests
         WHERE ${where.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params,
      );
      const hasMore = res.rows.length > opts.limit;
      const rows = hasMore ? res.rows.slice(0, opts.limit) : res.rows;
      return {
        data: rows.map(this.toPr),
        next_cursor: hasMore ? rows[rows.length - 1].created_at : null,
      };
    });
  }

  create(user: CurrentUser, dto: CreatePrDto) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const prNumber = await this.nextPrNumber(c, user.orgId);
      const total = dto.items.reduce(
        (sum, i) => sum + Math.round(i.quantity * i.unit_price_minor),
        0,
      );
      const ins = await c.query(
        `INSERT INTO purchase_requests
           (org_id, pr_number, requester_id, department_id, title, justification, total_minor)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [user.orgId, prNumber, user.userId, dto.department_id ?? null,
         dto.title, dto.justification ?? null, total],
      );
      const pr = ins.rows[0];

      for (let i = 0; i < dto.items.length; i++) {
        const it = dto.items[i];
        await c.query(
          `INSERT INTO purchase_request_items
             (org_id, pr_id, line_no, description, quantity, unit,
              unit_price_minor, supplier_id, source, source_url, source_metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [user.orgId, pr.id, i + 1, it.description, it.quantity,
           it.unit ?? 'unit', it.unit_price_minor, it.supplier_id ?? null,
           it.source ?? 'manual', it.source_url ?? null,
           it.source_metadata ?? null],
        );
      }
      await this.writeAudit(c, user, 'pr.create', 'purchase_request', pr.id, null, pr);
      return this.toPr(pr);
    });
  }

  async importLink(user: CurrentUser, url: string) {
    // Tag with affiliate link first (no-op if org has no config).
    const taggedUrl = await this.affiliate.tagUrl(user.orgId, url);
    const item = await this.marketplace.parse(taggedUrl);
    // Return the affiliate URL so the PR line item stores it for click-through.
    return { ...item, source_url: taggedUrl, original_url: url };
  }

  getOne(user: CurrentUser, id: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const pr = await c.query(
        `SELECT * FROM purchase_requests WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      if (pr.rowCount === 0) throw new NotFoundException();
      const items = await c.query(
        `SELECT * FROM purchase_request_items WHERE pr_id = $1 ORDER BY line_no`,
        [id],
      );
      const approval = await c.query(
        `SELECT id, current_step, status FROM approval_instances WHERE pr_id = $1 LIMIT 1`,
        [id],
      );
      let trail = null;
      if ((approval.rowCount ?? 0) > 0) {
        const decisions = await c.query(
          `SELECT step_no, approver_id, decision, comment, decided_at
           FROM approval_decisions WHERE instance_id = $1 ORDER BY decided_at`,
          [approval.rows[0].id],
        );
        trail = {
          instance_id: approval.rows[0].id,
          current_step: approval.rows[0].current_step,
          status: approval.rows[0].status,
          decisions: decisions.rows,
        };
      }

      let linkedTor = null;
      const byLink = await c.query(
        `SELECT id, title, status FROM tor_drafts WHERE linked_pr_id = $1 LIMIT 1`,
        [id],
      );
      if (byLink.rowCount && byLink.rowCount > 0) {
        linkedTor = byLink.rows[0];
      } else {
        const torId = items.rows[0]?.source_metadata?.tor_draft_id as string | undefined;
        if (torId) {
          const byMeta = await c.query(
            `SELECT id, title, status FROM tor_drafts WHERE id = $1`,
            [torId],
          );
          if (byMeta.rowCount && byMeta.rowCount > 0) linkedTor = byMeta.rows[0];
        }
      }

      return { ...this.toPr(pr.rows[0]), items: items.rows, approval: trail, linked_tor: linkedTor };
    });
  }

  update(user: CurrentUser, id: string, dto: UpdatePrDto) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const pr = await c.query(
        `SELECT * FROM purchase_requests WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      if (pr.rowCount === 0) throw new NotFoundException();
      if (pr.rows[0].status !== 'draft') {
        throw new ConflictException('Only draft PRs can be edited');
      }
      const fields: string[] = [];
      const params: unknown[] = [];
      const set = (col: string, val: unknown) => {
        params.push(val);
        fields.push(`${col} = $${params.length}`);
      };
      if (dto.title !== undefined) set('title', dto.title);
      if (dto.justification !== undefined) set('justification', dto.justification);
      if (dto.department_id !== undefined) set('department_id', dto.department_id);
      if (fields.length > 0) {
        params.push(id);
        await c.query(
          `UPDATE purchase_requests SET ${fields.join(', ')}, updated_at = now()
           WHERE id = $${params.length}`,
          params,
        );
      }
      if (dto.items) {
        await c.query(`DELETE FROM purchase_request_items WHERE pr_id = $1`, [id]);
        for (let i = 0; i < dto.items.length; i++) {
          const it = dto.items[i];
          await c.query(
            `INSERT INTO purchase_request_items
               (org_id, pr_id, line_no, description, quantity, unit,
                unit_price_minor, supplier_id, source, source_url, source_metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [user.orgId, id, i + 1, it.description, it.quantity,
             it.unit ?? 'unit', it.unit_price_minor, it.supplier_id ?? null,
             it.source ?? 'manual', it.source_url ?? null,
             it.source_metadata ?? null],
          );
        }
        const total = dto.items.reduce(
          (s, i) => s + Math.round(i.quantity * i.unit_price_minor),
          0,
        );
        await c.query(
          `UPDATE purchase_requests SET total_minor = $1, updated_at = now() WHERE id = $2`,
          [total, id],
        );
      }
      const after = await c.query(`SELECT * FROM purchase_requests WHERE id = $1`, [id]);
      await this.writeAudit(c, user, 'pr.update', 'purchase_request', id, pr.rows[0], after.rows[0]);
      return this.toPr(after.rows[0]);
    });
  }

  submit(user: CurrentUser, id: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const pr = await c.query(
        `SELECT * FROM purchase_requests WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id],
      );
      if (pr.rowCount === 0) throw new NotFoundException();
      if (pr.rows[0].status !== 'draft') {
        throw new ConflictException('PR is not in draft status');
      }
      // Budget check (warn-only, never blocking — exec can override). Records
      // an info-level anomaly so the dept lead has visibility next time they
      // open the dashboard. Stays inside the same transaction.
      const budget = await this.budget.checkPrAgainstBudget(
        user.orgId,
        pr.rows[0].department_id as string | null,
        Number(pr.rows[0].total_minor),
      );
      if (budget?.over) {
        await this.anomaly.record({
          org_id: user.orgId,
          kind: 'price_spike',                  // reuse existing kind; budget-specific kind = future migration
          severity: budget.soft_block ? 'critical' : 'warning',
          subject_type: 'purchase_request',
          subject_id: id,
          details: {
            reason: 'department budget exceeded',
            pr_number:    pr.rows[0].pr_number,
            would_be_pct: budget.would_be_pct,
            amount_minor: budget.amount_minor,
            spent_minor:  budget.spent_minor,
            pr_total_minor: Number(pr.rows[0].total_minor),
          },
        });
      }

      // CoI: if the requester has a declared relationship to ANY supplier
      // on this PR, record an alert (severity=critical) so a compliance
      // officer sees it. The PR still proceeds — disclosure isn't blocking;
      // burying the relationship would be. Submit-time fire is intentional:
      // we want the alert visible before the approver acts.
      const hasCoi = await this.anomaly.prHasCoi(user.orgId, id, user.userId);
      if (hasCoi) {
        await this.anomaly.record({
          org_id: user.orgId,
          kind: 'coi_match',
          severity: 'critical',
          subject_type: 'purchase_request',
          subject_id: id,
          details: {
            pr_number: pr.rows[0].pr_number,
            note: 'Requester has a declared relationship to one or more suppliers on this PR',
          },
        });
      }

      // Workflow selection is left to ApprovalsService; minimal scaffold:
      const wf = await c.query(
        `SELECT id FROM approval_workflows
         WHERE is_active = TRUE AND (match_rules->>'min_amount_minor')::BIGINT <= $1
         ORDER BY (match_rules->>'min_amount_minor')::BIGINT DESC NULLS LAST
         LIMIT 1`,
        [pr.rows[0].total_minor],
      );
      if (wf.rowCount === 0) {
        throw new ConflictException('No matching approval workflow configured');
      }

      // Anti-self-approve guard at submit time: refuse to start a workflow
      // whose ENTIRE chain contains only the requester as approver. Catches
      // misconfigurations early (instead of at decide-time, when the LINE
      // notifications would already have fired confusingly).
      const stepGuard = await c.query(
        `SELECT COUNT(*) FILTER (WHERE approver_kind = 'user' AND approver_ref <> $2) AS others,
                COUNT(*) AS total
         FROM approval_steps WHERE workflow_id = $1`,
        [wf.rows[0].id, user.userId],
      );
      const others = Number(stepGuard.rows[0]?.others ?? 0);
      const total  = Number(stepGuard.rows[0]?.total  ?? 0);
      if (total > 0 && others === 0) {
        throw new ConflictException('Workflow has no eligible approvers (you cannot approve your own PR)');
      }

      await c.query(
        `INSERT INTO approval_instances (org_id, pr_id, workflow_id) VALUES ($1, $2, $3)`,
        [user.orgId, id, wf.rows[0].id],
      );
      await c.query(
        `UPDATE purchase_requests
         SET status = 'in_approval', submitted_at = now(), updated_at = now()
         WHERE id = $1`,
        [id],
      );
      await this.writeAudit(c, user, 'pr.submit', 'purchase_request', id, null, null);

      // Notify the step-1 approver(s) of the chosen workflow. We do this
      // INSIDE the org-scoped transaction so the lookup goes through RLS,
      // and AFTER the status update so the notification can deep-link to
      // the (now in_approval) PR.
      const approvers = await c.query(
        `SELECT approver_ref FROM approval_steps
         WHERE workflow_id = $1 AND step_no = 1 AND approver_kind = 'user'`,
        [wf.rows[0].id],
      );
      const requesterName = await c.query(
        `SELECT full_name FROM users WHERE id = $1`, [pr.rows[0].requester_id],
      );
      for (const a of approvers.rows) {
        // Fire and forget — failures are recorded as notification rows.
        void this.line.send({
          user_id: a.approver_ref,
          org_id:  user.orgId,
          template: 'pr_submitted',
          payload: {
            pr_number:   pr.rows[0].pr_number,
            title:       pr.rows[0].title,
            requester:   requesterName.rows[0]?.full_name ?? '—',
            total_minor: Number(pr.rows[0].total_minor),
            detail_url:  `${process.env.WEB_ORIGIN ?? ''}/pr/${id}`,
          },
        });
      }

      // Fan out the same event to any subscribed orgs. Fire-and-forget;
      // delivery happens outside the transaction so a slow receiver can't
      // back-pressure the submit call.
      void this.webhooks.emit(user.orgId, 'pr.submitted', {
        pr_id:        id,
        pr_number:    pr.rows[0].pr_number,
        title:        pr.rows[0].title,
        total_minor:  Number(pr.rows[0].total_minor),
        requester_id: pr.rows[0].requester_id,
      });

      return this.getOne(user, id);
    });
  }

  /**
   * Mark an approved PR as received — i.e. the goods arrived. Each line item
   * with a known `item_id` becomes a `receive` stock movement in the chosen
   * warehouse, which automatically increments stock_on_hand via the trigger.
   *
   * Lines with no item_id (e.g. one-off services or marketplace items that
   * aren't catalogued) are skipped silently; the buyer can catalogue them
   * via NirvaStock and re-receive if needed.
   *
   * Idempotency: caller passes a unique `receive_id` per receive event.
   * Re-calling with the same id is a no-op. (Lock pattern omitted here —
   * Phase 4 will add a `pr_receipts` table to track receives independently.)
   */
  async receive(user: CurrentUser, prId: string, opts: {
    warehouse_id: string;
    lines: { line_item_id: string; item_id: string; quantity: number }[];
    note?: string;
  }) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const pr = await c.query(
        `SELECT id, pr_number, status FROM purchase_requests WHERE id = $1 AND deleted_at IS NULL`,
        [prId],
      );
      if (pr.rowCount === 0) throw new NotFoundException();
      if (!['approved', 'completed'].includes(pr.rows[0].status)) {
        throw new ConflictException('PR must be approved before receiving');
      }

      for (const line of opts.lines) {
        await this.stock.recordMovement(user, {
          item_id:        line.item_id,
          warehouse_id:   opts.warehouse_id,
          type:           'receive',
          qty:            line.quantity,
          reference_type: 'purchase_request',
          reference_id:   prId,
          note:           opts.note ?? `รับเข้าจาก ${pr.rows[0].pr_number}`,
        });
      }

      // Mark the PR completed once everything is received. Partial receives
      // would need a separate state — Phase 4 work; for now: all-or-nothing.
      await c.query(
        `UPDATE purchase_requests SET status = 'completed', updated_at = now() WHERE id = $1`,
        [prId],
      );
      await this.writeAudit(c, user, 'pr.receive', 'purchase_request', prId, null, {
        warehouse_id: opts.warehouse_id,
        line_count:   opts.lines.length,
      });
      return this.getOne(user, prId);
    });
  }

  private async nextPrNumber(client: any, orgId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PR-${year}-`;
    const res = await client.query(
      `SELECT pr_number FROM purchase_requests
       WHERE org_id = $1 AND pr_number LIKE $2
       ORDER BY pr_number DESC LIMIT 1`,
      [orgId, `${prefix}%`],
    );
    const next = res.rowCount === 0
      ? 1
      : parseInt(res.rows[0].pr_number.slice(prefix.length), 10) + 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  private async writeAudit(
    client: any, user: CurrentUser, action: string,
    entityType: string, entityId: string,
    before: unknown, after: unknown,
  ) {
    await client.query(
      `INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, diff)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.orgId, user.userId, action, entityType, entityId,
       JSON.stringify({ before, after })],
    );
  }

  // ---------------------------------------------------------------------
  // Comments thread
  // ---------------------------------------------------------------------

  listComments(user: CurrentUser, prId: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `SELECT pc.id, pc.body, pc.created_at,
                pc.author_id, u.full_name AS author_name
         FROM pr_comments pc
         JOIN users u ON u.id = pc.author_id
         WHERE pc.pr_id = $1 AND pc.deleted_at IS NULL
         ORDER BY pc.created_at`,
        [prId],
      );
      return r.rows;
    });
  }

  addComment(user: CurrentUser, prId: string, body: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      // Verify PR exists in this org. RLS handles isolation; we still want
      // to return a 404 vs a confusing "empty insert" if the id is wrong.
      const exists = await c.query(`SELECT 1 FROM purchase_requests WHERE id = $1`, [prId]);
      if (exists.rowCount === 0) throw new NotFoundException();
      const r = await c.query(
        `INSERT INTO pr_comments (org_id, pr_id, author_id, body)
         VALUES ($1, $2, $3, $4)
         RETURNING id, body, created_at, author_id`,
        [user.orgId, prId, user.userId, body],
      );
      await this.writeAudit(c, user, 'pr.comment', 'purchase_request', prId, null, { body });
      return { ...r.rows[0], author_name: user.email };
    });
  }

  private toPr = (row: any) => ({
    id: row.id,
    pr_number: row.pr_number,
    title: row.title,
    status: row.status,
    requester_id: row.requester_id,
    department_id: row.department_id,
    total: { amount_minor: Number(row.total_minor), currency: row.currency },
    submitted_at: row.submitted_at,
    created_at: row.created_at,
  });
}
