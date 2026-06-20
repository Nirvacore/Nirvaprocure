'use client';
import { useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, AlertCircle, CheckCircle2, Package } from 'lucide-react';
import { ApiError, portal as portalApi, type PortalLine, type PortalOverview } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { Loading } from '@/components/Loading';
import { fmtBaht } from '@/lib/format';
import { useT } from '@/lib/i18n/provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';

const MOCK_PORTAL: PortalOverview = {
  supplier_name: 'บริษัท เทค ซัพพลาย จำกัด',
  expires_at: '2026-12-31T23:59:59Z',
  lines: [
    {
      pr_id: 'pr-mock-1',
      pr_number: 'PR-2026-0042',
      pr_title: 'จัดซื้ออุปกรณ์สำนักงาน',
      description: 'เครื่องพิมพ์เลเซอร์ A4',
      quantity: 2,
      unit: 'เครื่อง',
      unit_price_minor: 890_000,
      line_total_minor: 1_780_000,
      status: 'pending',
    },
  ],
};

export default function SupplierPortalPage() {
  const { token } = useParams<{ token: string }>();
  const { t, locale } = useT();

  const mapPortalError = useCallback((err: unknown): Error => {
    if (err instanceof ApiError) {
      if (err.status === 403) return new Error(t('portal.err.expired'));
      if (err.status === 404) return new Error(t('portal.err.invalid'));
      return new Error(t('portal.err.load', { status: err.status }));
    }
    if (err instanceof Error) return err;
    return new Error(t('portal.err.network'));
  }, [t]);

  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(
      async () => {
        try {
          return await portalApi.overview(token);
        } catch (err) {
          throw mapPortalError(err);
        }
      },
      MOCK_PORTAL,
    ),
    [token, mapPortalError],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-indigo-50">
      <header className="bg-white border-b border-line">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-ink">NIRVAPROCURE</div>
            <div className="text-xs text-ink-soft">{t('portal.subtitle')}</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {loading && !data && <Loading />}

        {error && (
          <div className="card text-center py-12">
            <div className="w-16 h-16 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div className="text-xl font-bold mb-1">{error.message}</div>
            <div className="text-base text-ink-soft mb-4">{t('portal.err.contact')}</div>
            <button onClick={refresh} className="btn-secondary px-5">
              {t('common.retry')}
            </button>
          </div>
        )}

        {data && (
          <>
            <section className="mb-6 space-y-1">
              <h1 className="text-2xl font-bold text-ink">{t('portal.greeting', { name: data.supplier_name })}</h1>
              <p className="text-sm text-ink-soft">
                {t('portal.expires', { date: new Date(data.expires_at).toLocaleDateString(locale) })}
              </p>
            </section>

            {data.lines.length === 0 ? (
              <div className="card text-center py-12">
                <Package className="w-12 h-12 text-ink-muted mx-auto mb-3" />
                <div className="text-xl font-bold mb-1">{t('portal.empty')}</div>
                <div className="text-base text-ink-soft">{t('portal.empty.sub')}</div>
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
  const [ack, setAck] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);

  async function acknowledge() {
    setBusy(true);
    setAckError(null);
    try {
      await withMockFallback(
        () => portalApi.acknowledge(token, line.pr_id),
        { ok: true },
      );
      setAck(true);
    } catch (err) {
      setAckError(err instanceof Error ? err.message : t('portal.err.ack'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-ink-soft flex-shrink-0">
          <Package className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="num text-xs text-ink-muted">{line.pr_number}</div>
          <div className="font-bold text-lg leading-snug text-ink">{line.description}</div>
          <div className="text-sm text-ink-soft">{line.pr_title}</div>
        </div>
      </div>
      <div className="flex items-baseline justify-between text-sm border-t border-line pt-3">
        <span className="num text-ink-soft">
          {line.quantity} {line.unit} × ฿ {fmtBaht(line.unit_price_minor)}
        </span>
        <span className="num text-lg font-bold text-ink">฿ {fmtBaht(line.line_total_minor)}</span>
      </div>
      <div className="mt-3 flex flex-col items-end gap-2">
        {ackError && (
          <p className="text-sm text-red-700 w-full text-right">{ackError}</p>
        )}
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
