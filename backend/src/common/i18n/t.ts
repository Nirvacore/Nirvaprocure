import { dictionary, DEFAULT_LOCALE, LOCALES, type Locale, type TranslationKey } from './dictionary';

/**
 * Translate a key in a given locale, interpolating `{var}` placeholders.
 * Falls back to the default locale (Thai) when an unknown locale is passed
 * — this keeps the server safe if a stale token carries a deprecated locale.
 */
export function t(
  locale: string | null | undefined,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const safeLocale: Locale =
    locale && (LOCALES as readonly string[]).includes(locale)
      ? (locale as Locale)
      : DEFAULT_LOCALE;
  const template = dictionary[safeLocale][key] ?? dictionary[DEFAULT_LOCALE][key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : `{${name}}`,
  );
}

export { LOCALES, DEFAULT_LOCALE, type Locale, type TranslationKey } from './dictionary';
