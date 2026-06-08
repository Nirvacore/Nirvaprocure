import { nextPrNumber } from './pr-number';

describe('nextPrNumber', () => {
  it('returns PR-YYYY-0001 when no prior PR exists', () => {
    expect(nextPrNumber(2026, null)).toBe('PR-2026-0001');
  });

  it('increments the trailing counter', () => {
    expect(nextPrNumber(2026, 'PR-2026-0042')).toBe('PR-2026-0043');
  });

  it('zero-pads to 4 digits while small', () => {
    expect(nextPrNumber(2026, 'PR-2026-0008')).toBe('PR-2026-0009');
    expect(nextPrNumber(2026, 'PR-2026-0099')).toBe('PR-2026-0100');
  });

  it('grows past 4 digits when the org busy enough', () => {
    expect(nextPrNumber(2026, 'PR-2026-9999')).toBe('PR-2026-10000');
  });

  it('resets at year boundary', () => {
    // Last year's number doesn't influence this year's counter.
    expect(nextPrNumber(2027, 'PR-2026-9999')).toBe('PR-2027-0001');
  });

  it('tolerates malformed legacy numbers gracefully', () => {
    expect(nextPrNumber(2026, 'LEGACY-FOO')).toBe('PR-2026-0001');
    expect(nextPrNumber(2026, 'PR-2026-XXX')).toBe('PR-2026-0001');
  });
});
