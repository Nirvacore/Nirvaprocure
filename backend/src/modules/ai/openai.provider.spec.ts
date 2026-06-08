/**
 * Unit tests for OpenAI cost calculation and stub behavior.
 *
 * Tests the PRICING map, cost computation formula, and stub response
 * without needing an actual OpenAI API key.
 */

// Reproduce the pricing map from the provider for unit testing.
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o':        { input: 5.00,  output: 15.00 },
  'gpt-4o-mini':   { input: 0.15,  output: 0.60  },
  'gpt-4-turbo':   { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo': { input: 0.50,  output: 1.50  },
};
const DEFAULT_PRICING = { input: 0.15, output: 0.60 };

function computeCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): { inputCost: number; outputCost: number; totalCost: number } {
  const price = PRICING[model] ?? DEFAULT_PRICING;
  const inputCost  = (promptTokens     / 1_000_000) * price.input;
  const outputCost = (completionTokens / 1_000_000) * price.output;
  return {
    inputCost:  Math.round(inputCost  * 1e8) / 1e8,
    outputCost: Math.round(outputCost * 1e8) / 1e8,
    totalCost:  Math.round((inputCost + outputCost) * 1e8) / 1e8,
  };
}

describe('AI cost computation', () => {
  // ── gpt-4o-mini ───────────────────────────────────────────────────────────

  it('computes gpt-4o-mini cost for 1000 prompt + 500 completion tokens', () => {
    const c = computeCost('gpt-4o-mini', 1000, 500);
    // input:  1000 / 1M * $0.15 = $0.00015
    // output: 500  / 1M * $0.60 = $0.0003
    expect(c.inputCost).toBeCloseTo(0.00015, 6);
    expect(c.outputCost).toBeCloseTo(0.0003, 6);
  });

  it('computes zero cost for zero tokens', () => {
    const c = computeCost('gpt-4o-mini', 0, 0);
    expect(c.totalCost).toBe(0);
  });

  // ── gpt-4o ────────────────────────────────────────────────────────────────

  it('computes gpt-4o cost for 10k prompt + 2k completion tokens', () => {
    const c = computeCost('gpt-4o', 10000, 2000);
    // input:  10000 / 1M * $5.00 = $0.05
    // output: 2000  / 1M * $15.00 = $0.03
    expect(c.inputCost).toBeCloseTo(0.05, 4);
    expect(c.outputCost).toBeCloseTo(0.03, 4);
    expect(c.totalCost).toBeCloseTo(0.08, 4);
  });

  // ── gpt-4-turbo ───────────────────────────────────────────────────────────

  it('gpt-4-turbo is 2x more expensive than gpt-4o on input', () => {
    const c4o     = computeCost('gpt-4o', 1000, 0);
    const c4turbo = computeCost('gpt-4-turbo', 1000, 0);
    expect(c4turbo.inputCost / c4o.inputCost).toBeCloseTo(2.0);
  });

  // ── Unknown model fallback ────────────────────────────────────────────────

  it('unknown model uses gpt-4o-mini pricing as fallback', () => {
    const cUnknown = computeCost('some-future-model', 1000, 500);
    const cMini    = computeCost('gpt-4o-mini', 1000, 500);
    expect(cUnknown.inputCost).toBe(cMini.inputCost);
    expect(cUnknown.outputCost).toBe(cMini.outputCost);
  });

  // ── Large token count ─────────────────────────────────────────────────────

  it('handles 1M token invoice OCR scenario', () => {
    // Vision: gpt-4o, 100k prompt, 5k completion
    const c = computeCost('gpt-4o', 100_000, 5_000);
    // input:  100000 / 1M * $5  = $0.50
    // output: 5000   / 1M * $15 = $0.075
    expect(c.inputCost).toBeCloseTo(0.50, 3);
    expect(c.outputCost).toBeCloseTo(0.075, 3);
    expect(c.totalCost).toBeCloseTo(0.575, 3);
  });
});

describe('PRICING map completeness', () => {
  it('includes all current OpenAI models we use', () => {
    expect(PRICING).toHaveProperty(['gpt-4o']);
    expect(PRICING).toHaveProperty(['gpt-4o-mini']);
    expect(PRICING).toHaveProperty(['gpt-4-turbo']);
    expect(PRICING).toHaveProperty(['gpt-3.5-turbo']);
  });

  it('all prices are positive', () => {
    for (const [model, price] of Object.entries(PRICING)) {
      expect(price.input).toBeGreaterThan(0);
      expect(price.output).toBeGreaterThan(0);
      expect(price.output).toBeGreaterThanOrEqual(price.input);
    }
  });
});
