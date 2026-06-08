/**
 * Format an amount in minor units (satang) as a THB string with thousand separators
 * and 2 decimal places. Example: 808920 → "8,089.20"
 */
export function fmtBaht(amountMinor: number): string {
  return (amountMinor / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Render a Thai-friendly relative time. Falls back to a date string for old items.
 */
export function fmtRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'เพิ่งกี่นี้';
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชั่วโมงที่แล้ว`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'เมื่อวาน';
  if (day < 7) return `${day} วันที่แล้ว`;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}
