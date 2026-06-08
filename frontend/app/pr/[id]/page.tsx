'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, MessageSquare, GitBranch, Package, Check, Download } from 'lucide-react';
import { mockDetailById, srcLabel, type PrDetail, type Source } from '@/lib/mock-data';
import { StatusPill } from '@/components/StatusPill';
import { fmtBaht } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { pr as prApi, type PrDetail as ApiPrDetail } from '@/lib/api';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';
import { AiSuggestionCard } from '@/components/AiSuggestionCard';
import { PrComments } from '@/components/PrComments';
import { useT } from '@/lib/i18n/provider';

function toDetail(d: ApiPrDetail): PrDetail {
  const items = d.items.map((it) => ({
    description: it.description,
    qty: it.quantity,
    unit_price_minor: it.unit_price_minor,
    line_total_minor: it.line_total_minor,
    source: (it.source ?? 'manual') as Source,
    // The summary API doesn't include supplier_name yet; supplier is fetched
    // separately. Leave undefined so the badge still renders cleanly.
    supplier_name: undefined,
  }));
  const trail = (d.approval?.decisions ?? []).map((dec) => ({
    kind: dec.decision as 'approved' | 'rejected',
    by: dec.approver_id,
    at: new Date(dec.decided_at).toLocaleString('th-TH'),
    note: dec.comment,
  }));
  const allItems: PrDetail['trail'] = [
    // The literal date is locale-formatted at render time. Leave 'at' empty when
    // submitted_at is missing so the render can substitute a translated label.
    { kind: 'submitted', by: d.requester_id, at: d.submitted_at ? new Date(d.submitted_at).toLocaleString() : '' },
    ...trail,
  ];
  if (d.approval?.status === 'pending') {
    // Empty 'by' triggers the translated "next approver" fallback in render.
    allItems.push({ kind: 'pending', by: '', at: '' });
  }
  return {
    id: d.id,
    pr_number: d.pr_number,
    title: d.title,
    status: d.status,
    requester: d.requester_id,
    dept: d.department_id ?? '',
    submitted_at: d.submitted_at ?? '',
    justification: d.justification,
    items,
    total_minor: d.total.amount_minor,
    trail: allItems,
  };
}

export default function PrDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();

  const { data: pr, loading, error, refresh } = useResource(
    () => withMockFallback(
      async () => toDetail(await prApi.get(id)),
      mockDetailById[id] ?? mockDetailById['1'],
    ),
    [id],
  );

  return (
    <section className="screen space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/pr" className="btn-sm inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 -ml-2 px-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
          <span>{t('common.back')}</span>
        </Link>
        {id && (
          // PDF endpoint streams from the backend. opens in a new tab so the
          // browser handles inline display + the user can save from there.
          <a
            href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/v1'}/pr/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-sm rounded-xl bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-bold px-4 inline-flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            {t('detail.pdf')}
          </a>
        )}
      </div>

      {error && <ErrorBanner message={error.message} onRetry={refresh} />}
      {loading && !pr && <Loading />}
      {pr && <DetailBody pr={pr} />}
    </section>
  );
}

function DetailBody({ pr }: { pr: PrDetail }) {
  const { t } = useT();
  return (
    <>
      {/* Header card */}
      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div>
            <div className="num text-sm text-gray-500 mb-1">{pr.pr_number}</div>
            <h1 className="text-2xl font-bold mb-1 leading-snug">{pr.title}</h1>
            <p className="text-base text-gray-600">{pr.requester}{pr.dept ? ` · ${pr.dept}` : ''}{pr.submitted_at ? ` · ${pr.submitted_at}` : ''}</p>
          </div>
          <StatusPill status={pr.status} />
        </div>

        <div className="border-t border-gray-200 pt-5 space-y-3">
          {pr.items.map((it, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-gray-50">
              <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold leading-snug">{it.description}</div>
                <div className="text-sm text-gray-600 flex items-center gap-2 mt-1 flex-wrap">
                  <span className="font-medium">{srcLabel[it.source]}</span>
                  {it.supplier_name && <><span>·</span><span>{it.supplier_name}</span></>}
                </div>
                <div className="num text-sm text-gray-500 mt-1">
                  {it.qty} {t('unit.piece')} × ฿ {fmtBaht(it.unit_price_minor)}
                </div>
              </div>
              <div className="num font-bold text-lg whitespace-nowrap">฿ {fmtBaht(it.line_total_minor)}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 mt-5 pt-5 flex items-center justify-between">
          <span className="text-base text-gray-600">{t('detail.total')}</span>
          <span className="num text-2xl font-bold">฿ {fmtBaht(pr.total_minor)}</span>
        </div>
      </div>

      {/* Justification */}
      <div className="card">
        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-gray-400" />
          {t('detail.reason')}
        </h3>
        <p className="text-base text-gray-700 leading-relaxed">{pr.justification || '—'}</p>
      </div>

      {/* NirvaAI price suggestion — opt-in (button on first render). */}
      {pr.items[0] && (
        <AiSuggestionCard
          itemName={pr.items[0].description}
          marketplaceListings={pr.items
            .filter((it) => it.source !== 'manual')
            .map((it) => ({
              source: it.source as 'shopee' | 'lazada' | 'makro' | 'alibaba',
              url:    `https://${it.source}.example/x`,
              price_minor: it.unit_price_minor,
              currency: 'THB',
              supplier_name: it.supplier_name,
            }))}
          historicalPos={[]}
        />
      )}

      {/* Approval trail */}
      <div className="card">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-gray-400" />
          {t('detail.steps')}
        </h3>
        <ol className="space-y-4">
          {pr.trail.map((step, i) => {
            const isPending  = step.kind === 'pending';
            const isApproved = step.kind === 'approved' || step.kind === 'submitted';
            const isRejected = step.kind === 'rejected';
            const Icon = isPending ? Clock : Check;
            return (
              <li key={i} className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isApproved ? 'bg-green-100 text-green-700'
                    : isRejected ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700 animate-pulse'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold">
                    {step.kind === 'submitted' && t('trail.submitted')}
                    {step.kind === 'pending'   && t('trail.pending',  { by: step.by || t('trail.next_approver') })}
                    {step.kind === 'approved'  && t('trail.approved', { by: step.by })}
                    {step.kind === 'rejected'  && t('trail.rejected', { by: step.by })}
                  </div>
                  <div className={`text-sm ${isPending ? 'text-amber-700 font-medium' : 'text-gray-500'}`}>
                    {step.kind !== 'pending' && step.by ? `${step.by} · ` : ''}{isPending ? t('trail.waiting') : (step.at || t('trail.not_submitted'))}
                  </div>
                  {step.note && <div className="text-sm text-gray-600 mt-1">&ldquo;{step.note}&rdquo;</div>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Comments thread — separate card at the bottom so it doesn't crowd
          the structured fields above. Phase 6: collapse by default if > 20 comments. */}
      <PrComments prId={pr.id} />
    </>
  );
}
