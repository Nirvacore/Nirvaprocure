'use client';
import { useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/dictionary';

/**
 * 8-locale dropdown. Order = LOCALES from the dictionary, which puts Thai
 * first (default in our market) and English second (universal fallback).
 * After that: ASEAN neighbors + global business languages.
 *
 * Compact display picks a 2–3 char code so the header stays narrow on mobile.
 * The full label shows in the menu so users can pick the script they read.
 */
const COMPACT: Record<Locale, string> = {
  th: 'ไทย',
  en: 'EN',
  zh: '中文',
  ja: '日本',
  vi: 'VI',
  id: 'ID',
  my: 'မြ',
  km: 'ខ្មែរ',
};

export function LangSwitch() {
  const { locale, setLocale, t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click. We bind only when open to avoid leaking listeners.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t('a11y.language')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="min-h-[44px] h-11 px-3 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-ink-soft dark:text-gray-200 flex items-center gap-2 flex-shrink-0 text-sm font-bold"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{COMPACT[locale]}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lift border border-gray-200 dark:border-gray-700 overflow-hidden z-40"
        >
          {LOCALES.map((l) => (
            <button
              key={l}
              role="menuitem"
              onClick={() => { setLocale(l); setOpen(false); }}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between min-h-[44px] ${
                locale === l ? 'bg-brand-50 dark:bg-gray-700 text-brand-700 dark:text-brand-100 font-semibold' : ''
              }`}
            >
              <span>{LOCALE_LABELS[l]}</span>
              <span className="text-xs text-ink-muted uppercase">{l}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
