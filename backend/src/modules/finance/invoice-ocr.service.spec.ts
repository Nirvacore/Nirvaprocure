/**
 * Unit tests for InvoiceOcrService.
 *
 * The service delegates OCR to OpenAI vision (or a stub when
 * OPENAI_API_KEY is absent). We test:
 *   - Successful extraction with valid OCR responses
 *   - Validation logic (isValidOcr) rejecting malformed payloads
 *   - Stub fallback when no API key is set
 *   - recordRun called with correct metering data
 *   - Error handling for missing required fields
 */

import { Test } from '@nestjs/testing';
import { BadGatewayException } from '@nestjs/common';
import { InvoiceOcrService, OcrInvoiceResult } from './invoice-ocr.service';
import { OpenAiProvider } from '../ai/openai.provider';

// ── helpers ─────────────────────────────────────────────────────────────────

function validOcrPayload(overrides: Partial<OcrInvoiceResult> = {}): OcrInvoiceResult {
  return {
    supplier_name: 'Acme Corp',
    invoice_number: 'INV-2026-0042',
    date: '2026-06-01',
    currency: 'THB',
    subtotal_minor: 500000,
    tax_minor: 35000,
    total_minor: 535000,
    items: [
      { description: 'Widget A', quantity: 10, unit_price_minor: 50000, line_total_minor: 500000 },
    ],
    warnings: [],
    ...overrides,
  };
}

function makeMockOpenAiProvider() {
  return {
    recordRun: jest.fn().mockResolvedValue(undefined),
  };
}

// We need to mock the module-level `callVision` function. Since it's a
// plain function (not injected), we mock the `global.fetch` that it uses
// internally, plus control the OPENAI_API_KEY env var.

describe('InvoiceOcrService', () => {
  let service: InvoiceOcrService;
  let openaiProvider: ReturnType<typeof makeMockOpenAiProvider>;
  const originalEnv = process.env;

  beforeEach(async () => {
    openaiProvider = makeMockOpenAiProvider();

    const mod = await Test.createTestingModule({
      providers: [
        InvoiceOcrService,
        { provide: OpenAiProvider, useValue: openaiProvider },
      ],
    }).compile();

    service = mod.get(InvoiceOcrService);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  // ── STUB path (no OPENAI_API_KEY) ───────────────────────────────────────

  describe('when OPENAI_API_KEY is NOT set', () => {
    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.OPENAI_API_KEY;
    });

    it('returns a stub response with valid structure', async () => {
      const result = await service.extract('data:image/png;base64,iVBOR...');

      expect(result.supplier_name).toBe('STUB Supplier');
      expect(result.invoice_number).toBe('INV-STUB-0001');
      expect(result.currency).toBe('THB');
      expect(result.total_minor).toBe(107000);
      expect(result.items).toHaveLength(1);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('STUB')]),
      );
    });

    it('records run with zero tokens for stub', async () => {
      await service.extract('data:image/png;base64,abc', 'THB', { orgId: 'org-1', userId: 'u-1' });

      expect(openaiProvider.recordRun).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          userId: 'u-1',
          template: 'invoice_ocr_v1',
          model: 'gpt-4o-mini',
        }),
      );
    });

    it('uses default currency THB when not specified', async () => {
      const result = await service.extract('data:image/png;base64,abc');
      expect(result.currency).toBe('THB');
    });
  });

  // ── Real API path (mocked fetch) ───────────────────────────────────────

  describe('when OPENAI_API_KEY IS set', () => {
    beforeEach(() => {
      process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-test-key-123' };
    });

    it('parses a valid OCR response from OpenAI', async () => {
      const payload = validOcrPayload();
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(payload) } }],
          usage: { prompt_tokens: 800, completion_tokens: 200 },
        }),
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any);

      const result = await service.extract('data:image/png;base64,abc', 'THB', {
        orgId: 'org-1',
        userId: 'u-1',
      });

      expect(result.supplier_name).toBe('Acme Corp');
      expect(result.invoice_number).toBe('INV-2026-0042');
      expect(result.total_minor).toBe(535000);
      expect(result.items).toHaveLength(1);
      expect(result.warnings).toEqual([]);
    });

    it('passes currency to the system prompt via user message', async () => {
      const payload = validOcrPayload({ currency: 'USD' });
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(payload) } }],
          usage: { prompt_tokens: 500, completion_tokens: 100 },
        }),
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any);

      const result = await service.extract('data:image/png;base64,abc', 'USD');

      // Verify the fetch was called with currency in the body
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const userContent = body.messages[1].content;
      expect(userContent[0].text).toContain('Currency: USD');
      expect(result.currency).toBe('USD');
    });

    it('records usage metrics after successful call', async () => {
      const payload = validOcrPayload();
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(payload) } }],
          usage: { prompt_tokens: 1200, completion_tokens: 300 },
        }),
      } as any);

      await service.extract('data:image/png;base64,abc', 'THB', { orgId: 'o1', userId: 'u1' });

      expect(openaiProvider.recordRun).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'o1',
          userId: 'u1',
          template: 'invoice_ocr_v1',
          model: 'gpt-4o-mini',
          promptTokens: 1200,
          completionTokens: 300,
        }),
      );
      // latencyMs should be a positive number
      const call = openaiProvider.recordRun.mock.calls[0][0];
      expect(call.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('throws BadGatewayException when OCR response is missing required fields', async () => {
      // Missing total_minor and items
      const badPayload = { supplier_name: 'Test', currency: 'THB' };
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(badPayload) } }],
          usage: { prompt_tokens: 500, completion_tokens: 50 },
        }),
      } as any);

      await expect(
        service.extract('data:image/png;base64,abc'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws BadGatewayException when items is not an array', async () => {
      const badPayload = { currency: 'THB', total_minor: 100, items: 'not-array', warnings: [] };
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(badPayload) } }],
        }),
      } as any);

      await expect(
        service.extract('data:image/png;base64,abc'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws BadGatewayException when warnings is missing', async () => {
      const badPayload = { currency: 'THB', total_minor: 100, items: [] };
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(badPayload) } }],
        }),
      } as any);

      await expect(
        service.extract('data:image/png;base64,abc'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws when OpenAI returns a non-OK status', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
        text: jest.fn().mockResolvedValue('Rate limit exceeded'),
      } as any);

      await expect(
        service.extract('data:image/png;base64,abc'),
      ).rejects.toThrow(/OpenAI vision 429/);
    });

    it('accepts a response with optional fields set to null', async () => {
      const payload = validOcrPayload({
        supplier_name: undefined,
        invoice_number: undefined,
        date: undefined,
        subtotal_minor: undefined,
        tax_minor: undefined,
      });
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(payload) } }],
          usage: { prompt_tokens: 400, completion_tokens: 80 },
        }),
      } as any);

      const result = await service.extract('data:image/png;base64,abc');

      // Required fields still present
      expect(result.currency).toBe('THB');
      expect(result.total_minor).toBe(535000);
      expect(Array.isArray(result.items)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('handles multiple line items', async () => {
      const payload = validOcrPayload({
        items: [
          { description: 'Part A', quantity: 5, unit_price_minor: 20000, line_total_minor: 100000 },
          { description: 'Part B', quantity: 3, unit_price_minor: 15000, line_total_minor: 45000 },
          { description: 'Part C', quantity: 1, unit_price_minor: 80000, line_total_minor: 80000 },
        ],
        total_minor: 225000,
      });
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(payload) } }],
          usage: { prompt_tokens: 600, completion_tokens: 150 },
        }),
      } as any);

      const result = await service.extract('data:image/png;base64,abc');

      expect(result.items).toHaveLength(3);
      expect(result.total_minor).toBe(225000);
    });

    it('handles missing usage in OpenAI response gracefully', async () => {
      const payload = validOcrPayload();
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(payload) } }],
          // no usage field
        }),
      } as any);

      const result = await service.extract('data:image/png;base64,abc', 'THB', { orgId: 'o1' });

      expect(result.total_minor).toBe(535000);
      // recordRun should get 0 for missing tokens
      expect(openaiProvider.recordRun).toHaveBeenCalledWith(
        expect.objectContaining({
          promptTokens: 0,
          completionTokens: 0,
        }),
      );
    });
  });
});

