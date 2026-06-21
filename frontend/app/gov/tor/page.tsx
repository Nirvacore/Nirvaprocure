'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Plus, Scale } from 'lucide-react';
import { gov as govApi, type ToRListItem } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { mergeMockTorList } from '@/lib/tor-mock-store';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useT } from '@/lib/i18n/provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';

const MOCK_TOR_LIST: ToRListItem[] = [
  {
    id: 'tor-1',
    title: 'จัดซื้อเครื่องคอมพิวเตอร์ จำนวน 20 เครื่อง',
    procurement_kind: 'goods',
    status: 'draft',
    created_at: '2026-06-10T09:00:00Z',
  },
  {
    id: 'tor-2',
    title: 'จ้างเหมาบำรุงรักษาระบบเครือข่าย',
    procurement_kind: 'services',
    status: 'approved',
    created_at: '2026-06-05T14:30:00Z',
  },
  {
    id: 'tor-3',
    title: 'ก่อสร้างอาคารคลังสินค้า',
    procurement_kind: 'construction',
    status: 'published',
    created_at: '2026-05-28T11:00:00Z',
  },
];

type StatusFilter = '' | ToRListItem['status'];

const FILTERS: { key: StatusFilter; labelKey: TranslationKey }[] = [
  { key: '',          labelKey: 'pr.filter.all' },
  { key: 'draft',     labelKey: 'tor.status.draft' },
  { key: 'review',    labelKey: 'tor.status.review' },
  { key: 'approved',  labelKey: 'tor.status.approved' },
  { key: 'published', labelKey: 'tor.status.published' },
];

const KIND_LABEL_KEYS: Record<ToRListItem['procurement_kind'], TranslationKey> = {
  goods: 'tor.kind.goods',
  services: 'tor.kind.services',
  construction: 'tor.kind.construction',
};

const STATUS_STYLE: Record<ToRListItem['status'], { bg: string; text: string; labelKey: TranslationKey }> = {
  draft:     { bg: 'bg-gray-100',   text: 'text-ink-soft',   labelKey: 'tor.status.draft' },
  review:    { bg: 'bg-amber-100',  text: 'text-amber-800',  labelKey: 'tor.status.review' },
  approved:  { bg: 'bg-green-100',  text: 'text-green-800',  labelKey: 'tor.status.approved' },
  published: { bg: 'bg-brand-100',  text: 'text-brand-700',  labelKey: 'tor.status.published' },
};

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
            <span className="text-xs text-ink-muted num">{fmtDate}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function TorListPage() {
  const { t } = useT();
  const [filter, setFilter] = useState<StatusFilter>('');
  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(() => govApi.list(), mergeMockTorList(MOCK_TOR_LIST)),
  );

  const filtered = useMemo(
    () => (filter && data ? data.filter((row) => row.status === filter) : data ?? []),
    [data, filter],
  );

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
        <Link href="/gov/tor/new" className="btn-primary px-5">
          <Plus className="w-5 h-5" />
          {t('tor.list.new')}
        </Link>
      </div>

      {data && data.length > 0 && (
        <div className="flex gap-2 flex-wrap overflow-x-auto pb-1">
          {FILTERS.map(({ key, labelKey }) => (
            <button
              key={key || 'all'}
              type="button"
              onClick={() => setFilter(key)}
              className={`min-h-btn-sm px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === key
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-line text-ink-soft hover:bg-gray-50'
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
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

      {data && data.length > 0 && filtered.length === 0 && (
        <div className="card text-center py-12">
          <FileText className="w-10 h-10 text-ink-muted mx-auto mb-3" />
          <p className="text-lg font-bold mb-1">{t('tor.list.filter.empty')}</p>
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
