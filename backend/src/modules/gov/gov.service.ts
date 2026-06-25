import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import { OpenAiProvider } from '../ai/openai.provider';
import { PrService } from '../pr/pr.service';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export type ProcurementKind = 'goods' | 'services' | 'construction';
export type TorStatus = 'draft' | 'review' | 'approved' | 'archived';

const TOR_NEXT_STATUS: Record<TorStatus, TorStatus | null> = {
  draft:     'review',
  review:    'approved',
  approved:  'archived',
  archived:  null,
};

const TOR_PREV_STATUS: Partial<Record<TorStatus, TorStatus>> = {
  review: 'draft',
};

export interface ToRBrief {
  procurement_kind: ProcurementKind;
  budget_minor: number;
  currency: string;
  scope: string;                 // free-text scope of work
  deliverables: string[];
  qualifications?: string[];     // vendor must-haves
  timeline?: { start?: string; end?: string };
  evaluation_method?: 'lowest_price' | 'most_advantageous';
}

/**
 * NirvaGov — Thai government TOR (เอกสารกำหนดราคากลาง / ขอบเขตงาน).
 *
 * Workflow:
 *   1. Procurement officer fills in a structured brief.
 *   2. Service composes the brief into the chosen template and asks an AI
 *      to expand into proper Thai government prose.
 *   3. Returns a draft + a compliance checklist (e.g. must have ราคากลาง,
 *      must specify วิธีการจัดซื้อจัดจ้าง). UI shows red/green flags.
 *
 * The "real" template library and rule checks live in tor_templates +
 * code: production should ship a curated set after legal review.
 */
