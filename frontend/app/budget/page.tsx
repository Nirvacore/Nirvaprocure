'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { Wallet, Lock, Plus } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import { budgets as budgetsApi, type BudgetRow } from '@/lib/api';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

// ---------------------------------------------------------------------------
// Mock fallback — 4 departments with realistic THB amounts
// ---------------------------------------------------------------------------
function currentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function mockBudgets(month: string): BudgetRow[] {
  const monthStart = `${month}-01`;
  return [
    { id: 'bud-1', department_id: 'dept-fin',   department_name: 'การเงิน',  month_start: monthStart, amount_minor:  500000_00, spent_minor:  280000_00, remaining_minor:  220000_00, pct_used: 56, soft_block: false },
    { id: 'bud-2', department_id: 'dept-mkt',   department_name: 'การตลาด',  month_start: monthStart, amount_minor:  800000_00, spent_minor:  650000_00, remaining_minor:  150000_00, pct_used: 81, soft_block: true  },
    { id: 'bud-3', department_id: 'dept-it',    department_name: 'ไอที',     month_start: monthStart, amount_minor: 1200000_00, spent_minor: 1150000_00, remaining_minor:   50000_00, pct_used: 96, soft_block: true  },
    { id: 'bud-4', department_id: 'dept-admin', department_name: 'บริหาร',   month_start: monthStart, amount_minor:  300000_00, spent_minor:  120000_00, remaining_minor:  180000_00, pct_used: 40, soft_block: false },
  ];
}

const DEPARTMENTS = [
  { id: 'dept-fin',   name: 'การเงิน' },
  { id: 'dept-mkt',   name: 'การตลาด' },
  { id: 'dept-it',    name: 'ไอที' },
  { id: 'dept-admin', name: 'บริหาร' },
];

function barColor(pct: number): string {
  if (pct > 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-green-500';
}

function pctTextColor(pct: number): string {
  if (pct > 90) return 'text-red-700 bg-red-100';
  if (pct >= 70) return 'text-amber-700 bg-amber-100';
  return 'text-green-700 bg-green-100';
}

// ---------------------------------------------------------------------------
// Budget card
// ---------------------------------------------------------------------------
function BudgetCard({ row, onEdit }: { row: BudgetRow; onEdit: (row: BudgetRow) => void }) {
  const { t, locale } = useT();
  const pct = row.amount_minor > 0
    ? Math.round((row.spent_minor / row.amount_minor) * 100)
    : 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })
      .format(n / 100);

  return (
    <button type="button" className="card text-left w-full hover:border-brand-300 transition-colors" onClick={() => onEdit(row)}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold text-gray-900">{row.department_name}</h3>
        <div className="flex items-center gap-2">
          {row.soft_block && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
              <Lock className="w-3 h-3" />
              {t('budget.soft_block')}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pctTextColor(pct)}`}>
            {pct}%
          </span>
        </div>
      </div>

      <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${barColor(pct)}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-gray-500 text-xs">{t('budget.spent')}</div>
          <div className="num font-semibold">{fmt(row.spent_minor)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">{t('budget.amount')}</div>
          <div className="num font-semibold">{fmt(row.amount_minor)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">{t('budget.remaining')}</div>
          <div className="num font-semibold">{fmt(row.remaining_minor)}</div>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Upsert modal
// ---------------------------------------------------------------------------
interface UpsertModalProps {
  month: string;
  existing?: BudgetRow;
  onClose: () => void;
  onSaved: (row: BudgetRow) => void;
}

function UpsertModal({ month, existing, onClose, onSaved }: UpsertModalProps) {
  const { t } = useT();
  const [departmentId, setDepartmentId] = useState(existing?.department_id ?? DEPARTMENTS[0].id);
  const [amountBaht, setAmountBaht] = useState(
    existing ? String(existing.amount_minor / 100) : '',
  );
  const [softBlock, setSoftBlock] = useState(existing?.soft_block ?? false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setDepartmentId(existing?.department_id ?? DEPARTMENTS[0].id);
    setAmountBaht(existing ? String(existing.amount_minor / 100) : '');
    setSoftBlock(existing?.soft_block ?? false);
  }, [existing]);

  const save = async () => {
    const baht = parseFloat(amountBaht.replace(/,/g, ''));
    if (!Number.isFinite(baht) || baht < 0) {
      setErr('กรุณากรอกจำนวนเงินที่ถูกต้อง');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const row = await budgetsApi.upsert({
        department_id: departmentId,
        amount_minor: Math.round(baht * 100),
        month_start: `${month}-01`,
        soft_block: softBlock,
      });
      onSaved(row);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lift w-full max-w-lg">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{t('budget.add')}</h2>
        </div>
        <div className="p-6 space-y-4">
          {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
          <label className="block">
            <span className="label">{t('budget.dept')}</span>
            <select
              className="input mt-1"
              value={departmentId}
              disabled={!!existing}
              onChange={e => setDepartmentId(e.target.value)}
            >
              {DEPARTMENTS.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">{t('budget.amount')} (THB)</span>
            <input
              className="input mt-1 w-full"
              type="number"
              min="0"
              step="1"
              value={amountBaht}
              onChange={e => setAmountBaht(e.target.value)}
              placeholder="500000"
            />
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={softBlock}
              onChange={e => setSoftBlock(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">{t('budget.soft_block')}</span>
          </label>
        </div>
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>
            {t('budget.cancel')}
          </button>
          <button className="btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? '…' : t('budget.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function BudgetPage() {
  const { t } = useT();
  const [month, setMonth] = useState(currentMonth);
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BudgetRow | undefined>();

  const load = useCallback(async (m: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await budgetsApi.list(m);
      setRows(data);
    } catch {
      setRows(mockBudgets(m));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(month); }, [load, month]);

  const handleSaved = (row: BudgetRow) => {
    setRows(prev => {
      const idx = prev.findIndex(r => r.department_id === row.department_id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = row;
        return next;
      }
      return [...prev, row];
    });
    setShowModal(false);
    setEditing(undefined);
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="w-7 h-7 text-brand-600" />
          {t('budget.title')}
        </h1>
        <button className="btn-primary flex items-center gap-1.5" onClick={() => { setEditing(undefined); setShowModal(true); }}>
          <Plus className="w-4 h-4" />
          {t('budget.add')}
        </button>
      </div>

      <div className="mb-6">
        <label className="label mb-1">{t('budget.month')}</label>
        <input
          type="month"
          className="input max-w-xs"
          value={month}
          onChange={e => setMonth(e.target.value)}
        />
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <div className="text-center py-20">
          <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">{t('budget.empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {rows.map(row => (
            <BudgetCard
              key={row.id}
              row={row}
              onEdit={r => { setEditing(r); setShowModal(true); }}
            />
          ))}
        </div>
      )}

      {showModal && (
        <UpsertModal
          month={month}
          existing={editing}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
}
