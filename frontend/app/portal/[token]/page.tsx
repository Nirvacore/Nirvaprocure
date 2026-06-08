'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, AlertCircle, CheckCircle2, Package } from 'lucide-react';
import { fmtBaht } from '@/lib/format';
import { useT } from '@/lib/i18n/provider';

interface PortalLine {
  pr_id: string;
  pr_number: string;
  pr_title: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_minor: number;
  line_total_minor: number;
  status: string;
}
interface PortalOverview {
  supplier_name: string;
  expires_at: string;
  lines: PortalLine[];
}

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/v1';

/**
 * Supplier portal — public route. AuthProvider in the app shell would
 * normally redirect to /login; we route around that by serving this page
 * outside the AppShell (AppShell already special-cases the login path; we
 * extend the same logic by making /portal pages render their own chrome).
 *
 * Because this lives under app/portal/[token]/page.tsx — a sibling of
 * the login route — and AppShell only special-cases `/login`, we'd be
 * trapped behind the auth guard. The cheap fix is to recognize the route
 * here and refuse to fall under the guard. The proper fix (route groups
 * `(public)/portal/...`) lands when we accumulate more public pages.
 */
export default function SupplierPortalPage() {
  const { token } = useParams<{ token: string }>();
  const { t, locale } = useT();
  const [data,  setData]  = useState<PortalOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/portal/${encodeURIComponent(token)}`, {
          credentials: 'omit',
        });
        if (res.status === 403) { setError(t('portal.err.expired'));   return; }
        if (res.status === 404) { setError(t('portal.err.invalid'));   return; }
        if (!res.ok)            { setError(t('portal.err.load', { status: res.status })); return; }
        setData(await res.json());
      } catch {
        setError(t('portal.err.network'));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-indigo-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold">NIRVAPROCURE</div>
            <div className="text-xs text-gray-500">{t('portal.subtitle')}</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {!data && !error && (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mr-3" />
            {t('common.loading')}
          </div>
        )}

        {error && (
          <div className="card text-center py-12">
            <div className="w-16 h-16 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div className="text-xl font-bold mb-1">{error}</div>
            <div className="text-base text-gray-600">{t('portal.err.contact')}</div>
          </div>
        )}

        {data && (
          <>
            <section className="mb-6 space-y-1">
              <h1 className="text-2xl font-bold">{t('portal.greeting', { name: data.supplier_name })}</h1>
              <p className="text-sm text-gray-600">{t('portal.expires', { date: new Date(data.expires_at).toLocaleDateString(locale) })}</p>
            </section>

            {data.lines.length === 0 ? (
              <div className="card text-center py-12">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <div className="text-xl font-bold mb-1">{t('portal.empty')}</div>
                <div className="text-base text-gray-600">{t('portal.empty.sub')}</div>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.lines.map((line, i) => (
                  <PortalLineCard key={`${line.pr_id}-${i}`} token={token} line={line} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function PortalLineCard({ token, line }: { token: string; line: PortalLine }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [ack,  setAck]  = useState(false);

  async function acknowledge() {
    setBusy(true);
    try {
      const res = await fetch(`${API}/portal/${encodeURIComponent(token)}/pr/${line.pr_id}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'omit',
      });
      if (res.ok) setAck(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 flex-shrink-0">
          <Package className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="num text-xs text-gray-500">{line.pr_number}</div>
          <div className="font-bold text-lg leading-snug">{line.description}</div>
          <div className="text-sm text-gray-600">{line.pr_title}</div>
        </div>
      </div>
      <div className="flex items-baseline justify-between text-sm border-t border-gray-100 pt-3">
        <span className="num text-gray-600">{line.quantity} {line.unit} × ฿ {fmtBaht(line.unit_price_minor)}</span>
        <span className="num text-lg font-bold">฿ {fmtBaht(line.line_total_minor)}</span>
      </div>
      <div className="mt-3 flex justify-end">
        {ack ? (
          <span className="inline-flex items-center gap-2 text-green-700 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            {t('portal.ack.done')}
          </span>
        ) : (
          <button
            onClick={acknowledge}
            disabled={busy}
            className="btn-sm rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 flex items-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {t('portal.ack.button')}
          </button>
        )}
      </div>
    </li>
  );
}
