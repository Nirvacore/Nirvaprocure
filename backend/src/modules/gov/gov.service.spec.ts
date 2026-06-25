import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GovService, ToRBrief } from './gov.service';
import { PG_POOL } from '../../common/db/db.module';
import { OpenAiProvider } from '../ai/openai.provider';

const ORG_ID = 'org-1';
const USER = { orgId: ORG_ID, userId: 'u-1', email: 'test@test.com', role: 'admin' } as any;

function mockPool(queryResponses: any[]) {
  let callIdx = 0;
  const mockClient = {
    query: jest.fn().mockImplementation(() => {
      const resp = queryResponses[callIdx] ?? { rows: [], rowCount: 0 };
      callIdx++;
      return Promise.resolve(resp);
    }),
    release: jest.fn(),
  };
  return { connect: jest.fn().mockResolvedValue(mockClient), client: mockClient };
}

function validBrief(overrides: Partial<ToRBrief> = {}): ToRBrief {
  return {
    procurement_kind: 'goods',
    budget_minor: 500_000,
    currency: 'THB',
    scope: 'จัดซื้อวัสดุสำนักงานเพื่อใช้ในหน่วยงานภายในรอบไตรมาสที่ 3',
    deliverables: ['วัสดุสำนักงาน 50 รายการ'],
    qualifications: undefined,
    timeline: { start: '2026-07-01', end: '2026-09-30' },
    evaluation_method: 'lowest_price',
    ...overrides,
  };
}

