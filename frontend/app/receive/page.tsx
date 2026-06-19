'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Truck, CheckCircle2, ChevronDown, ChevronUp, Package,
} from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import { useToast } from '@/components/Toast';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { pr as prApi, type PrSummary, type PrDetail as ApiPrDetail } from '@/lib/api';
import { mockPrs } from '@/lib/mock-data';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

type ReceiveLine = ApiPrDetail['items'][number] & { item_id?: string | null };

function toSummary(p: typeof mockPrs[number]): PrSummary {
  return {
    id: p.id,
    pr_number: p.pr_number,
    title: p.title,
    status: p.status,
    requester_id: 'user-1',
    department_id: 'dept-1',
    total: { amount_minor: p.total_minor, currency: 'THB' },
    submitted_at: '2026-06-01',
    created_at: p.created_at,
  };
}

const MOCK_APPROVED: PrSummary[] = mockPrs
  .filter(p => p.status === 'approved')
  .map(toSummary);

const MOCK_DETAILS: Record<string, ApiPrDetail> = {
  '2': {
    ...toSummary(mockPrs.find(p => p.id === '2')!),
    id: '2',
    pr_number: 'PR-2026-0041',
    title: 'ถุงมือแล็บ x 200 คู่',
    justification: 'เติมถุงมือแล็บประจำไตรมาส',
    items: [
      { id: 'li-2-1', line_no: 1, description: 'ถุงมือแล็บ ขนาด M', quantity: 200, unit: 'pair', unit_price_minor: 94500, line_total_minor: 18900000, supplier_id: null, source: 'makro', source_url: null, item_id: 'i2' },
    ] as ReceiveLine[],
    approval: null,
  },
  '5': {
    id: '5',
    pr_number: 'PR-2026-0038',
    title: 'ของกินทีม Q1',
    status: 'approved',
    requester_id: 'user-2',
    department_id: 'dept-2',
    total: { amount_minor: 250000, currency: 'THB' },
    submitted_at: '2026-05-25',
    created_at: '5 วัน',
    justification: 'ของว่างทีมประจำไตรมาส',
    items: [
      { id: 'li-5-1', line_no: 1, description: 'ขนมและเครื่องดื่มทีม', quantity: 1, unit: 'lot', unit_price_minor: 25000000, line_total_minor: 25000000, supplier_id: null, source: 'manual', source_url: null, item_id: 'i-snack' },
    ] as ReceiveLine[],
    approval: null,
  },
};

// ---------------------------------------------------------------------------
// Approved PR card
// ---------------------------------------------------------------------------
function ApprovedPrCard({
  pr,
  onReceived,
}: {
  pr: PrSummary;
  onReceived: () => void;
}) {
  const { t } = useT();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: detail, loading: loadingDetail } = useResource(
    () => {
      if (!expanded) return Promise.resolve(null);
      return withMockFallback(
        () => prApi.get(pr.id),
        MOCK_DETAILS[pr.id] ?? MOCK_DETAILS['2'],
      );
    },
    [expanded, pr.id],
  );

  const confirmReceive = async () => {
    if (!detail) return;
    setConfirming(true);
    try {
      const lines = (detail.items as ReceiveLine[])
        .filter(it => it.item_id)
        .map(it => ({
          line_item_id: it.id,
          item_id: it.item_id!,
          quantity: it.quantity,
        }));

      await withMockFallback(
        () => prApi.receive(pr.id, { warehouse_id: 'wh-1', lines }),
        detail,
      );

      toast(t('gr.toast.success').replace('{pr}', pr.pr_number), 'ok');
      setShowConfirm(false);
      setExpanded(false);
      onReceived();
    } catch {
      toast(t('gr.toast.fail'), 'err');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <div className="card border-green-200 overflow-hidden p-0">
        <button
          type="button"
          className="w-full flex items-center gap-3 p-5 text-left hover:bg-green-50/50 transition-colors"
          onClick={() => setExpanded(v => !v)}
        >
          <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <Truck className="w-5 h-5 text-green-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{pr.title}</div>
            <div className="text-sm text-gray-500 font-mono">{pr.pr_number}</div>
          </div>
          {expanded
            ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
            : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
        </button>

        {expanded && (
          <div className="border-t border-green-100 px-5 pb-5">
            {loadingDetail ? (
              <div className="py-6"><Loading /></div>
            ) : detail ? (
              <>
                <h4 className="text-sm font-semibold text-gray-500 mt-4 mb-3">{t('detail.items')}</h4>
                <ul className="space-y-2">
                  {detail.items.map(it => (
                    <li key={it.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                      <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="flex-1 text-sm">{it.description}</span>
                      <span className="num text-xs font-semibold bg-white px-2 py-1 rounded-lg border border-gray-200">
                        × {it.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn-primary w-full mt-5 bg-green-600 hover:bg-green-700"
                  disabled={confirming}
                  onClick={() => setShowConfirm(true)}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {confirming ? t('common.loading') : t('gr.confirm.btn')}
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lift w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold mb-2">{t('gr.confirm.title')}</h3>
            <p className="text-base text-gray-700 mb-6">
              {t('gr.confirm.msg').replace('{pr}', pr.pr_number)}
            </p>
            <div className="flex justify-end gap-3">
              <button className="btn-ghost" onClick={() => setShowConfirm(false)} disabled={confirming}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary bg-green-600 hover:bg-green-700"
                onClick={() => void confirmReceive()}
                disabled={confirming}
              >
                {confirming ? t('common.saving') : t('gr.confirm.btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ReceivePage() {
  const { t } = useT();
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(
      async () => {
        const res = await prApi.list({ status: 'approved', limit: 50 });
        return res.data;
      },
      MOCK_APPROVED,
    ),
  );

  const rows = (data ?? []).filter(r => !excludedIds.has(r.id));

  const handleReceived = (id: string) => {
    setExcludedIds(prev => new Set(prev).add(id));
    void refresh();
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-8">
      <Link
        href="/"
        className="btn-sm inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 -ml-2 px-2 rounded-lg mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>{t('common.back')}</span>
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Truck className="w-7 h-7 text-green-600" />
        {t('gr.heading')}
      </h1>

      {error && <div className="mb-4"><ErrorBanner message={error.message} onRetry={refresh} /></div>}

      {loading && rows.length === 0 ? (
        <Loading />
      ) : rows.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">{t('gr.empty')}</p>
          <p className="text-sm text-gray-500 mt-1">{t('gr.empty.sub')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <ApprovedPrCard
              key={row.id}
              pr={row}
              onReceived={() => handleReceived(row.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
