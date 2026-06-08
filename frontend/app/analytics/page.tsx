'use client';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Banknote, Bot, Building2, CheckCircle2,
  Clock, FileText, Loader2, RefreshCw, ShieldAlert, Timer, Trophy,
} from 'lucide-react';
import {
  analytics as analyticsApi, supplierRisk, aiRuns,
  type AnalyticsSummary, type SupplierRiskRow, type AiRunSummary,
} from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { fmtBaht } from '@/lib/format';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useT } from '@/lib/i18n/provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';

const MOCK: AnalyticsSummary = {
  month_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  pr_counts: { in_approval: 3, approved: 8, rejected: 1, draft: 2 },
  approved_spend_minor: 4_829_000,
  avg_approval_hours: 19.3,
  top_suppliers: [
    { name: 'HP Authorized Store',     spend_minor: 1_512_000, po_count: 3 },
    { name: 'Makro คลังกลางบางพลี',     spend_minor:   780_000, po_count: 2 },
    { name: 'Lazada Mall Office Supply', spend_minor:  640_000, po_count: 1 },
  ],
  by_department: [
    { department: 'การเงิน', spend_minor: 1_812_000, pr_count: 4 },
    { department: 'ไอที',     spend_minor: 1_540_000, pr_count: 2 },
    { department: 'การตลาด', spend_minor:   980_000, pr_count: 3 },
    { department: 'บริหาร',   spend_minor:   497_000, pr_count: 1 },
  ],
};

