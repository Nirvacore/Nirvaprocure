'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, ChevronRight, SearchX, Loader2 } from 'lucide-react';
import { mockPrs, srcLabel, type Source } from '@/lib/mock-data';
import { StatusPill, type PrStatus } from '@/components/StatusPill';
import { fmtBaht } from '@/lib/format';
import { withMockFallback } from '@/lib/api-with-fallback';
import { pr as prApi, ApiError, type PrSummary } from '@/lib/api';
import { SkeletonRows } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useT } from '@/lib/i18n/provider';
import clsx from 'clsx';

type Filter = 'all' | PrStatus;
// Filter keys map to dictionary entries. Labels resolved per render via useT().
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

/** Adapter from API wire format to the row shape this UI was built around. */
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

/**
 * Cursor-paginated list. The backend returns `next_cursor` (or null) and we
 * append page-by-page. Filter is client-side since the active filter often
 * fits within the first page, but if a customer ever needs server-side
 * filter+pagination we'll move it server-side at that time.
 */
export default function PrListPage() {
  const { t } = useT();
  const [filter, setFilter]     = useState<Filter>('all');
  const [rows,   setRows]       = useState<Row[] | null>(null);
  const [cursor, setCursor]     = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [more,    setMore]      = useState(false);
  const [error,   setError]     = useState<Error | null>(null);

  async function loadPage(append: boolean, fromCursor?: string) {
    append ? setMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await withMockFallback(
        async () => {
          const res = await prApi.list({ limit: PAGE_SIZE, cursor: fromCursor });
          return { data: res.data.map(toRow), next_cursor: res.next_cursor };
        },
        // Offline fallback: pretend the mock is a single page.
        { data: mockPrs as Row[], next_cursor: null },
      );
      setCursor(page.next_cursor);
      setRows((prev) => (append && prev ? [...prev, ...page.data] : page.data));
    } catch (err) {
      setError(err as Error);
    } finally {
      append ? setMore(false) : setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return filter === 'all' ? rows : rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  return (
    <section className="screen space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-1">{t('pr.list.heading')}</h1>
          <p className="text-base text-gray-600">{t('pr.list.sub')}</p>
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
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
            )}
          >
            {t(f.tKey)}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error.message} onRetry={() => loadPage(false)} />}
      {loading && !rows && <SkeletonRows />}
      {!loading && filtered.length === 0 && (
        <EmptyState filterLabel={t(FILTERS.find((f) => f.key === filter)!.tKey)} />
      )}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/pr/${r.id}`}
              className="block w-full text-left bg-white rounded-2xl p-5 shadow-soft border border-gray-200 hover:border-brand-300 hover:shadow-lift transition group"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="num text-xs text-gray-500 mb-0.5">{r.pr_number}</div>
                  <div className="text-lg font-bold mb-1 leading-snug">{r.title}</div>
                  <div className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{srcLabel[r.source]}</span>
                    <span>·</span>
                    <span>{r.created_at}</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-600 transition flex-shrink-0 mt-1" />
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

      {/* Load-more sits at the bottom of the list when there's another page.
          Hidden once the cursor exhausts so the user knows they reached the end. */}
      {cursor && (
        <button
          onClick={() => loadPage(true, cursor)}
          disabled={more}
          className="btn-secondary w-full"
        >
          {more ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {more ? t('common.loading') : t('pr.load.more')}
        </button>
      )}
    </section>
  );
}

function EmptyState({ filterLabel }: { filterLabel: string }) {
  const { t } = useT();
  return (
    <div className="bg-white rounded-2xl p-10 text-center border border-gray-200">
      <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
        <SearchX className="w-8 h-8 text-gray-400" />
      </div>
      <div className="text-xl font-bold mb-1">{t('pr.empty.heading', { filter: filterLabel })}</div>
      <div className="text-base text-gray-600 mb-4">{t('pr.empty.sub')}</div>
      <Link href="/pr/new" className="btn-primary btn-sm px-5 inline-flex">
        <Plus className="w-5 h-5" />
        {t('pr.list.new')}
      </Link>
    </div>
  );
}
