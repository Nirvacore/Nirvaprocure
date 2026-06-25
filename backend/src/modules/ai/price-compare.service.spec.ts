import { BadGatewayException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PriceCompareService, PriceCompareInput, PriceCompareResult } from './price-compare.service';
import { OpenAiProvider } from './openai.provider';

/* ── Valid AI response fixture ─────────────────────────────────────────────── */
const validResult: PriceCompareResult = {
  recommended_choice: {
    source: 'shopee',
    url: 'https://shopee.co.th/product/12345',
    unit_price_minor: 35000,
    supplier_name: 'Quality Parts Co.',
  },
  reasoning: 'Quality Parts Co. has the lowest price among trusted suppliers and appears in historical POs.',
  savings_vs_median_minor: 5000,
  watch_outs: ['Supplier has limited reviews on Shopee'],
};

/* ── Standard input fixture ─────────────────────────────────────────────── */
const input: PriceCompareInput = {
  item_name: 'Steel Bolt M10x50',
  currency: 'THB',
  marketplace_listings: [
    {
      source: 'shopee',
      url: 'https://shopee.co.th/product/12345',
      price_minor: 35000,
      currency: 'THB',
      supplier_name: 'Quality Parts Co.',
    },
    {
      source: 'lazada',
      url: 'https://lazada.co.th/product/67890',
      price_minor: 42000,
      currency: 'THB',
      supplier_name: 'Industrial Supply Ltd.',
    },
  ],
  historical_pos: [
    {
      date: '2026-01-15',
      supplier_name: 'Quality Parts Co.',
      unit_price_minor: 40000,
      currency: 'THB',
    },
    {
      date: '2025-11-03',
      supplier_name: 'Hardware Direct',
      unit_price_minor: 38000,
      currency: 'THB',
    },
  ],
};

