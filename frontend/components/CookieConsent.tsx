'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie, X } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';

const COOKIE_NAME    = 'nirva.cookie_consent';
const COOKIE_VERSION = 'v1';
const COOKIE_TTL     = 60 * 60 * 24 * 365; // 1 year

type Decision = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  decided_at: string;
  version: string;
};

/**
 * Bottom-of-screen cookie consent banner — closes PDPA §22 (right to be
 * informed) and §23 (consent where applicable) for analytics/marketing
 * cookies. Essential cookies (session, CSRF) are exempt under PDPA's
 * legitimate-interest basis and are always on.
 *
 * Persists the decision in two places:
 *   - First-party cookie (so the banner doesn't re-show on the next page load)
 *   - Server (via /people/me/consent) when the user is logged in, so the
 *     decision follows them across devices and gives the DPO an evidence trail
 *
 * The banner only renders when no prior decision exists. Once acknowledged,
 * the choice can be reviewed/changed from /privacy.
 */
export function CookieConsent() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // Show only when no prior decision exists. We check both the local cookie
  // (works for anonymous users) and don't bother hitting the server here —
  // the server-side check runs lazily inside `persist()`.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (readCookie(COOKIE_NAME)) return;
    setOpen(true);
  }, []);

  if (!open) return null;

  function persist(decision: Decision) {
    const json = JSON.stringify(decision);
    const encoded = encodeURIComponent(json);
    document.cookie = `${COOKIE_NAME}=${encoded}; path=/; max-age=${COOKIE_TTL}; SameSite=Lax`;
    // Fire-and-forget server sync — non-fatal if the user isn't logged in or
    // the backend is unreachable. The local cookie is the source of truth
    // for behavior; the server copy is evidence for the DPO.
    void fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/v1'}/people/me/consent`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      },
    ).catch(() => { /* anon visitor or backend down — ignore */ });
    setOpen(false);
  }

  function acceptAll() {
    persist({ essential: true, analytics: true, marketing: true,
      decided_at: new Date().toISOString(), version: COOKIE_VERSION });
  }
  function rejectNonEssential() {
    persist({ essential: true, analytics: false, marketing: false,
      decided_at: new Date().toISOString(), version: COOKIE_VERSION });
  }
  function savePicks() {
    persist({ essential: true, analytics, marketing,
      decided_at: new Date().toISOString(), version: COOKIE_VERSION });
  }

  return (
    <div
      role="dialog"
      aria-label={t('cookie.title')}
      className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6"
    >
      <div className="max-w-4xl mx-auto bg-white border-2 border-brand-200 rounded-2xl shadow-lift p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0">
            <Cookie className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold mb-1">{t('cookie.title')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('cookie.body')} <Link href="/privacy" className="text-brand-700 underline">{t('cookie.learn_more')}</Link>
            </p>
          </div>
          <button
            onClick={rejectNonEssential}
            aria-label={t('common.close')}
            className="btn-sm w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-400 flex items-center justify-center flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {expanded && (
          <div className="space-y-2 mb-4 pl-13">
            <ToggleRow checked disabled
              title={t('cookie.cat.essential')} sub={t('cookie.cat.essential.sub')} />
            <ToggleRow checked={analytics} onChange={setAnalytics}
              title={t('cookie.cat.analytics')} sub={t('cookie.cat.analytics.sub')} />
            <ToggleRow checked={marketing} onChange={setMarketing}
              title={t('cookie.cat.marketing')} sub={t('cookie.cat.marketing.sub')} />
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2">
          {!expanded ? (
            <button onClick={() => setExpanded(true)} className="btn-secondary btn-sm flex-1 sm:flex-initial sm:px-5">
              {t('cookie.customize')}
            </button>
          ) : (
            <button onClick={savePicks} className="btn-secondary btn-sm flex-1 sm:flex-initial sm:px-5">
              {t('cookie.save')}
            </button>
          )}
          <button onClick={rejectNonEssential} className="btn-secondary btn-sm flex-1 sm:flex-initial sm:px-5">
            {t('cookie.reject')}
          </button>
          <button onClick={acceptAll} className="btn-primary btn-sm flex-1 sm:px-6">
            {t('cookie.accept_all')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  title, sub, checked, onChange, disabled,
}: {
  title: string; sub: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 w-5 h-5 rounded text-brand-600 disabled:opacity-50"
      />
      <div className="flex-1">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-gray-600">{sub}</div>
      </div>
    </label>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
