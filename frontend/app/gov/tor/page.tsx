'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, FileText, Plus, Scale, Search, ShoppingCart } from 'lucide-react';
import { gov as govApi, type ToRListItem } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { mergeMockTorList } from '@/lib/tor-mock-store';
import { MOCK_TOR_LIST, sortTorList, TOR_KIND_LABEL_KEYS, TOR_LIST_STATUS_STYLE } from '@/lib/tor-shared';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useT } from '@/lib/i18n/provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';

type StatusFilter = '' | ToRListItem['status'];
type KindFilter = '' | ToRListItem['procurement_kind'];

const STATUS_FILTERS: { key: StatusFilter; labelKey: TranslationKey }[] = [
  { key: '',          labelKey: 'pr.filter.all' },
  { key: 'draft',     labelKey: 'tor.status.draft' },
  { key: 'review',    labelKey: 'tor.status.review' },
  { key: 'approved',  labelKey: 'tor.status.approved' },
  { key: 'published', labelKey: 'tor.status.published' },
];

const KIND_FILTERS: { key: KindFilter; labelKey: TranslationKey }[] = [
  { key: '',             labelKey: 'pr.filter.all' },
  { key: 'goods',        labelKey: 'tor.kind.goods' },
  { key: 'services',     labelKey: 'tor.kind.services' },
  { key: 'construction', labelKey: 'tor.kind.construction' },
];

const KIND_LABEL_KEYS = TOR_KIND_LABEL_KEYS;
const STATUS_STYLE = TOR_LIST_STATUS_STYLE;

function TorCard({ row }: { row: ToRListItem }) {
  const { t, locale } = useT();
  const status = STATUS_STYLE[row.status];
  const fmtDate = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(row.created_at));

  return (
    <Link href={`/gov/tor/${row.id}`} className="card hover:border-brand-300 transition-colors block">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-ink leading-snug mb-2">{row.title}</div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-ink-soft">
              {t(KIND_LABEL_KEYS[row.procurement_kind])}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
              {t(status.labelKey)}
            </span>
            {row.linked_pr_id && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 inline-flex items-center gap-1">
                <ShoppingCart className="w-3 h-3" />
                {t('tor.linked_pr.badge', { number: row.linked_pr_number ?? row.linked_pr_id })}
              </span>
            )}
            <span className="text-xs text-ink-muted num">{fmtDate}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function TorListPage() {
  const { t } = useT();
  const pathname = usePathname();
  const revisited = useRef(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('');
  const [query, setQuery] = useState('');
  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(() => govApi.list(), sortTorList(mergeMockTorList(MOCK_TOR_LIST))),
  );

  useEffect(() => {
    if (pathname !== '/gov/tor') return;
    if (!revisited.current) {
      revisited.current = true;
      return;
    }
    void refresh();
  }, [pathname, refresh]);

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (statusFilter) rows = rows.filter((row) => row.status === statusFilter);
    if (kindFilter) rows = rows.filter((row) => row.procurement_kind === kindFilter);
    const q = query.trim().toLowerCase();
    if (q) rows = rows.filter((row) => row.title.toLowerCase().includes(q));
    return rows;
  }, [data, statusFilter, kindFilter, query]);

  const hasActiveFilters = Boolean(statusFilter || kindFilter || query.trim());
  const totalCount = data?.length ?? 0;

  function clearFilters() {
    setStatusFilter('');
    setKindFilter('');
    setQuery('');
  }

  const noMatches = Boolean(data && data.length > 0 && filtered.length === 0);
  const emptyMessageKey: TranslationKey = query.trim()
    ? 'tor.list.search.empty'
    : 'tor.list.filter.empty';

  return (
    <section className="screen space-y-6 max-w-4xl mx-auto">
      <Link href="/" className="btn-sm inline-flex items-center gap-2 text-ink-soft hover:text-ink -ml-2 px-2 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
        <span>{t('common.back')}</span>
      </Link>

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
            <Scale className="w-7 h-7 text-brand-600" />
            {t('tor.list.heading')}
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/gov/tor/new" className="btn-primary px-5">
            <Plus className="w-5 h-5" />
            {t('tor.list.new')}
          </Link>
          <Link href="/gov/tor/templates" className="btn-secondary px-5">
            <FileText className="w-5 h-5" />
            {t('tor.templates.heading')}
          </Link>
        </div>
      </div>

      {data && data.length > 0 && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
            <input
              type="search"
              className="input pl-9 w-full"
              placeholder={t('tor.list.search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2 flex-wrap overflow-x-auto pb-1">
            {STATUS_FILTERS.map(({ key, labelKey }) => (
              <button
                key={key || 'status-all'}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`min-h-btn-sm px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  statusFilter === key
                    ? 'bg-brand-600 text-white'
                    : 'bg-white border border-line text-ink-soft hover:bg-gray-50'
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          <div data-testid="tor-kind-filters" className="flex gap-2 flex-wrap overflow-x-auto pb-1">
            {KIND_FILTERS.map(({ key, labelKey }) => (
              <button
                key={key || 'kind-all'}
                type="button"
                onClick={() => setKindFilter(key)}
                className={`min-h-btn-sm px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  kindFilter === key
                    ? 'bg-brand-600 text-white'
                    : 'bg-white border border-line text-ink-soft hover:bg-gray-50'
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-ink-soft num">
                {t('tor.list.results', { count: filtered.length, total: totalCount })}
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="btn-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                {t('tor.list.clear_filters')}
              </button>
            </div>
          )}
        </>
      )}

      {error && <ErrorBanner message={error?.message} onRetry={refresh} />}
      {loading && !data && <Loading />}

      {data && data.length === 0 && (
        <div className="card text-center py-12">
          <FileText className="w-10 h-10 text-ink-muted mx-auto mb-3" />
          <p className="text-lg font-bold mb-1">{t('tor.list.empty')}</p>
          <p className="text-ink-soft mb-4">{t('tor.list.empty.sub')}</p>
          <Link href="/gov/tor/new" className="btn-primary inline-flex px-5">
            <Plus className="w-5 h-5" />
            {t('tor.list.new')}
          </Link>
        </div>
      )}

      {noMatches && (
        <div className="card text-center py-12">
          <FileText className="w-10 h-10 text-ink-muted mx-auto mb-3" />
          <p className="text-lg font-bold mb-1">{t(emptyMessageKey)}</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-secondary inline-flex px-5 mt-4"
            >
              {t('tor.list.clear_filters')}
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((row) => <TorCard key={row.id} row={row} />)}
        </div>
      )}
    </section>
  );
}
