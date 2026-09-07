'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FileText, Clock, CheckCircle2, Send, XCircle } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import { po as poApi, type PoRow } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

// ---------------------------------------------------------------------------
// Status badge (same pattern as list page)
// ---------------------------------------------------------------------------
type PoStatus = 'draft' | 'sent' | 'received' | 'cancelled';

const STATUS_STYLE: Record<PoStatus, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft:     { bg: 'bg-gray-100',   text: 'text-gray-600',   icon: Clock },
  sent:      { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: Send },
  received:  { bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle2 },
  cancelled: { bg: 'bg-red-50',     text: 'text-red-600',    icon: XCircle },
};

function PoStatusBadge({ status }: { status: PoStatus }) {
  const { t } = useT();
  const { bg, text, icon: Icon } = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  const label = t(`po.status.${status}` as Parameters<typeof t>[0]);
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${bg} ${text}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Mock fallback
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Detail body
// ---------------------------------------------------------------------------
function DetailBody({
  po,
  onStatusChange,
}: {
  po: PoRow;
  onStatusChange: (updated: PoRow) => void;
}) {
  const { t, locale } = useT();
  const [updating, setUpdating] = useState(false);

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: po.currency ?? 'THB', maximumFractionDigits: 0 })
      .format(n / 100);

  const fmtDate = (d: string | null) =>
    d ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(d)) : '—';

  const changeStatus = async (newStatus: PoStatus) => {
    setUpdating(true);
    try {
      const updated = await poApi.updateStatus(po.id, newStatus);
      onStatusChange(updated);
    } finally {
      setUpdating(false);
    }
  };

  const status = po.status as PoStatus;

  return (
    <>
      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <div className="num font-mono text-lg font-bold">{po.po_number}</div>
              <PoStatusBadge status={status} />
            </div>
          </div>
          <div className="num text-2xl font-bold">{fmt(po.total_minor)}</div>
        </div>

        <dl className="space-y-4 border-t border-gray-100 pt-4">
          <div className="flex justify-between gap-4">
            <dt className="text-sm text-gray-500">{t('po.supplier')}</dt>
            <dd className="text-sm font-medium text-right">
              {po.supplier_name && po.supplier_id ? (
                <Link href={`/suppliers/${po.supplier_id}`} className="text-brand-600 hover:underline">
                  {po.supplier_name}
                </Link>
              ) : po.supplier_name ?? '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-sm text-gray-500">{t('po.from_pr')}</dt>
            <dd className="text-sm font-medium text-right">
              {po.pr_id ? (
                <Link href={`/pr/${po.pr_id}`} className="text-brand-600 hover:underline font-mono">
                  {po.pr_id}
                </Link>
              ) : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-sm text-gray-500">{t('po.total')}</dt>
            <dd className="num text-sm font-bold">{fmt(po.total_minor)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-sm text-gray-500">{t('po.issued_at')}</dt>
            <dd className="text-sm font-medium">{fmtDate(po.issued_at)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500 mb-1">{t('po.notes')}</dt>
            <dd className="text-sm text-gray-700 leading-relaxed">{po.notes || '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap gap-3">
        {status === 'draft' && (
          <button
            type="button"
            className="btn-primary"
            disabled={updating}
            onClick={() => void changeStatus('sent')}
          >
            {updating ? t('common.saving') : t('po.send')}
          </button>
        )}
        {status === 'sent' && (
          <button
            type="button"
            className="btn-primary"
            disabled={updating}
            onClick={() => void changeStatus('received')}
          >
            {updating ? t('common.saving') : t('po.receive')}
          </button>
        )}
        {status === 'cancelled' && (
          <span className="inline-flex items-center gap-1 text-sm px-4 py-2 rounded-full bg-red-50 text-red-600 font-medium opacity-60 cursor-not-allowed">
            <XCircle className="w-4 h-4" />
            {t('po.status.cancelled')}
          </span>
        )}
        {status === 'received' && (
          <span className="inline-flex items-center gap-1 text-sm px-4 py-2 rounded-full bg-green-100 text-green-700 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            {t('po.status.received')}
          </span>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function PoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();
  const [local, setLocal] = useState<PoRow | null>(null);

  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(
      () => poApi.get(id),
      async () => (await import('@/lib/po-demo-fixtures')).loadDemoPo(id),
    ),
    [id],
  );

  const po = local ?? data;

  return (
    <section className="screen space-y-6 max-w-3xl mx-auto">
      <Link
        href="/po"
        className="btn-sm inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 -ml-2 px-2 rounded-lg"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>{t('common.back')}</span>
      </Link>

      {error && <ErrorBanner message={error.message} onRetry={refresh} />}
      {loading && !po && <Loading />}
      {po && <DetailBody po={po} onStatusChange={setLocal} />}
    </section>
  );
}