describe('GovService', () => {
  let service: GovService;
  let pool: ReturnType<typeof mockPool>;
  let openaiMock: { chat: jest.Mock };

  // ── listTemplates ─────────────────────────────────────────────────────────

  describe('listTemplates', () => {
    const templateRows = [
      { id: 'tpl-1', name: 'Standard TOR', procurement_kind: 'goods', is_official: true },
      { id: 'tpl-2', name: 'Construction TOR', procurement_kind: 'construction', is_official: false },
    ];

    beforeEach(async () => {
      pool = mockPool([
        { rows: [] }, // BEGIN
        { rows: [] }, // SET LOCAL
        { rows: templateRows, rowCount: 2 }, // SELECT
        { rows: [] }, // COMMIT
      ]);
      openaiMock = { chat: jest.fn() };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GovService,
          { provide: PG_POOL, useValue: pool },
          { provide: OpenAiProvider, useValue: openaiMock },
        ],
      }).compile();
      service = module.get(GovService);
    });

    it('should return template list from database', async () => {
      const result = await service.listTemplates(USER);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Standard TOR');
      expect(result[1].procurement_kind).toBe('construction');
    });

    it('should set org context via withOrg transaction', async () => {
      await service.listTemplates(USER);
      // BEGIN, SET LOCAL, SELECT, COMMIT = 4 query calls
      expect(pool.client.query).toHaveBeenCalledTimes(4);
    });
  });

  // ── createDraft ───────────────────────────────────────────────────────────

  describe('createDraft', () => {
    const draftRow = {
      id: 'draft-1',
      title: 'Test TOR',
      status: 'draft',
      body_markdown: '# TOR Content',
      compliance_checklist: '{}',
      created_at: '2026-06-25',
    };

    beforeEach(async () => {
      pool = mockPool([
        { rows: [] }, // BEGIN
        { rows: [] }, // SET LOCAL
        { rows: [draftRow], rowCount: 1 }, // INSERT RETURNING
        { rows: [] }, // COMMIT
      ]);
      openaiMock = { chat: jest.fn().mockResolvedValue('# AI-Generated TOR body') };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GovService,
          { provide: PG_POOL, useValue: pool },
          { provide: OpenAiProvider, useValue: openaiMock },
        ],
      }).compile();
      service = module.get(GovService);
    });

    it('should call OpenAI to generate body then insert draft', async () => {
      const result = await service.createDraft(USER, {
        title: 'Test TOR',
        brief: validBrief(),
      });
      expect(openaiMock.chat).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('draft-1');
      expect(result.title).toBe('Test TOR');
    });

    it('should pass correct model options to OpenAI', async () => {
      await service.createDraft(USER, { title: 'TOR', brief: validBrief() });
      const [messages, opts] = openaiMock.chat.mock.calls[0];
      expect(opts.model).toBe('gpt-4o-mini');
      expect(opts.maxTokens).toBe(2000);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
    });

    it('should include title and brief in the user message to AI', async () => {
      const brief = validBrief();
      await service.createDraft(USER, { title: 'My TOR', brief });
      const userMsg = openaiMock.chat.mock.calls[0][0][1].content;
      expect(userMsg).toContain('My TOR');
      expect(userMsg).toContain(brief.scope);
    });

    it('should include template_id when provided', async () => {
      await service.createDraft(USER, {
        title: 'TOR',
        brief: validBrief(),
        template_id: 'tpl-99',
      });
      // The INSERT query is the 3rd call (after BEGIN + SET LOCAL)
      const insertArgs = pool.client.query.mock.calls[2][1];
      expect(insertArgs[1]).toBe('tpl-99');
    });

    it('should pass null template_id when not provided', async () => {
      await service.createDraft(USER, { title: 'TOR', brief: validBrief() });
      const insertArgs = pool.client.query.mock.calls[2][1];
      expect(insertArgs[1]).toBeNull();
    });
  });

  // ── getDraft ──────────────────────────────────────────────────────────────

  describe('getDraft', () => {
    it('should return draft when found', async () => {
      const draftRow = { id: 'draft-1', title: 'TOR Draft', status: 'draft' };
      pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [draftRow], rowCount: 1 },
        { rows: [] },
      ]);
      openaiMock = { chat: jest.fn() };
      const module = await Test.createTestingModule({
        providers: [
          GovService,
          { provide: PG_POOL, useValue: pool },
          { provide: OpenAiProvider, useValue: openaiMock },
        ],
      }).compile();
      service = module.get(GovService);

      const result = await service.getDraft(USER, 'draft-1');
      expect(result.id).toBe('draft-1');
      expect(result.title).toBe('TOR Draft');
    });

    it('should throw NotFoundException when draft not found', async () => {
      pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);
      openaiMock = { chat: jest.fn() };
      const module = await Test.createTestingModule({
        providers: [
          GovService,
          { provide: PG_POOL, useValue: pool },
          { provide: OpenAiProvider, useValue: openaiMock },
        ],
      }).compile();
      service = module.get(GovService);

      await expect(service.getDraft(USER, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── runChecklist (tested via createDraft internals) ────────────────────────

  describe('runChecklist (via createDraft)', () => {
    /**
     * The checklist is a private method, but we can observe its output
     * via the JSON stringified into the INSERT query params.
     */
    async function extractChecklist(brief: ToRBrief) {
      pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [{ id: 'd-1', title: 't', status: 'draft', body_markdown: '', compliance_checklist: '{}', created_at: '' }], rowCount: 1 },
        { rows: [] },
      ]);
      openaiMock = { chat: jest.fn().mockResolvedValue('body') };
      const module = await Test.createTestingModule({
        providers: [
          GovService,
          { provide: PG_POOL, useValue: pool },
          { provide: OpenAiProvider, useValue: openaiMock },
        ],
      }).compile();
      service = module.get(GovService);

      await service.createDraft(USER, { title: 'T', brief });
      // Checklist is the 6th param (index 5) in the INSERT
      const checklistJson = pool.client.query.mock.calls[2][1][5];
      return JSON.parse(checklistJson);
    }

    it('should pass all checks for a complete brief', async () => {
      const checklist = await extractChecklist(validBrief());
      expect(checklist.has_scope).toBe('passed');
      expect(checklist.has_budget).toBe('passed');
      expect(checklist.has_deliverables).toBe('passed');
      expect(checklist.has_evaluation_method).toBe('passed');
      expect(checklist.has_timeline).toBe('passed');
      expect(checklist.has_qualifications).toBe('na'); // goods, not construction
    });

    it('should fail has_scope when scope is too short (<=30 chars)', async () => {
      const checklist = await extractChecklist(validBrief({ scope: 'short scope' }));
      expect(checklist.has_scope).toBe('failed');
    });

    it('should fail has_budget when budget is 0', async () => {
      const checklist = await extractChecklist(validBrief({ budget_minor: 0 }));
      expect(checklist.has_budget).toBe('failed');
    });

    it('should fail has_deliverables when empty', async () => {
      const checklist = await extractChecklist(validBrief({ deliverables: [] }));
      expect(checklist.has_deliverables).toBe('failed');
    });

    it('should fail has_evaluation_method when undefined', async () => {
      const checklist = await extractChecklist(validBrief({ evaluation_method: undefined }));
      expect(checklist.has_evaluation_method).toBe('failed');
    });

    it('should fail has_timeline when start or end is missing', async () => {
      const noStart = await extractChecklist(validBrief({ timeline: { end: '2026-09-30' } }));
      expect(noStart.has_timeline).toBe('failed');

      const noEnd = await extractChecklist(validBrief({ timeline: { start: '2026-07-01' } }));
      expect(noEnd.has_timeline).toBe('failed');

      const noTimeline = await extractChecklist(validBrief({ timeline: undefined }));
      expect(noTimeline.has_timeline).toBe('failed');
    });

    it('should require qualifications for construction projects', async () => {
      const noQuals = await extractChecklist(
        validBrief({ procurement_kind: 'construction', qualifications: [] }),
      );
      expect(noQuals.has_qualifications).toBe('failed');

      const withQuals = await extractChecklist(
        validBrief({ procurement_kind: 'construction', qualifications: ['License A'] }),
      );
      expect(withQuals.has_qualifications).toBe('passed');
    });

    it('should set has_qualifications to na for services', async () => {
      const checklist = await extractChecklist(validBrief({ procurement_kind: 'services' }));
      expect(checklist.has_qualifications).toBe('na');
    });
  });
});
