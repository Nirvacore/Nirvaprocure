'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, X, Eye, Home } from 'lucide-react';
import { mockInbox, srcLabel, type InboxItem, type Source } from '@/lib/mock-data';
import { fmtBaht } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { approvals as approvalsApi, type InboxEntry } from '@/lib/api';
import { useT } from '@/lib/i18n/provider';
import { SkeletonRows } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

function toInbox(e: InboxEntry): InboxItem {
  const ageMs = Date.now() - new Date(e.waiting_since).getTime();
  return {
    id: e.instance_id,
    pr_number: e.pr.pr_number,
    title: e.pr.title,
    // The API returns ids; until we hydrate names this falls back to the id prefix.
    requester: e.pr.requester_id.slice(0, 2).toUpperCase(),
    dept: '',
    total_minor: e.pr.total.amount_minor,
    items: 1,
    source: 'manual' as Source,
    age: new Date(e.waiting_since).toLocaleString('th-TH'),
    urgent: ageMs > 48 * 3600 * 1000,
  };
}

export default function ApprovalsPage() {
  const { toastUndo, toast } = useToast();
  const { t } = useT();

  const { data, loading, error, refresh } = useResource(async () => {
    return await withMockFallback(
      async () => (await approvalsApi.inbox()).map(toInbox),
      mockInbox,
    );
  });

  const [items, setItems] = useState<InboxItem[] | null>(null);
  useEffect(() => { if (data) setItems(data); }, [data]);

  function decide(it: InboxItem, decision: 'approved' | 'rejected') {
    if (!items) return;
    const prev = items;
    const next = items.filter((x) => x.id !== it.id);
    setItems(next);

    const label = decision === 'approved' ? t('status.approved') : t('status.rejected');
    toastUndo(`${it.title} · ${label}`, () => setItems(prev));

    // Fire the real mutation after the undo window. We attempt it eagerly here
    // since the UI is already optimistic — if the call fails we surface a toast
    // and re-add the item.
    void approvalsApi.decide(it.id, decision).catch((err) => {
      toast(`${t('common.error')}: ${err.message ?? '—'}`, 'err');
      setItems(prev);
    });
  }

  return (
    <section className="screen space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">{t('approvals.heading')}</h1>
        <p className="text-base text-ink-soft">
          {t('approvals.sub', { count: items?.length ?? 0 })}
        </p>
      </div>

      {error && <ErrorBanner message={error.message} onRetry={refresh} />}
      {loading && !items && <SkeletonRows rows={3} />}
      {items && items.length === 0 && <EmptyInbox />}

      {items && items.length > 0 && (
        <div className="space-y-4">
          {items.map((it) => (
            <InboxCard key={it.id} it={it} onDecide={decide} />
          ))}
        </div>
      )}

      <div className="pt-6 border-t border-line">
        <h2 className="text-lg font-semibold text-ink-muted mb-3">{t('approvals.recent.title')}</h2>
        <div className="space-y-2">
          <RecentDecision icon="check" title={t('approvals.recent.demo1.title')} by={t('approvals.recent.demo1.by')} label={t('status.approved')} labelCls="text-green-700" iconCls="bg-green-100 text-green-700" />
          <RecentDecision icon="x" title={t('approvals.recent.demo2.title')} by={t('approvals.recent.demo2.by')} label={t('status.rejected')} labelCls="text-red-700" iconCls="bg-red-100 text-red-700" />
        </div>
      </div>
    </section>
  );
}

function InboxCard({ it, onDecide }: { it: InboxItem; onDecide: (i: InboxItem, d: 'approved' | 'rejected') => void }) {
  const { t } = useT();
  return (
    <div className={`bg-white rounded-2xl p-5 sm:p-6 shadow-soft border ${it.urgent ? 'border-amber-300' : 'border-line'}`}>
      {it.urgent && (
        <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-3 -mt-1">
          <AlertTriangle className="w-4 h-4" />
          {t('approvals.urgent')}
        </div>
      )}
      <div className="flex items-start gap-3 sm:gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold flex-shrink-0">
          {it.requester[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="num text-xs text-ink-muted mb-0.5">{it.pr_number}</div>
          <div className="text-lg sm:text-xl font-bold mb-1 leading-snug">{it.title}</div>
          <div className="text-sm sm:text-base text-ink-soft">
            {it.requester}{it.dept ? ` · ${it.dept}` : ''}<br className="sm:hidden" />
            <span className="hidden sm:inline"> · </span>{it.age}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
        <div className="text-sm text-ink-muted">{t('approvals.items', { count: it.items })} · {srcLabel[it.source].replace(/^[^\s]+\s/, '')}</div>
        <div className="num text-2xl font-bold">฿ {fmtBaht(it.total_minor)}</div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={() => onDecide(it, 'approved')} className="btn flex-1 bg-green-600 hover:bg-green-700 text-white shadow-soft">
          <Check className="w-5 h-5" />
          {t('approvals.approve')}
        </button>
        <button onClick={() => onDecide(it, 'rejected')} className="btn-danger flex-1">
          <X className="w-5 h-5" />
          {t('approvals.reject')}
        </button>
        <Link href={`/pr/${it.id}`} className="btn-secondary px-5 btn-sm">
          <Eye className="w-5 h-5" />
          {t('approvals.view')}
        </Link>
      </div>
    </div>
  );
}

function EmptyInbox() {
  const { t } = useT();
  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-10 text-center border border-green-200">
      <div className="text-5xl mb-3">🎉</div>
      <div className="text-2xl font-bold mb-1 text-green-900">{t('approvals.empty')}</div>
      <div className="text-base text-green-800 mb-5">{t('approvals.empty.sub')}</div>
      <Link href="/" className="btn-sm inline-flex rounded-xl bg-white border-2 border-green-300 hover:bg-green-50 text-green-800 font-bold px-5 items-center gap-2">
        <Home className="w-5 h-5" />
        {t('common.home')}
      </Link>
    </div>
  );
}

function RecentDecision({
  icon, title, by, label, labelCls, iconCls,
}: { icon: 'check' | 'x'; title: string; by: string; label: string; labelCls: string; iconCls: string }) {
  const Icon = icon === 'check' ? Check : X;
  return (
    <div className="bg-white rounded-xl p-4 border border-line flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full ${iconCls} flex items-center justify-center`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{title}</div>
        <div className="text-sm text-ink-muted">{by}</div>
      </div>
      <span className={`text-sm font-medium ${labelCls} flex-shrink-0`}>{label}</span>
    </div>
  );
}