export default function AnalyticsPage() {
  const { t } = useT();
  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(() => analyticsApi.summary(), MOCK),
  );

  // AI cost summary — load eagerly alongside analytics data.
  const [aiSummary, setAiSummary] = useState<AiRunSummary | null>(null);
  useEffect(() => {
    aiRuns.list(1).then((r) => setAiSummary(r.summary)).catch(() => {});
  }, []);

  // Supplier risk scores — lazy-load when the section is first viewed.
  const [risks,         setRisks]         = useState<SupplierRiskRow[] | null>(null);
  const [risksLoading,  setRisksLoading]  = useState(false);
  const [risksShown,    setRisksShown]    = useState(false);
  const [recomputing,   setRecomputing]   = useState(false);

  const loadRisks = useCallback(async () => {
    if (risksShown) { setRisksShown(false); return; }
    setRisksShown(true);
    if (risks !== null) return;
    setRisksLoading(true);
    try { setRisks(await supplierRisk.list()); }
    catch  { setRisks([]); }
    finally { setRisksLoading(false); }
  }, [risks, risksShown]);

  const recompute = useCallback(async () => {
    setRecomputing(true);
    try {
      await supplierRisk.refresh();
      setRisks(await supplierRisk.list());
    } catch { /* ignore */ }
    finally { setRecomputing(false); }
  }, []);

  // Bar chart needs a max for proportional widths.
  const maxDeptSpend = useMemo(
    () => Math.max(1, ...(data?.by_department ?? []).map((d) => d.spend_minor)),
    [data],
  );

  return (
    <section className="screen space-y-6">
      <Link href="/" className="btn-sm inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 -ml-2 px-2 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
        <span>{t('common.back')}</span>
      </Link>

      <div>
        <h1 className="text-3xl font-bold mb-1">{t('analytics.heading')}</h1>
        <p className="text-base text-gray-600">{t('analytics.sub', { date: data?.month_start ?? '—' })}</p>
      </div>

      {error && <ErrorBanner message={error.message} onRetry={refresh} />}
      {loading && !data && <Loading />}

      {data && (
        <>
          {/* Top-line stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label={t('analytics.stat.total')}
              value={Object.values(data.pr_counts).reduce((a, b) => a + b, 0).toString()}
              icon={FileText}
              accent="bg-gray-100 text-gray-700"
            />
            <StatCard
              label={t('status.approved')}
              value={String(data.pr_counts.approved ?? 0)}
              icon={CheckCircle2}
              accent="bg-green-100 text-green-700"
            />
            <StatCard
              label={t('status.pending')}
              value={String((data.pr_counts.in_approval ?? 0) + (data.pr_counts.pending ?? 0))}
              icon={Clock}
              accent="bg-amber-100 text-amber-700"
            />
            <StatCard
              label={t('home.summary.spent')}
              value={`฿ ${fmtBaht(data.approved_spend_minor)}`}
              icon={Banknote}
              accent="bg-brand-100 text-brand-700"
            />
            {aiSummary !== null && aiSummary.calls > 0 && (
              <StatCard
                label={t('analytics.ai_cost')}
                value={`$${aiSummary.total_cost_usd.toFixed(4)}`}
                icon={Bot}
                accent="bg-purple-100 text-purple-700"
              />
            )}
          </div>

          {/* Approval SLA */}
          <div className="card">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm text-gray-600">{t('analytics.sla.label')}</div>
                <div className="num text-2xl font-bold">
                  {data.avg_approval_hours == null
                    ? '—'
                    : t('analytics.sla.value', { hours: data.avg_approval_hours.toFixed(1) })}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500">{t('analytics.sla.hint')}</p>
          </div>

          {/* By department bar chart */}
          <div className="card">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-400" />
              {t('analytics.by_dept')}
            </h2>
            {data.by_department.length === 0 ? (
              <p className="text-base text-gray-500">{t('analytics.empty.dept')}</p>
            ) : (
              <ul className="space-y-3">
                {data.by_department.map((d) => {
                  const pct = Math.round((d.spend_minor / maxDeptSpend) * 100);
                  return (
                    <li key={d.department ?? '__unspecified__'}>
                      <div className="flex items-baseline justify-between text-sm mb-1">
                        <span className="font-semibold">{d.department ?? t('analytics.unspecified')}</span>
                        <span className="num text-gray-600">
                          ฿ {fmtBaht(d.spend_minor)} · {t('analytics.pr_count', { count: d.pr_count })}
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-brand-500 transition-all"
                          style={{ width: `${pct}%` }}
                          aria-label={`${pct}% of top spender`}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Top suppliers */}
          <div className="card">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-gray-400" />
              {t('analytics.top_suppliers')}
            </h2>
            {data.top_suppliers.length === 0 ? (
              <p className="text-base text-gray-500">{t('analytics.empty.suppliers')}</p>
            ) : (
              <ol className="space-y-2">
                {data.top_suppliers.map((s, i) => (
                  <li key={s.name} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50">
                    <div className="num w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-gray-700">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{s.name}</div>
                      <div className="text-sm text-gray-500 num">{t('analytics.po_count', { count: s.po_count })}</div>
                    </div>
                    <div className="num font-bold">฿ {fmtBaht(s.spend_minor)}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Supplier risk leaderboard */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-gray-400" />
                {t('risk.heading')}
              </h2>
              <div className="flex gap-2">
                {risksShown && (
                  <button
                    onClick={recompute}
                    disabled={recomputing}
                    className="btn-sm flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${recomputing ? 'animate-spin' : ''}`} />
                    {t('risk.refresh')}
                  </button>
                )}
                <button
                  onClick={loadRisks}
                  className="btn-sm text-sm text-brand-700 border border-brand-200 rounded-lg px-3 py-1 hover:bg-brand-50"
                >
                  {risksShown ? t('webhooks.log.hide') : t('risk.heading')}
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">{t('risk.sub')}</p>

            {risksShown && (
              <>
                {risksLoading && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                )}
                {!risksLoading && risks !== null && risks.length === 0 && (
                  <p className="text-sm text-gray-500 py-2">{t('risk.empty')}</p>
                )}
                {!risksLoading && risks !== null && risks.length > 0 && (
                  <ul className="space-y-2">
                    {risks.map((r) => (
                      <RiskRow key={r.supplier_id} row={r} />
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function StatCard({
  label, value, icon: Icon, accent,
}: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent: string }) {
  return (
    <div className="card !p-4">
      <div className={`w-10 h-10 rounded-xl ${accent} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-sm text-gray-600">{label}</div>
      <div className="num text-2xl font-bold">{value}</div>
    </div>
  );
}

// ── Supplier risk helpers ─────────────────────────────────────────────────────

const TIER_STYLES: Record<string, { pill: string; bar: string; labelKey: TranslationKey }> = {
  low:      { pill: 'bg-green-100 text-green-800',   bar: 'bg-green-400',  labelKey: 'risk.tier.low' },
  medium:   { pill: 'bg-yellow-100 text-yellow-800', bar: 'bg-yellow-400', labelKey: 'risk.tier.medium' },
  high:     { pill: 'bg-orange-100 text-orange-800', bar: 'bg-orange-500', labelKey: 'risk.tier.high' },
  critical: { pill: 'bg-red-100 text-red-800',       bar: 'bg-red-600',    labelKey: 'risk.tier.critical' },
};

function RiskRow({ row }: { row: SupplierRiskRow }) {
  const { t }  = useT();
  const [open, setOpen] = useState(false);
  const style  = TIER_STYLES[row.tier] ?? TIER_STYLES.low;

  return (
    <li className="rounded-xl border border-gray-100 overflow-hidden">
      {/* Summary row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
      >
        {/* Score bar */}
        <div className="w-24 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="num text-sm font-bold">{row.score}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.pill}`}>
              {t(style.labelKey)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${row.score}%` }} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{row.supplier_name}</div>
          {row.factors.has_coi && (
            <div className="text-xs text-amber-700 flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3 h-3" />
              {t('risk.factor.coi')}
            </div>
          )}
        </div>
      </button>

      {/* Detail breakdown */}
      {open && (
        <div className="px-4 pb-4 pt-1 bg-gray-50 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FactorChip
            label={t('risk.factor.spend')}
            value={`${row.factors.spend_pct ?? 0}%`}
            warn={row.factors.spend_pct > 30}
          />
          <FactorChip
            label={t('risk.factor.volatility')}
            value={`${row.factors.price_cov ?? 0}% CoV`}
            warn={row.factors.price_cov > 20}
          />
          <FactorChip
            label={t('risk.factor.rejection')}
            value={`${row.factors.rejection_rate ?? 0}%`}
            warn={row.factors.rejection_rate > 10}
          />
          <FactorChip
            label={t('risk.factor.coi')}
            value={row.factors.has_coi ? '⚠ Yes' : 'No'}
            warn={row.factors.has_coi}
          />
          <FactorChip
            label={t('risk.factor.anomalies')}
            value={String(row.factors.anomaly_count_90d)}
            warn={row.factors.anomaly_count_90d > 0}
          />
        </div>
      )}
    </li>
  );
}

function FactorChip({ label, value, warn }: { label: string; value: string; warn: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-sm ${warn ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-gray-200'}`}>
      <div className={`text-xs ${warn ? 'text-amber-700' : 'text-gray-500'}`}>{label}</div>
      <div className={`num font-bold ${warn ? 'text-amber-900' : 'text-gray-800'}`}>{value}</div>
    </div>
  );
}
