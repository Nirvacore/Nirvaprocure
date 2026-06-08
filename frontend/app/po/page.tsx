'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Search, Clock, CheckCircle2, Send, XCircle } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import { po as poApi, type PoRow } from '@/lib/api';
import { Loading } from '@/components/Loading';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Status config
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
// PO card
// ---------------------------------------------------------------------------
function PoCard({ row }: { row: PoRow }) {
  const { t, locale } = useT();
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: row.currency ?? 'THB', maximumFractionDigits: 0 })
      .format(n / 100);
  const fmtDate = (d: string | null) =>
    d ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(d)) : '—';

  return (
    <Link href={`/po/${row.id}`} className="card hover:border-brand-300 transition-colors block">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 font-mono text-sm">{row.po_number}</span>
              <PoStatusBadge status={row.status as PoStatus} />
            </div>
            {row.supplier_name && (
              <div className="text-sm text-gray-600 mt-0.5">{row.supplier_name}</div>
            )}
            {row.pr_id && (
              <div className="text-xs text-gray-400 mt-0.5">{t('po.from_pr')}: {row.pr_id.slice(0, 8)}…</div>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="num font-bold text-gray-900">{fmt(row.total_minor)}</div>
          <div className="text-xs text-gray-400 mt-0.5">{fmtDate(row.issued_at)}</div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Mock fallback
// ---------------------------------------------------------------------------
const MOCK_POS: PoRow[] = [
  { id: 'po-1', po_number: 'PO-2026-0018', pr_id: '2',  supplier_id: 'sup-2', supplier_name: 'บริษัท แม็คโคร จำกัด',      status: 'received',  total_minor: 189000_00, currency: 'THB', notes: null, issued_by: 'ปอ นวลรัตน์', issued_at: '2026-05-20', created_at: '2026-05-19' },
  { id: 'po-2', po_number: 'PO-2026-0017', pr_id: '5',  supplier_id: 'sup-3', supplier_name: 'ร้านเครื่องเขียนสยาม',        status: 'received',  total_minor:  25000_00, currency: 'THB', notes: null, issued_by: 'วิภา ศรีสุข',  issued_at: '2026-05-10', created_at: '2026-05-09' },
  { id: 'po-3', po_number: 'PO-2026-0019', pr_id: '1',  supplier_id: 'sup-1', supplier_name: 'HP Authorized Store Thailand', status: 'sent',      total_minor: 808920_00, currency: 'THB', notes: null, issued_by: 'ปอ นวลรัตน์', issued_at: '2026-06-07', created_at: '2026-06-07' },
  { id: 'po-4', po_number: 'PO-2026-0016', pr_id: null, supplier_id: null,    supplier_name: null,                           status: 'draft',     total_minor: 840000_00, currency: 'THB', notes: 'SSD Server x2', issued_by: 'พงษ์ ตันติ', issued_at: null, created_at: '2026-06-01' },
  { id: 'po-5', po_number: 'PO-2026-0015', pr_id: '3',  supplier_id: null,    supplier_name: 'Lazada Partner',               status: 'cancelled', total_minor:       0,   currency: 'THB', notes: 'rejected', issued_by: 'วิภา ศรีสุข',  issued_at: '2026-04-15', created_at: '2026-04-14' },
];

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------
const FILTERS: { key: string; labelKey: string }[] = [
  { key: '',          labelKey: 'audit.all' },
  { key: 'draft',     labelKey: 'po.status.draft' },
  { key: 'sent',      labelKey: 'po.status.sent' },
  { key: 'received',  labelKey: 'po.status.received' },
  { key: 'cancelled', labelKey: 'po.status.cancelled' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function PoListPage() {
  const { t } = useT();
  const [rows, setRows]       = useState<PoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('');
  const [query, setQuery]     = useState('');

  const load = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const data = await poApi.list(status || undefined);
      setRows(data);
    } catch {
      // Offline / backend not running → mock
      setRows(status ? MOCK_POS.filter(p => p.status === status) : MOCK_POS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(filter || undefined); }, [load, filter]);

  const filtered = query
    ? rows.filter(r =>
        r.po_number.toLowerCase().includes(query.toLowerCase()) ||
        (r.supplier_name ?? '').toLowerCase().includes(query.toLowerCase()))
    : rows;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('po.title')}</h1>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          className="input pl-9 w-full"
          placeholder={t('po.search')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 flex-wrap mb-6 overflow-x-auto pb-1">
        {FILTERS.map(({ key, labelKey }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === key
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t(labelKey as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">{t('po.empty')}</p>
          <p className="text-sm text-gray-500 mt-1">{t('po.empty.sub')}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(row => <PoCard key={row.id} row={row} />)}
        </div>
      )}
    </main>
  );
}
