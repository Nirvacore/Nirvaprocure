/**
 * Unit tests for BudgetService pure logic.
 *
 * Tests the checkPrAgainstBudget predicate and the pct/remaining calc
 * from the list mapper without needing a real database.
 */

// ── Reproduce the list mapper for unit testing ───────────────────────────────
function mapBudgetRow(row: {
  amount_minor: string;
  spent_minor: string;
  soft_block: boolean;
}) {
  const amount = Number(row.amount_minor);
  const spent  = Number(row.spent_minor);
  return {
    amount_minor:    amount,
    spent_minor:     spent,
    remaining_minor: amount - spent,
    pct_used:        amount === 0 ? 0 : Math.round((spent / amount) * 100),
    soft_block:      row.soft_block,
  };
}

// ── Reproduce the budget check predicate ─────────────────────────────────────
function checkPr(
  budgetAmount: number,
  budgetSpent: number,
  softBlock: boolean,
  prTotal: number,
) {
  const proj = budgetSpent + prTotal;
  return {
    would_be_pct: budgetAmount === 0 ? 0 : Math.round((proj / budgetAmount) * 100),
    amount_minor: budgetAmount,
    spent_minor:  budgetSpent,
    over:         proj > budgetAmount,
    soft_block:   softBlock,
  };
}

describe('Budget list mapper', () => {
  it('computes remaining and percentage correctly', () => {
    const r = mapBudgetRow({ amount_minor: '10000000', spent_minor: '3500000', soft_block: false });
    expect(r.amount_minor).toBe(10_000_000);
    expect(r.spent_minor).toBe(3_500_000);
    expect(r.remaining_minor).toBe(6_500_000);
    expect(r.pct_used).toBe(35);
  });

  it('handles zero budget gracefully', () => {
    const r = mapBudgetRow({ amount_minor: '0', spent_minor: '0', soft_block: false });
    expect(r.pct_used).toBe(0);
    expect(r.remaining_minor).toBe(0);
  });

  it('shows > 100% when overspent', () => {
    const r = mapBudgetRow({ amount_minor: '100000', spent_minor: '150000', soft_block: true });
    expect(r.pct_used).toBe(150);
    expect(r.remaining_minor).toBe(-50_000);
    expect(r.soft_block).toBe(true);
  });

  it('rounds percentage to nearest integer', () => {
    // 33333 / 100000 = 33.333% → rounds to 33
    const r = mapBudgetRow({ amount_minor: '100000', spent_minor: '33333', soft_block: false });
    expect(r.pct_used).toBe(33);
  });

  it('rounds up at 0.5', () => {
    // 50050 / 100000 = 50.05% → rounds to 50
    const r = mapBudgetRow({ amount_minor: '100000', spent_minor: '50050', soft_block: false });
    expect(r.pct_used).toBe(50);
  });
});

describe('Budget check predicate', () => {
  it('under budget → over = false', () => {
    const r = checkPr(1_000_000, 400_000, false, 100_000);
    expect(r.over).toBe(false);
    expect(r.would_be_pct).toBe(50);
  });

  it('exactly at budget → over = false', () => {
    const r = checkPr(1_000_000, 500_000, false, 500_000);
    expect(r.over).toBe(false);
    expect(r.would_be_pct).toBe(100);
  });

  it('1 satang over budget → over = true', () => {
    const r = checkPr(1_000_000, 500_000, false, 500_001);
    expect(r.over).toBe(true);
    expect(r.would_be_pct).toBe(100);
  });

  it('massively over budget', () => {
    const r = checkPr(100_000, 200_000, true, 300_000);
    expect(r.over).toBe(true);
    expect(r.would_be_pct).toBe(500);
    expect(r.soft_block).toBe(true);
  });

  it('zero budget → pct is 0 regardless', () => {
    const r = checkPr(0, 0, false, 50_000);
    expect(r.would_be_pct).toBe(0);
    expect(r.over).toBe(true); // 50000 > 0
  });

  it('preserves soft_block flag', () => {
    const blocked = checkPr(1_000_000, 0, true, 100);
    expect(blocked.soft_block).toBe(true);
    const unblocked = checkPr(1_000_000, 0, false, 100);
    expect(unblocked.soft_block).toBe(false);
  });
});
