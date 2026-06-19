'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { dictionary, LOCALES, type Locale, type TranslationKey } from './dictionary';
import { people as peopleApi } from '@/lib/api';

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx | null>(null);
const COOKIE = 'nirva.locale';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('th');

  // Hydrate locale from cookie, then browser hint, then default 'th'.
  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    if (typeof document === 'undefined') return;
    const fromCookie = readCookie(COOKIE);
    if (fromCookie && LOCALES.includes(fromCookie as Locale)) {
      setLocaleState(fromCookie as Locale);
      return;
    }
    const browser = navigator.language?.slice(0, 2);
    if (browser && LOCALES.includes(browser as Locale)) {
      setLocaleState(browser as Locale);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof document !== 'undefined') {
      document.cookie = `${COOKIE}=${l}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
      document.documentElement.lang = l;
    }
    // Fire-and-forget sync to the server so LINE/email pushes render in the
    // user's language. Failure is non-fatal — the local cookie still wins
    // for the web/mobile experience.
    void peopleApi.setMyLocale(l).catch(() => { /* offline / unauth — ignore */ });
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const template = dictionary[locale][key] ?? key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
    },
    [locale],
  );

  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}

export function useT(): I18nCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useT must be used inside <I18nProvider>');
  return v;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