@Injectable()
export class GovService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly openai: OpenAiProvider,
    private readonly pr: PrService,
  ) {}

  listTemplates(user: CurrentUser) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `SELECT id, name, procurement_kind, is_official
         FROM tor_templates WHERE deleted_at IS NULL ORDER BY name`,
      );
      return r.rows;
    });
  }

  listDrafts(user: CurrentUser) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `SELECT id, title, status, brief_json, created_at
         FROM tor_drafts
         ORDER BY created_at DESC
         LIMIT 100`,
      );
      return r.rows.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        procurement_kind: (row.brief_json as ToRBrief).procurement_kind,
        status: mapTorListStatus(row.status as string),
        created_at: row.created_at as string,
      }));
    });
  }

  async createDraft(
    user: CurrentUser,
    body: { title: string; brief: ToRBrief; template_id?: string },
  ) {
    const checklist = this.runChecklist(body.brief);
    const aiBody = await this.generateBody(body.title, body.brief);

    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `INSERT INTO tor_drafts
           (org_id, template_id, title, brief_json, body_markdown, compliance_checklist, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, title, status, body_markdown, compliance_checklist, created_at`,
        [
          user.orgId, body.template_id ?? null, body.title,
          JSON.stringify(body.brief), aiBody, JSON.stringify(checklist), user.userId,
        ],
      );
      return r.rows[0];
    });
  }

  getDraft(user: CurrentUser, id: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `SELECT d.id, d.title, d.status, d.body_markdown, d.compliance_checklist, d.created_at,
                d.linked_pr_id, pr.pr_number AS linked_pr_number
         FROM tor_drafts d
         LEFT JOIN purchase_requests pr ON pr.id = d.linked_pr_id
         WHERE d.id = $1`, [id],
      );
      if (r.rowCount === 0) throw new NotFoundException();
      return r.rows[0];
    });
  }

  async createPrFromTor(user: CurrentUser, id: string) {
    const row = await withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `SELECT id, title, status, body_markdown, compliance_checklist, created_at,
                brief_json, linked_pr_id
         FROM tor_drafts WHERE id = $1`, [id],
      );
      if (r.rowCount === 0) throw new NotFoundException();
      return r.rows[0];
    });

    const status = row.status as TorStatus;
    if (status !== 'approved') {
      throw new BadRequestException('PR can only be created from an approved TOR');
    }
    if (row.linked_pr_id) {
      throw new ConflictException('A purchase request already exists for this TOR');
    }

    const brief = row.brief_json as ToRBrief;
    const pr = await this.pr.create(user, this.buildPrPayloadFromTor(id, row.title as string, brief));

    const updated = await withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `UPDATE tor_drafts SET linked_pr_id = $2, updated_at = now()
         WHERE id = $1
         RETURNING id, title, status, body_markdown, compliance_checklist, created_at, linked_pr_id`,
        [id, pr.id],
      );
      return { ...r.rows[0], linked_pr_number: pr.pr_number };
    });

    return updated;
  }

  advanceDraftStatus(user: CurrentUser, id: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const cur = await c.query(
        `SELECT status FROM tor_drafts WHERE id = $1`, [id],
      );
      if (cur.rowCount === 0) throw new NotFoundException();
      const current = cur.rows[0].status as TorStatus;
      const next = TOR_NEXT_STATUS[current];
      if (!next) throw new BadRequestException('TOR is already at the final status');

      const r = await c.query(
        `UPDATE tor_drafts SET status = $2, updated_at = now()
         WHERE id = $1
         RETURNING id, title, status, body_markdown, compliance_checklist, created_at`,
        [id, next],
      );
      return r.rows[0];
    });
  }

  revertDraftStatus(user: CurrentUser, id: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const cur = await c.query(
        `SELECT status FROM tor_drafts WHERE id = $1`, [id],
      );
      if (cur.rowCount === 0) throw new NotFoundException();
      const current = cur.rows[0].status as TorStatus;
      const prev = TOR_PREV_STATUS[current];
      if (!prev) throw new BadRequestException('TOR cannot be sent back from this status');

      const r = await c.query(
        `UPDATE tor_drafts SET status = $2, updated_at = now()
         WHERE id = $1
         RETURNING id, title, status, body_markdown, compliance_checklist, created_at`,
        [id, prev],
      );
      return r.rows[0];
    });
  }

  updateDraftBody(user: CurrentUser, id: string, body_markdown: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const cur = await c.query(
        `SELECT status, compliance_checklist, brief_json FROM tor_drafts WHERE id = $1`, [id],
      );
      if (cur.rowCount === 0) throw new NotFoundException();
      const status = cur.rows[0].status as TorStatus;
      if (status !== 'draft' && status !== 'review') {
        throw new BadRequestException('TOR body can only be edited while draft or in review');
      }

      const brief = cur.rows[0].brief_json as ToRBrief;
      const checklist = this.patchChecklistFromBody(
        cur.rows[0].compliance_checklist ?? {},
        body_markdown,
        brief?.procurement_kind,
      );

      const r = await c.query(
        `UPDATE tor_drafts SET body_markdown = $2, compliance_checklist = $3, updated_at = now()
         WHERE id = $1
         RETURNING id, title, status, body_markdown, compliance_checklist, created_at`,
        [id, body_markdown, JSON.stringify(checklist)],
      );
      return r.rows[0];
    });
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private buildPrPayloadFromTor(torId: string, title: string, brief: ToRBrief) {
    const justification = `สร้างจาก ToR (${torId})\n\n${brief.scope ?? ''}`;
    const deliverables = brief.deliverables?.length ? brief.deliverables : [brief.scope?.slice(0, 2000) || title];
    const n = deliverables.length;
    const base = Math.floor(brief.budget_minor / n);

    return {
      title,
      justification,
      items: deliverables.map((description, i) => ({
        description,
        quantity: 1,
        unit: 'รายการ',
        unit_price_minor: i === n - 1 ? brief.budget_minor - base * (n - 1) : base,
        source: 'manual' as const,
        source_metadata: { tor_draft_id: torId },
      })),
    };
  }

  private runChecklist(brief: ToRBrief): Record<string, 'passed' | 'failed' | 'na'> {
    return {
      // Mandatory fields per Thai government procurement regs (simplified).
      has_scope:              brief.scope?.trim().length > 30          ? 'passed' : 'failed',
      has_budget:             brief.budget_minor > 0                    ? 'passed' : 'failed',
      has_deliverables:       (brief.deliverables?.length ?? 0) > 0     ? 'passed' : 'failed',
      has_evaluation_method:  brief.evaluation_method                   ? 'passed' : 'failed',
      has_timeline:           !!(brief.timeline?.start && brief.timeline?.end) ? 'passed' : 'failed',
      // Construction projects MUST list qualified vendor criteria.
      has_qualifications:     brief.procurement_kind === 'construction'
        ? ((brief.qualifications?.length ?? 0) > 0 ? 'passed' : 'failed')
        : 'na',
    };
  }

  private patchChecklistFromBody(
    checklist: Record<string, 'passed' | 'failed' | 'na'>,
    body: string,
    procurementKind?: ProcurementKind,
  ): Record<string, 'passed' | 'failed' | 'na'> {
    const trimmed = body.trim();
    const scanned: Record<string, 'passed' | 'failed' | 'na'> = {
      has_scope: (trimmed.length > 80 || (/ขอบเขต|scope/i.test(trimmed) && trimmed.length > 30))
        ? 'passed' : 'failed',
      has_budget: /งบประมาณ|ราคากลาง|วงเงิน|budget|THB|บาท/i.test(trimmed) || /\d{1,3}(,\d{3})+/.test(trimmed)
        ? 'passed' : 'failed',
      has_deliverables: /ส่งมอบ|deliverable|รายการ|^\s*[-*•]/m.test(trimmed)
        ? 'passed' : 'failed',
      has_evaluation_method: /เกณฑ์การพิจารณา|evaluation|ราคาต่ำสุด|most.advantageous|lowest.price/i.test(trimmed)
        ? 'passed' : 'failed',
      has_timeline: /ระยะเวลา|timeline|เดือน|วัน|start|end/i.test(trimmed) || /\d{4}-\d{2}-\d{2}/.test(trimmed)
        ? 'passed' : 'failed',
      has_qualifications: procurementKind === 'construction'
        ? (/คุณสมบัติ|qualification/i.test(trimmed) ? 'passed' : 'failed')
        : 'na',
    };

    const next = { ...checklist };
    for (const key of Object.keys(scanned)) {
      const current = next[key];
      const fresh = scanned[key];
      if (fresh === 'na') continue;
      if (current === 'na' && key !== 'has_qualifications') continue;
      if (key === 'has_qualifications' && current === 'na' && procurementKind !== 'construction') continue;
      next[key] = fresh;
    }
    return next;
  }

  private async generateBody(title: string, brief: ToRBrief): Promise<string> {
    // Long context prompt → use Claude when available; OpenAI is fine for
    // this length. The provider abstracts that choice.
    const system = [
      `You are a Thai government procurement specialist. Draft a formal TOR`,
      `(เอกสารขอบเขตของงาน) in Thai based on the brief below.`,
      ``,
      `Required sections, in this order:`,
      `  ๑. ความเป็นมา`,
      `  ๒. วัตถุประสงค์`,
      `  ๓. คุณสมบัติของผู้ยื่นข้อเสนอ`,
      `  ๔. ขอบเขตของงาน (พร้อมรายละเอียดของงานที่ส่งมอบ)`,
      `  ๕. ระยะเวลาดำเนินการ`,
      `  ๖. ราคากลาง / วงเงินงบประมาณ`,
      `  ๗. เกณฑ์การพิจารณา`,
      `  ๘. เงื่อนไขอื่นๆ`,
      ``,
      `Write in formal Thai (ใช้คำราชการ). Output Markdown only.`,
    ].join('\n');

    const user = JSON.stringify({ title, brief }, null, 2);
    return this.openai.chat(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { model: 'gpt-4o-mini', maxTokens: 2000 },
    );
  }
}

/** Map DB tor_status to the simplified labels the list UI expects. */
function mapTorListStatus(db: string): 'draft' | 'review' | 'approved' | 'published' {
  if (db === 'approved') return 'approved';
  if (db === 'archived') return 'published';
  if (db === 'review') return 'review';
  return 'draft';
}