describe('PriceCompareService', () => {
  let svc: PriceCompareService;
  let chatFn: jest.Mock;

  beforeEach(async () => {
    chatFn = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        PriceCompareService,
        { provide: OpenAiProvider, useValue: { chat: chatFn } },
      ],
    }).compile();
    svc = mod.get(PriceCompareService);
  });

  // ── Happy path ──────────────────────────────────────────────────────────

  it('returns parsed result when AI responds with valid JSON', async () => {
    chatFn.mockResolvedValue(JSON.stringify(validResult));
    const result = await svc.compare(input);

    expect(result.recommended_choice.source).toBe('shopee');
    expect(result.recommended_choice.unit_price_minor).toBe(35000);
    expect(result.reasoning).toContain('Quality Parts');
    expect(result.savings_vs_median_minor).toBe(5000);
    expect(result.watch_outs).toHaveLength(1);
  });

  it('passes item_name and currency into system prompt via OpenAI call', async () => {
    chatFn.mockResolvedValue(JSON.stringify(validResult));
    await svc.compare(input);

    expect(chatFn).toHaveBeenCalledTimes(1);
    const [messages, opts] = chatFn.mock.calls[0];

    // system message mentions the item and currency
    const systemContent: string = messages[0].content;
    expect(systemContent).toContain('Steel Bolt M10x50');
    expect(systemContent).toContain('THB');

    // user message is the JSON payload
    const userPayload = JSON.parse(messages[1].content);
    expect(userPayload.item_name).toBe('Steel Bolt M10x50');
    expect(userPayload.marketplace_listings).toHaveLength(2);
    expect(userPayload.historical_pos).toHaveLength(2);
  });

  it('requests JSON mode and uses gpt-4o-mini model', async () => {
    chatFn.mockResolvedValue(JSON.stringify(validResult));
    await svc.compare(input);

    const opts = chatFn.mock.calls[0][1];
    expect(opts.jsonMode).toBe(true);
    expect(opts.model).toBe('gpt-4o-mini');
    expect(opts.template).toBe('price_compare_v1');
  });

  it('handles result with empty watch_outs array', async () => {
    const noWarnings = { ...validResult, watch_outs: [] };
    chatFn.mockResolvedValue(JSON.stringify(noWarnings));
    const result = await svc.compare(input);
    expect(result.watch_outs).toEqual([]);
  });

  it('handles result with zero savings', async () => {
    const noSavings = { ...validResult, savings_vs_median_minor: 0 };
    chatFn.mockResolvedValue(JSON.stringify(noSavings));
    const result = await svc.compare(input);
    expect(result.savings_vs_median_minor).toBe(0);
  });

  it('handles negative savings (above median price)', async () => {
    const aboveMedian = { ...validResult, savings_vs_median_minor: -3000 };
    chatFn.mockResolvedValue(JSON.stringify(aboveMedian));
    const result = await svc.compare(input);
    expect(result.savings_vs_median_minor).toBe(-3000);
  });

  // ── Non-JSON response ────────────────────────────────────────────────────

  it('throws BadGatewayException when AI returns non-JSON', async () => {
    chatFn.mockResolvedValue('Sorry, I cannot process this request.');
    await expect(svc.compare(input)).rejects.toThrow(BadGatewayException);
    await expect(svc.compare(input)).rejects.toThrow('AI response was not valid JSON');
  });

  it('throws BadGatewayException when AI returns empty string', async () => {
    chatFn.mockResolvedValue('');
    await expect(svc.compare(input)).rejects.toThrow(BadGatewayException);
  });

  it('throws BadGatewayException when AI returns HTML', async () => {
    chatFn.mockResolvedValue('<html><body>Error 503</body></html>');
    await expect(svc.compare(input)).rejects.toThrow(BadGatewayException);
  });

  // ── Malformed schema ────────────────────────────────────────────────────

  it('throws BadGatewayException when response is valid JSON but missing recommended_choice', async () => {
    const malformed = {
      reasoning: 'Some reasoning',
      savings_vs_median_minor: 100,
      watch_outs: [],
    };
    chatFn.mockResolvedValue(JSON.stringify(malformed));
    await expect(svc.compare(input)).rejects.toThrow(BadGatewayException);
    await expect(svc.compare(input)).rejects.toThrow('AI response missing required fields');
  });

  it('throws BadGatewayException when response is missing reasoning', async () => {
    const noReasoning = {
      recommended_choice: validResult.recommended_choice,
      savings_vs_median_minor: 100,
      watch_outs: [],
    };
    chatFn.mockResolvedValue(JSON.stringify(noReasoning));
    await expect(svc.compare(input)).rejects.toThrow(BadGatewayException);
  });

  it('throws BadGatewayException when reasoning is not a string', async () => {
    const badReasoning = {
      ...validResult,
      reasoning: 42,
    };
    chatFn.mockResolvedValue(JSON.stringify(badReasoning));
    await expect(svc.compare(input)).rejects.toThrow(BadGatewayException);
  });

  it('throws BadGatewayException when savings is not a number', async () => {
    const badSavings = {
      ...validResult,
      savings_vs_median_minor: 'five thousand',
    };
    chatFn.mockResolvedValue(JSON.stringify(badSavings));
    await expect(svc.compare(input)).rejects.toThrow(BadGatewayException);
  });

  it('throws BadGatewayException when watch_outs is not an array', async () => {
    const badWatchOuts = {
      ...validResult,
      watch_outs: 'some warning',
    };
    chatFn.mockResolvedValue(JSON.stringify(badWatchOuts));
    await expect(svc.compare(input)).rejects.toThrow(BadGatewayException);
  });

  it('throws BadGatewayException when response is JSON null', async () => {
    chatFn.mockResolvedValue('null');
    await expect(svc.compare(input)).rejects.toThrow(BadGatewayException);
  });

  it('throws BadGatewayException when response is a JSON array', async () => {
    chatFn.mockResolvedValue('[]');
    await expect(svc.compare(input)).rejects.toThrow(BadGatewayException);
  });

  // ── OpenAI provider errors ──────────────────────────────────────────────

  it('propagates error when OpenAI provider throws', async () => {
    chatFn.mockRejectedValue(new Error('OpenAI 429: Rate limited'));
    await expect(svc.compare(input)).rejects.toThrow('OpenAI 429: Rate limited');
  });

  it('propagates network errors', async () => {
    chatFn.mockRejectedValue(new Error('fetch failed'));
    await expect(svc.compare(input)).rejects.toThrow('fetch failed');
  });

  // ── Different marketplace sources ───────────────────────────────────────

  it('works with all supported marketplace sources', async () => {
    const allSources: PriceCompareInput = {
      ...input,
      marketplace_listings: [
        { source: 'shopee', url: 'https://shopee.co.th/1', price_minor: 30000, currency: 'THB' },
        { source: 'lazada', url: 'https://lazada.co.th/2', price_minor: 32000, currency: 'THB' },
        { source: 'makro', url: 'https://makro.co.th/3', price_minor: 28000, currency: 'THB' },
        { source: 'alibaba', url: 'https://alibaba.com/4', price_minor: 25000, currency: 'THB' },
      ],
    };
    const makroResult = {
      ...validResult,
      recommended_choice: { ...validResult.recommended_choice, source: 'makro' as const },
    };
    chatFn.mockResolvedValue(JSON.stringify(makroResult));
    const result = await svc.compare(allSources);
    expect(result.recommended_choice.source).toBe('makro');
  });

  it('works with empty historical POs', async () => {
    const noHistory = { ...input, historical_pos: [] };
    chatFn.mockResolvedValue(JSON.stringify(validResult));
    const result = await svc.compare(noHistory);

    // Verify the user payload sent to AI includes empty historical_pos
    const userPayload = JSON.parse(chatFn.mock.calls[0][0][1].content);
    expect(userPayload.historical_pos).toEqual([]);
    expect(result).toBeDefined();
  });

  it('works with single marketplace listing', async () => {
    const singleListing = {
      ...input,
      marketplace_listings: [input.marketplace_listings[0]],
    };
    chatFn.mockResolvedValue(JSON.stringify(validResult));
    await svc.compare(singleListing);

    const userPayload = JSON.parse(chatFn.mock.calls[0][0][1].content);
    expect(userPayload.marketplace_listings).toHaveLength(1);
  });

  // ── System prompt rules ─────────────────────────────────────────────────

  it('system prompt includes counterfeit risk rule', async () => {
    chatFn.mockResolvedValue(JSON.stringify(validResult));
    await svc.compare(input);

    const systemContent: string = chatFn.mock.calls[0][0][0].content;
    expect(systemContent).toContain('40% below the median');
    expect(systemContent).toContain('counterfeit risk');
  });

  it('system prompt includes supplier reliability preference', async () => {
    chatFn.mockResolvedValue(JSON.stringify(validResult));
    await svc.compare(input);

    const systemContent: string = chatFn.mock.calls[0][0][0].content;
    expect(systemContent).toContain('Prefer suppliers that appear in historical_pos');
  });

  it('system prompt enforces strict JSON output', async () => {
    chatFn.mockResolvedValue(JSON.stringify(validResult));
    await svc.compare(input);

    const systemContent: string = chatFn.mock.calls[0][0][0].content;
    expect(systemContent).toContain('STRICT JSON only');
  });

  it('system prompt specifies minor units for monetary values', async () => {
    chatFn.mockResolvedValue(JSON.stringify(validResult));
    await svc.compare(input);

    const systemContent: string = chatFn.mock.calls[0][0][0].content;
    expect(systemContent).toContain('minor');
    expect(systemContent).toContain('satang');
  });
});
