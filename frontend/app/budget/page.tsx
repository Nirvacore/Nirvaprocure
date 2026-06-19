'use client';
import React, { useEffect, useState } from 'react';
import { Wallet, Lock, Plus } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import { budgets as budgetsApi, people as peopleApi, type BudgetRow, type PeopleDepartment } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { mockDepartments } from '@/lib/mock-data';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

// ---------------------------------------------------------------------------
// Mock fallback — aligned with mockDepartments from NirvaPeople
// ---------------------------------------------------------------------------
function currentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const MOCK_DEPT_BUDGETS = [
  { spent: 280000_00, amount: 500000_00, soft: false },
  { spent: 650000_00, amount: 800000_00, soft: true },
  { spent: 1150000_00, amount: 1200000_00, soft: true },
  { spent: 120000_00, amount: 300000_00, soft: false },
];

function mockBudgets(month: string): BudgetRow[] {
  const monthStart = `${month}-01`;
  return mockDepartments.map((d, i) => {
    const preset = MOCK_DEPT_BUDGETS[i] ?? { spent: 0, amount: 100000_00, soft: false };
    const remaining = preset.amount - preset.spent;
    const pct = preset.amount > 0 ? Math.round((preset.spent / preset.amount) * 100) : 0;
    return {
      id: `bud-${d.cost_center}`,
      department_id: d.cost_center,
      department_name: d.name,
      month_start: monthStart,
      amount_minor: preset.amount,
      spent_minor: preset.spent,
      remaining_minor: remaining,
      pct_used: pct,
      soft_block: preset.soft,
    };
  });
}

const MOCK_DEPARTMENTS: PeopleDepartment[] = mockDepartments.map(d => ({
  id: d.cost_center,
  name: d.name,
  cost_center: d.cost_center,
  members: d.members,
}));

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
// Summary row
// ---------------------------------------------------------------------------
function BudgetSummary({ rows }: { rows: BudgetRow[] }) {
  const { t, locale } = useT();
  const totalBudget = rows.reduce((s, r) => s + r.amount_minor, 0);
  const totalSpent  = rows.reduce((s, r) => s + r.spent_minor, 0);
  const overCount   = rows.filter(r => r.spent_minor > r.amount_minor).length;

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })
      .format(n / 100);

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="card py-4 px-4 bg-blue-50 border-blue-100">
        <div className="text-xs text-blue-600 font-medium mb-1">{t('budget.total')}</div>
        <div className="num text-xl font-bold text-blue-800">{fmt(totalBudget)}</div>
      </div>
      <div className="card py-4 px-4 bg-violet-50 border-violet-100">
        <div className="text-xs text-violet-600 font-medium mb-1">{t('budget.spent')}</div>
        <div className="num text-xl font-bold text-violet-800">{fmt(totalSpent)}</div>
      </div>
      <div className={`card py-4 px-4 ${overCount > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
        <div className={`text-xs font-medium mb-1 ${overCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{t('budget.over')}</div>
        <div className={`num text-xl font-bold ${overCount > 0 ? 'text-red-800' : 'text-green-800'}`}>{overCount}</div>
      </div>
    </div>
  );
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
  onSaved: () => void;
}

function UpsertModal({ month, existing, onClose, onSaved }: UpsertModalProps) {
  const { t } = useT();
  const { data: departments } = useResource(
    () => withMockFallback(
      () => peopleApi.listDepartments(),
      MOCK_DEPARTMENTS,
    ),
  );
  const depts = departments ?? [];
  const [departmentId, setDepartmentId] = useState(existing?.department_id ?? depts[0]?.id ?? '');
  const [amountBaht, setAmountBaht] = useState(
    existing ? String(existing.amount_minor / 100) : '',
  );
  const [softBlock, setSoftBlock] = useState(existing?.soft_block ?? false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setDepartmentId(existing?.department_id ?? depts[0]?.id ?? '');
    setAmountBaht(existing ? String(existing.amount_minor / 100) : '');
    setSoftBlock(existing?.soft_block ?? false);
  }, [existing, depts]);

  const save = async () => {
    const baht = parseFloat(amountBaht.replace(/,/g, ''));
    if (!Number.isFinite(baht) || baht < 0) {
      setErr(t('budget.err.amount'));
      return;
    }
    if (!departmentId) {
      setErr(t('common.error'));
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await budgetsApi.upsert({
        department_id: departmentId,
        amount_minor: Math.round(baht * 100),
        month_start: `${month}-01`,
        soft_block: softBlock,
      });
      onSaved();
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
              {depts.map(d => (
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
              placeholder={t('budget.amount.placeholder')}
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
            {saving ? t('common.saving') : t('budget.save')}
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
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BudgetRow | undefined>();

  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(
      () => budgetsApi.list(month),
      mockBudgets(month),
    ),
    [month],
  );

  const rows = data ?? [];

  const handleSaved = () => {
    setShowModal(false);
    setEditing(undefined);
    void refresh();
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

      {error && <div className="mb-4"><ErrorBanner message={error.message} onRetry={refresh} /></div>}

      {!loading && rows.length > 0 && (
        <BudgetSummary rows={rows} />
      )}

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
