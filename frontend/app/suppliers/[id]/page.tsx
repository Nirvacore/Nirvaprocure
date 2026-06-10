'use client';
import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, AlertTriangle, CheckCircle2, ShieldAlert,
  XCircle, Receipt,
} from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import { suppliers as suppliersApi, type SupplierRow } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

// ---------------------------------------------------------------------------
// Risk badge (same pattern as list page)
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
// Mock fallback
// ---------------------------------------------------------------------------
const MOCK_SUPPLIERS: SupplierRow[] = [
  { id: 'sup-1', code: 'SUP-001', name: 'HP Authorized Store Thailand', contact_name: 'คุณวิภา', contact_email: 'sales@hp-th.co.th', contact_phone: '02-111-2222', category: 'IT', tax_id: '0105555000001', is_active: true, risk_tier: 'low',    total_pr_count: 12, total_spent_minor: 180000_00, created_at: '2026-01-10' },
  { id: 'sup-2', code: 'SUP-002', name: 'บริษัท แม็คโคร จำกัด',           contact_name: 'คุณสมชาย', contact_email: 'b2b@makro.co.th',   contact_phone: '02-222-3333', category: 'อาหาร', tax_id: '0105555000002', is_active: true, risk_tier: 'low',    total_pr_count: 28, total_spent_minor: 540000_00, created_at: '2026-01-05' },
  { id: 'sup-3', code: 'SUP-003', name: 'ร้านเครื่องเขียนสยาม',             contact_name: null,        contact_email: null,               contact_phone: '02-333-4444', category: 'สำนักงาน', tax_id: null, is_active: true, risk_tier: 'medium', total_pr_count:  5, total_spent_minor:  24000_00, created_at: '2026-02-01' },
  { id: 'sup-4', code: 'SUP-004', name: 'Global Tech Import Co.',          contact_name: 'David',     contact_email: 'david@globaltech.com', contact_phone: null,           category: 'IT', tax_id: '0105555000004', is_active: false, risk_tier: 'high',   total_pr_count:  3, total_spent_minor: 840000_00, created_at: '2026-03-15' },
];

type EditableFieldKey = 'name' | 'category' | 'tax_id' | 'contact_name' | 'contact_email' | 'contact_phone';

