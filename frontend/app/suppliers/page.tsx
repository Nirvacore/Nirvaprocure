'use client';
import React, { useEffect, useState } from 'react';
import { Building2, Search, Plus, AlertTriangle, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import { suppliers as suppliersApi, type SupplierRow } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Risk badge
// ---------------------------------------------------------------------------
type RiskTier = 'low' | 'medium' | 'high' | 'critical';

const RISK_STYLE: Record<RiskTier, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  low:      { bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle2 },
  medium:   { bg: 'bg-amber-100',  text: 'text-amber-700',  icon: AlertTriangle },
  high:     { bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertTriangle },
  critical: { bg: 'bg-red-100',    text: 'text-red-700',    icon: ShieldAlert },
};

function RiskBadge({ tier }: { tier: RiskTier | null }) {
  const { t } = useT();
  if (!tier) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
        {t('suppliers.risk.none')}
      </span>
    );
  }
  const { bg, text, icon: Icon } = RISK_STYLE[tier];
  const label = t(`suppliers.risk.${tier}` as Parameters<typeof t>[0]);
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${bg} ${text}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Add supplier modal
// ---------------------------------------------------------------------------
interface AddModalProps {
  onClose: () => void;
  onCreated: (row: SupplierRow) => void;
}

function AddModal({ onClose, onCreated }: AddModalProps) {
  const { t } = useT();
  const [form, setForm] = useState({
    code: '', name: '', contact_name: '', contact_email: '',
    contact_phone: '', category: '', tax_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setErr('รหัสและชื่อบริษัทจำเป็นต้องกรอก');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const row = await suppliersApi.create({
        code: form.code.trim(),
        name: form.name.trim(),
        contact_name:  form.contact_name  || undefined,
        contact_email: form.contact_email || undefined,
        contact_phone: form.contact_phone || undefined,
        category:      form.category      || undefined,
        tax_id:        form.tax_id        || undefined,
      });
      onCreated(row);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lift w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{t('suppliers.new.title')}</h2>
        </div>
        <div className="p-6 space-y-4">
          {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="label">{t('suppliers.new.code')} *</span>
              <input className="input mt-1" value={form.code} onChange={set('code')}
                placeholder="SUP-001" maxLength={30} />
            </label>
            <label className="block">
              <span className="label">{t('suppliers.new.category')}</span>
              <input className="input mt-1" value={form.category} onChange={set('category')}
                placeholder="สำนักงาน, IT, อาหาร…" maxLength={100} />
            </label>
          </div>
          <label className="block">
            <span className="label">{t('suppliers.new.name')} *</span>
            <input className="input mt-1 w-full" value={form.name} onChange={set('name')}
              placeholder="บริษัท ABC จำกัด" maxLength={200} />
          </label>
          <label className="block">
            <span className="label">{t('suppliers.new.contact')}</span>
            <input className="input mt-1 w-full" value={form.contact_name} onChange={set('contact_name')}
              placeholder="คุณสมชาย" maxLength={200} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="label">{t('suppliers.new.email')}</span>
              <input className="input mt-1" type="email" value={form.contact_email} onChange={set('contact_email')}
                placeholder="sales@abc.co.th" />
            </label>
            <label className="block">
              <span className="label">{t('suppliers.new.phone')}</span>
              <input className="input mt-1" value={form.contact_phone} onChange={set('contact_phone')}
                placeholder="02-xxx-xxxx" maxLength={30} />
            </label>
          </div>
          <label className="block">
            <span className="label">{t('suppliers.new.tax_id')}</span>
            <input className="input mt-1 w-full" value={form.tax_id} onChange={set('tax_id')}
              placeholder="0105555000000" maxLength={20} />
          </label>
        </div>
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>
            {t('suppliers.new.cancel')}
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? '…' : t('suppliers.new.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Supplier card
// ---------------------------------------------------------------------------
function SupplierCard({ row }: { row: SupplierRow }) {
  const { t, locale } = useT();
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })
      .format(n / 100);

  return (
    <Link href={`/suppliers/${row.id}`} className="card hover:border-brand-300 transition-colors block">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-gray-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 truncate">{row.name}</span>
              {!row.is_active && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />{t('suppliers.inactive')}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500 mt-0.5">
              <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-2">{row.code}</span>
              {row.category && <span className="mr-2">{row.category}</span>}
            </div>
            {row.contact_email && (
              <div className="text-sm text-gray-500 mt-1">{row.contact_email}</div>
            )}
          </div>
        </div>
        <RiskBadge tier={row.risk_tier as RiskTier | null} />
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-sm text-gray-600">
        <span>{t('suppliers.pr_count').replace('{n}', String(row.total_pr_count))}</span>
        <span className="text-gray-300">|</span>
        <span className="font-medium text-gray-800">{fmt(row.total_spent_minor)}</span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Mock fallback — used when backend is not running
// ---------------------------------------------------------------------------
const MOCK_SUPPLIERS: SupplierRow[] = [
  { id: 'sup-1', code: 'SUP-001', name: 'HP Authorized Store Thailand', contact_name: 'คุณวิภา', contact_email: 'sales@hp-th.co.th', contact_phone: '02-111-2222', category: 'IT', tax_id: '0105555000001', is_active: true, risk_tier: 'low',    total_pr_count: 12, total_spent_minor: 180000_00, created_at: '2026-01-10' },
  { id: 'sup-2', code: 'SUP-002', name: 'บริษัท แม็คโคร จำกัด',           contact_name: 'คุณสมชาย', contact_email: 'b2b@makro.co.th',   contact_phone: '02-222-3333', category: 'อาหาร', tax_id: '0105555000002', is_active: true, risk_tier: 'low',    total_pr_count: 28, total_spent_minor: 540000_00, created_at: '2026-01-05' },
  { id: 'sup-3', code: 'SUP-003', name: 'ร้านเครื่องเขียนสยาม',             contact_name: null,        contact_email: null,               contact_phone: '02-333-4444', category: 'สำนักงาน', tax_id: null, is_active: true, risk_tier: 'medium', total_pr_count:  5, total_spent_minor:  24000_00, created_at: '2026-02-01' },
  { id: 'sup-4', code: 'SUP-004', name: 'Global Tech Import Co.',          contact_name: 'David',     contact_email: 'david@globaltech.com', contact_phone: null,           category: 'IT', tax_id: '0105555000004', is_active: false, risk_tier: 'high',   total_pr_count:  3, total_spent_minor: 840000_00, created_at: '2026-03-15' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SuppliersPage() {
  const { t } = useT();
  const [query, setQuery]           = useState('');
  const [debouncedQuery, setDebounced] = useState('');
  const [showAdd, setShowAdd]       = useState(false);

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(
      () => suppliersApi.list(debouncedQuery || undefined),
      debouncedQuery
        ? MOCK_SUPPLIERS.filter(s =>
            s.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
            s.code.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
            (s.contact_email ?? '').toLowerCase().includes(debouncedQuery.toLowerCase()))
        : MOCK_SUPPLIERS,
    ),
    [debouncedQuery],
  );

  const rows     = data ?? [];
  const active   = rows.filter(r => r.is_active);
  const inactive = rows.filter(r => !r.is_active);

  const handleCreated = (row: SupplierRow) => {
    void refresh();
    setShowAdd(false);
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('suppliers.title')}</h1>
        <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t('suppliers.add')}</span>
          <span className="sm:hidden">เพิ่ม</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          className="input pl-9 w-full"
          placeholder={t('suppliers.search')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error.message} /></div>}

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <div className="text-center py-20">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">{t('suppliers.empty')}</p>
          <p className="text-sm text-gray-500 mt-1">{t('suppliers.empty.sub')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active suppliers */}
          {active.length > 0 && (
            <section>
              <div className="grid gap-3">
                {active.map(row => <SupplierCard key={row.id} row={row} />)}
              </div>
            </section>
          )}

          {/* Inactive suppliers */}
          {inactive.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-gray-500 mb-3">{t('suppliers.inactive')}</h2>
              <div className="grid gap-3 opacity-60">
                {inactive.map(row => <SupplierCard key={row.id} row={row} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onCreated={handleCreated} />}
    </main>
  );
}
