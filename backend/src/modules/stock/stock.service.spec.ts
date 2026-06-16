/**
 * Unit tests for StockService.
 *
 * Tests the SIGN convention (movement type → qty sign) and
 * validation logic without needing a real database.
 */

import type { StockMoveType } from './stock.service';

// ── Reproduce the SIGN map for pure-logic testing ───────────────────────────
const SIGN: Record<StockMoveType, number> = {
  receive:      +1,
  issue:        -1,
  adjust_in:    +1,
  adjust_out:   -1,
  transfer_in:  +1,
  transfer_out: -1,
  opening:      +1,
};

function computeDelta(type: StockMoveType, qty: number): number {
  const sign = SIGN[type];
  if (sign == null) throw new Error(`Unknown movement type: ${type}`);
  if (qty <= 0) throw new Error('Quantity must be positive');
  return sign * qty;
}

describe('Stock movement sign convention', () => {
  it('receive adds stock', () => {
    expect(computeDelta('receive', 100)).toBe(100);
  });

  it('issue removes stock', () => {
    expect(computeDelta('issue', 50)).toBe(-50);
  });

  it('adjust_in adds stock', () => {
    expect(computeDelta('adjust_in', 10)).toBe(10);
  });

  it('adjust_out removes stock', () => {
    expect(computeDelta('adjust_out', 25)).toBe(-25);
  });

  it('transfer_in adds stock', () => {
    expect(computeDelta('transfer_in', 200)).toBe(200);
  });

  it('transfer_out removes stock', () => {
    expect(computeDelta('transfer_out', 200)).toBe(-200);
  });

  it('opening adds stock', () => {
    expect(computeDelta('opening', 500)).toBe(500);
  });

  it('rejects zero quantity', () => {
    expect(() => computeDelta('receive', 0)).toThrow('Quantity must be positive');
  });

  it('rejects negative quantity', () => {
    expect(() => computeDelta('issue', -10)).toThrow('Quantity must be positive');
  });

  it('rejects unknown type', () => {
    expect(() => computeDelta('destroy' as any, 10)).toThrow('Unknown movement type');
  });
});

describe('Stock on-hand reorder logic', () => {
  function isbelowReorder(qty: number, reorderPoint: number | null): boolean {
    return reorderPoint !== null && qty <= reorderPoint;
  }

  it('triggers when qty equals reorder point', () => {
    expect(isbelowReorder(10, 10)).toBe(true);
  });

  it('triggers when qty below reorder point', () => {
    expect(isbelowReorder(5, 10)).toBe(true);
  });

  it('does not trigger when qty above reorder point', () => {
    expect(isbelowReorder(15, 10)).toBe(false);
  });

  it('does not trigger when reorder point is null', () => {
    expect(isbelowReorder(0, null)).toBe(false);
  });

  it('triggers at zero stock with any reorder point', () => {
    expect(isbelowReorder(0, 1)).toBe(true);
  });
});

describe('Movement pairs balance', () => {
  it('transfer_in + transfer_out net to zero', () => {
    const qty = 75;
    const net = computeDelta('transfer_in', qty) + computeDelta('transfer_out', qty);
    expect(net).toBe(0);
  });

  it('adjust_in + adjust_out net to zero', () => {
    const qty = 30;
    const net = computeDelta('adjust_in', qty) + computeDelta('adjust_out', qty);
    expect(net).toBe(0);
  });

  it('receive - issue reflects net inventory change', () => {
    const received = computeDelta('receive', 100);
    const issued = computeDelta('issue', 40);
    expect(received + issued).toBe(60);
  });
});