// ---------------------------------------------------------------------------
// Inline editable field
// ---------------------------------------------------------------------------
function InlineField({
  label,
  value,
  field,
  onSave,
}: {
  label: string;
  value: string | null;
  field: EditableFieldKey;
  onSave: (field: EditableFieldKey, value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    const trimmed = draft.trim();
    if (trimmed === (value ?? '')) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(field, trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void commit();
    if (e.key === 'Escape') {
      setDraft(value ?? '');
      setEditing(false);
    }
  };

  return (
    <div className="py-2">
      <div className="text-xs font-medium text-gray-500 mb-0.5">{label}</div>
      {editing ? (
        <input
          className="input text-sm"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={onKeyDown}
          autoFocus
          disabled={saving}
        />
      ) : (
        <button
          type="button"
          className="text-left w-full text-base text-gray-900 hover:bg-gray-50 rounded-lg px-2 -mx-2 py-1 transition-colors"
          onClick={() => { setDraft(value ?? ''); setEditing(true); }}
        >
          {value || '—'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail body
// ---------------------------------------------------------------------------
function DetailBody({
  supplier,
  onUpdate,
}: {
  supplier: SupplierRow;
  onUpdate: (patch: Partial<SupplierRow>) => void;
}) {
  const { t, locale } = useT();
  const router = useRouter();
  const [archiving, setArchiving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toggling, setToggling] = useState(false);

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })
      .format(n / 100);

  const saveField = useCallback(async (field: EditableFieldKey, value: string) => {
    const body: Record<string, string | null> = { [field]: value || null };
    const updated = await suppliersApi.update(supplier.id, body);
    onUpdate(updated);
  }, [supplier.id, onUpdate]);

  const toggleActive = async () => {
    setToggling(true);
    try {
      const updated = await suppliersApi.update(supplier.id, { is_active: !supplier.is_active });
      onUpdate(updated);
    } finally {
      setToggling(false);
    }
  };

  const archive = async () => {
    setArchiving(true);
    try {
      await suppliersApi.archive(supplier.id);
      router.push('/suppliers');
    } catch {
      setArchiving(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-gray-500" />
            </div>
            <div>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{supplier.code}</span>
              <InlineField
                label={t('suppliers.new.name')}
                value={supplier.name}
                field="name"
                onSave={saveField}
              />
            </div>
          </div>
          <RiskBadge tier={supplier.risk_tier as RiskTier | null} />
        </div>

        <div className="border-t border-gray-100 pt-4 grid sm:grid-cols-2 gap-x-6">
          <InlineField
            label={t('suppliers.category')}
            value={supplier.category}
            field="category"
            onSave={saveField}
          />
          <InlineField
            label={t('suppliers.new.tax_id')}
            value={supplier.tax_id}
            field="tax_id"
            onSave={saveField}
          />
        </div>

        <div className="border-t border-gray-100 mt-4 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('suppliers.contact')}</h3>
          <InlineField
            label={t('suppliers.new.contact')}
            value={supplier.contact_name}
            field="contact_name"
            onSave={saveField}
          />
          <InlineField
            label={t('suppliers.new.email')}
            value={supplier.contact_email}
            field="contact_email"
            onSave={saveField}
          />
          <InlineField
            label={t('suppliers.new.phone')}
            value={supplier.contact_phone}
            field="contact_phone"
            onSave={saveField}
          />
        </div>

        <div className="border-t border-gray-100 mt-4 pt-4 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{t('suppliers.active')}</span>
          <button
            type="button"
            role="switch"
            aria-checked={supplier.is_active}
            disabled={toggling}
            onClick={() => void toggleActive()}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              supplier.is_active ? 'bg-brand-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                supplier.is_active ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
        {!supplier.is_active && (
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            {t('suppliers.inactive')}
          </p>
        )}
      </div>

      <div className="card">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-gray-400" />
          {t('suppliers.history')}
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-gray-50">
            <div className="text-sm text-gray-500">{t('suppliers.spend')}</div>
            <div className="num text-2xl font-bold mt-1">{fmt(supplier.total_spent_minor)}</div>
          </div>
          <div className="p-4 rounded-xl bg-gray-50">
            <div className="text-sm text-gray-500">{t('suppliers.pr_count_label')}</div>
            <div className="num text-2xl font-bold mt-1">
              {t('suppliers.pr_count').replace('{n}', String(supplier.total_pr_count))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="btn-danger"
          onClick={() => setShowConfirm(true)}
          disabled={archiving}
        >
          {t('suppliers.archive')}
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lift w-full max-w-sm p-6">
            <p className="text-base text-gray-800 mb-6">
              {t('suppliers.archive.confirm')} ({supplier.name})
            </p>
            <div className="flex justify-end gap-3">
              <button className="btn-ghost" onClick={() => setShowConfirm(false)} disabled={archiving}>
                {t('common.cancel')}
              </button>
              <button className="btn-danger" onClick={() => void archive()} disabled={archiving}>
                {archiving ? '…' : t('suppliers.archive')}
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
export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();
  const [local, setLocal] = useState<SupplierRow | null>(null);

  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(
      () => suppliersApi.get(id),
      MOCK_SUPPLIERS.find(s => s.id === id) ?? MOCK_SUPPLIERS[0],
    ),
    [id],
  );

  const supplier = local ?? data;

  const handleUpdate = (patch: Partial<SupplierRow>) => {
    setLocal(prev => ({ ...(prev ?? data!), ...patch }));
  };

  return (
    <section className="screen space-y-6 max-w-3xl mx-auto">
      <Link
        href="/suppliers"
        className="btn-sm inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 -ml-2 px-2 rounded-lg"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>{t('common.back')}</span>
      </Link>

      {error && <ErrorBanner message={error.message} onRetry={refresh} />}
      {loading && !supplier && <Loading />}
      {supplier && <DetailBody supplier={supplier} onUpdate={handleUpdate} />}
    </section>
  );
}
