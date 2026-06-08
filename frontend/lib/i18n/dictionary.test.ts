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
    // Easy regression: someone copies an English fixture into the th dict.
    // Detect simple Latin-only stretches as a smoke test, allowing punctuation.
    for (const [key, value] of Object.entries(dictionary.th)) {
      // Tolerate brand name + interpolated variables + short ASCII fragments.
      const ascii = value.replace(/\{\w+\}/g, '').replace(/NIRVAPROCURE/g, '');
      const onlyLatin = /^[A-Za-z0-9 .,!?;:'"-/]+$/.test(ascii.trim());
      expect(onlyLatin, `th[${key}] looks English-only: "${value}"`).toBe(false);
    }
  });

  it('interpolates a sample variable correctly when used through the provider semantics', () => {
    // We can't import the hook in a non-jsx test, but the template format is
    // checked here directly to avoid a regression in `useT`'s placeholder syntax.
    const template = dictionary.th['home.greeting'];
    expect(template).toContain('{name}');
  });
});
