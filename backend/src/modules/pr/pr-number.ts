/**
 * Generate the next PR number for an org in the format `PR-YYYY-NNNN`.
 *
 * Extracted from PrService so unit tests can exercise the rollover logic
 * without spinning up Postgres. The caller passes the most recent PR number
 * for the current year (or null if none exists) and the year, and gets back
 * the next one.
 *
 * Behavior:
 *   - First PR of a year → `PR-2026-0001`
 *   - Rolls over correctly: `PR-2026-9999` → `PR-2026-10000` (5 digits)
 *   - Tolerates malformed prefixes: if `latestForYear` doesn't parse, we
 *     restart at 0001 rather than throw. This matters for orgs that imported
 *     a custom legacy numbering scheme on first install.
 */
export function nextPrNumber(year: number, latestForYear: string | null): string {
  const prefix = `PR-${year}-`;
  if (!latestForYear || !latestForYear.startsWith(prefix)) {
    return `${prefix}${String(1).padStart(4, '0')}`;
  }
  const tail = latestForYear.slice(prefix.length);
  const n = parseInt(tail, 10);
  if (!Number.isFinite(n) || n < 0) {
    return `${prefix}${String(1).padStart(4, '0')}`;
  }
  const next = n + 1;
  const width = Math.max(4, String(next).length);
  return `${prefix}${String(next).padStart(width, '0')}`;
}