// ── isValidOcr logic (tested indirectly via extract) ──────────────────────

describe('isValidOcr validation (via service)', () => {
  let service: InvoiceOcrService;

  beforeEach(async () => {
    process.env = { ...process.env, OPENAI_API_KEY: 'sk-test' };
    const mod = await Test.createTestingModule({
      providers: [
        InvoiceOcrService,
        { provide: OpenAiProvider, useValue: { recordRun: jest.fn() } },
      ],
    }).compile();
    service = mod.get(InvoiceOcrService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const rejectCases: Array<[string, unknown]> = [
    ['null response',     null],
    ['non-object',        'just a string'],
    ['missing currency',  { total_minor: 100, items: [], warnings: [] }],
    ['missing total',     { currency: 'THB', items: [], warnings: [] }],
    ['non-string currency', { currency: 123, total_minor: 100, items: [], warnings: [] }],
    ['non-number total',  { currency: 'THB', total_minor: '100', items: [], warnings: [] }],
    ['items not array',   { currency: 'THB', total_minor: 100, items: {}, warnings: [] }],
    ['warnings not array', { currency: 'THB', total_minor: 100, items: [], warnings: 'none' }],
  ];

  for (const [label, payload] of rejectCases) {
    it(`rejects ${label}`, async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(payload) } }],
        }),
      } as any);

      await expect(service.extract('data:image/png;base64,abc')).rejects.toThrow(
        BadGatewayException,
      );
    });
  }

  it('accepts minimal valid payload (empty items, empty warnings)', async () => {
    const minimal = { currency: 'THB', total_minor: 0, items: [], warnings: [] };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(minimal) } }],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      }),
    } as any);

    const result = await service.extract('data:image/png;base64,abc');
    expect(result.currency).toBe('THB');
    expect(result.total_minor).toBe(0);
  });
});
