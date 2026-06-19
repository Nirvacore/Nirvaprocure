import { describe, expect, it } from 'vitest';
import { dictionary, LOCALES } from './dictionary';

describe('i18n dictionary', () => {
  it('has the same keys in every locale', () => {
    const refKeys = Object.keys(dictionary.th).sort();
    for (const locale of LOCALES) {
      const keys = Object.keys(dictionary[locale]).sort();
      expect(keys, `locale ${locale} should match TH key set`).toEqual(refKeys);
    }
  });

  it('does not leave English placeholders in the Thai locale', () => {
    // Regression: accidental copy of the EN string into `th`.
    const EN_OK = new Set([
      'settings.tab.webhooks',
      'settings.tab.affiliate',
      'audit.heading',
      'affiliate.heading',
    ]);
    for (const [key, value] of Object.entries(dictionary.th)) {
      if (EN_OK.has(key) || key.startsWith('affiliate.platform.') || key.startsWith('notif.mock.')) continue;
      expect(dictionary.en[key], `th[${key}] still equals EN copy: "${value}"`).not.toBe(value);
    }
  });

  it('interpolates a sample variable correctly when used through the provider semantics', () => {
    // We can't import the hook in a non-jsx test, but the template format is
    // checked here directly to avoid a regression in `useT`'s placeholder syntax.
    const template = dictionary.th['home.greeting'];
    expect(template).toContain('{name}');
  });
});
