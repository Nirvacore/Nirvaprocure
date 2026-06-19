'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, ChevronRight, SearchX, Loader2 } from 'lucide-react';
import { mockPrs, srcLabel, type Source } from '@/lib/mock-data';
import { StatusPill, type PrStatus } from '@/components/StatusPill';
import { fmtBaht } from '@/lib/format';
import { withMockFallback } from '@/lib/api-with-fallback';
import { useResource } from '@/lib/use-resource';
import { pr as prApi, type PrSummary } from '@/lib/api';
import { SkeletonRows } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useT } from '@/lib/i18n/provider';
import clsx from 'clsx';

type Filter = 'all' | PrStatus;
const FILTERS: { key: Filter; tKey:
  'pr.filter.all' | 'pr.filter.pending' | 'pr.filter.approved' | 'pr.filter.draft' | 'pr.filter.rejected'
}[] = [
  { key: 'all',      tKey: 'pr.filter.all' },
  { key: 'pending',  tKey: 'pr.filter.pending' },
  { key: 'approved', tKey: 'pr.filter.approved' },
  { key: 'draft',    tKey: 'pr.filter.draft' },
  { key: 'rejected', tKey: 'pr.filter.rejected' },
];

const PAGE_SIZE = 50;

interface Row {
  id: string;
  pr_number: string;
  title: string;
  status: PrStatus;
  total_minor: number;
  source: Source;
  created_at: string;
}

type PrPage = { data: Row[]; next_cursor: string | null };

function toRow(p: PrSummary): Row {
  return {
    id: p.id,
    pr_number: p.pr_number,
    title: p.title,
    status: p.status,
    total_minor: p.total.amount_minor,
    source: 'manual',
    created_at: p.created_at,
  };
}

const MOCK_PAGE: PrPage = { data: mockPrs as Row[], next_cursor: null };

export default function PrListPage() {
  const { t } = useT();
  const [filter, setFilter]       = useState<Filter>('all');
  const [cursor, setCursor]       = useState<string | null>(null);
  const [accumulated, setAccumulated] = useState<Row[]>([]);

  const { data: page, loading, error, refresh } = useResource(
    () => withMockFallback(
      async () => {
        const res = await prApi.list({ limit: PAGE_SIZE, cursor: cursor ?? undefined });
        return { data: res.data.map(toRow), next_cursor: res.next_cursor };
      },
      MOCK_PAGE,
    ),
    [cursor],
  );

  useEffect(() => {
    if (!page) return;
    setAccumulated(prev => (cursor ? [...prev, ...page.data] : page.data));
  }, [page, cursor]);

  const nextCursor = page?.next_cursor ?? null;
  const loadingMore = loading && cursor !== null;
  const initialLoading = loading && cursor === null && accumulated.length === 0;

  const filtered = useMemo(() => {
    return filter === 'all' ? accumulated : accumulated.filter((r) => r.status === filter);
  }, [accumulated, filter]);

  return (
    <section className="screen space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-1">{t('pr.list.heading')}</h1>
          <p className="text-base text-ink-soft">{t('pr.list.sub')}</p>
        </div>
        <Link href="/pr/new" className="btn-primary px-6">
          <Plus className="w-5 h-5" />
          {t('pr.list.new')}
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={clsx(
              'min-h-btn-sm px-4 rounded-full text-sm font-medium',
              filter === f.key
                ? 'bg-brand-600 text-white'
                : 'bg-white border border-line text-ink-soft hover:bg-gray-50',
            )}
          >
            {t(f.tKey)}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error.message} onRetry={refresh} />}
      {initialLoading && <SkeletonRows />}
      {!initialLoading && filtered.length === 0 && (
        <EmptyState filterLabel={t(FILTERS.find((f) => f.key === filter)!.tKey)} />
      )}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/pr/${r.id}`}
              className="block w-full text-left bg-white rounded-2xl p-5 shadow-soft border border-line hover:border-brand-300 hover:shadow-lift transition group"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="num text-xs text-ink-muted mb-0.5">{r.pr_number}</div>
                  <div className="text-lg font-bold mb-1 leading-snug">{r.title}</div>
                  <div className="text-sm text-ink-soft flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{srcLabel[r.source]}</span>
                    <span>·</span>
                    <span>{r.created_at}</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-ink-muted group-hover:text-brand-600 transition flex-shrink-0 mt-1" />
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <StatusPill status={r.status} />
                <div className="num text-xl font-bold">
                  {r.total_minor ? `฿ ${fmtBaht(r.total_minor)}` : '—'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {nextCursor && (
        <button
          onClick={() => setCursor(nextCursor)}
          disabled={loadingMore}
          className="btn-secondary w-full"
        >
          {loadingMore ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {loadingMore ? t('common.loading') : t('pr.load.more')}
        </button>
      )}
    </section>
  );
}

function EmptyState({ filterLabel }: { filterLabel: string }) {
  const { t } = useT();
  return (
    <div className="bg-white rounded-2xl p-10 text-center border border-line">
      <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
        <SearchX className="w-8 h-8 text-ink-muted" />
      </div>
      <div className="text-xl font-bold mb-1">{t('pr.empty.heading', { filter: filterLabel })}</div>
      <div className="text-base text-ink-soft mb-4">{t('pr.empty.sub')}</div>
      <Link href="/pr/new" className="btn-primary btn-sm px-5 inline-flex">
        <Plus className="w-5 h-5" />
        {t('pr.list.new')}
      </Link>
    </div>
  );
}
