/**
 * Unit tests for the backend i18n dictionary.
 *
 * Verifies that all 8 locales have identical key sets and that the
 * TypeScript compile-time check (EnsureSameKeys) is backed by a
 * runtime test too — TypeScript checks catch mismatches at build time,
 * but a Jest test catches them during CI even if tsc is skipped.
 */
import { dictionary, LOCALES, DEFAULT_LOCALE } from './dictionary';

describe('Backend i18n dictionary', () => {
  const thKeys = Object.keys(dictionary.th).sort();

  it('has 8 locales', () => {
    expect(LOCALES).toHaveLength(8);
    expect(LOCALES).toEqual(['th', 'en', 'zh', 'ja', 'vi', 'id', 'my', 'km']);
  });

  it('defaults to Thai', () => {
    expect(DEFAULT_LOCALE).toBe('th');
  });

  for (const locale of LOCALES) {
    it(`locale "${locale}" has same keys as "th"`, () => {
      const keys = Object.keys(dictionary[locale]).sort();
      expect(keys).toEqual(thKeys);
    });
  }

  it('all values are non-empty strings', () => {
    for (const locale of LOCALES) {
      const entries = Object.entries(dictionary[locale]);
      for (const [key, value] of entries) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('interpolation placeholders are consistent across locales', () => {
    // Find keys with {placeholders} in Thai, ensure they exist in all others
    const placeholderPattern = /\{(\w+)\}/g;
    for (const key of thKeys) {
      const thValue = (dictionary.th as Record<string, string>)[key];
      const thPlaceholders = [...thValue.matchAll(placeholderPattern)]
        .map((m) => m[1])
        .sort();

      if (thPlaceholders.length === 0) continue;

      for (const locale of LOCALES) {
        if (locale === 'th') continue;
        const value = (dictionary[locale] as Record<string, string>)[key];
        const placeholders = [...value.matchAll(placeholderPattern)]
          .map((m) => m[1])
          .sort();
        expect(placeholders).toEqual(thPlaceholders);
      }
    }
  });

  // ── LINE keys ───────────────────────────────────────────────────────────

  it('LINE keys include binding success/not_found', () => {
    for (const locale of LOCALES) {
      const d = dictionary[locale] as Record<string, string>;
      expect(d['line.bind.success']).toBeDefined();
      expect(d['line.bind.not_found']).toBeDefined();
    }
  });

  // ── PDF keys ────────────────────────────────────────────────────────────

  it('PDF column keys are complete for document generation', () => {
    const requiredPdfKeys = [
      'pdf.requested_by', 'pdf.col.line', 'pdf.col.description',
      'pdf.col.qty', 'pdf.col.unit_price', 'pdf.col.total',
      'pdf.total', 'pdf.justification', 'pdf.approval_trail',
    ];
    for (const locale of LOCALES) {
      const d = dictionary[locale] as Record<string, string>;
      for (const key of requiredPdfKeys) {
        expect(d[key]).toBeDefined();
        expect(d[key].length).toBeGreaterThan(0);
      }
    }
  });
});
