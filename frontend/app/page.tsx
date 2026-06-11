'use client';
import React from 'react';
import Link from 'next/link';
import {
  Plus, Inbox, List, MessageCircle, CheckCircle2, Clock, Banknote,
  Wallet, Building2, FileText, Package,
} from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import { useAuth } from '@/components/AuthProvider';
import { useInboxCount } from '@/lib/mock-hooks';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { analytics as analyticsApi, type AnalyticsSummary } from '@/lib/api';
import { Loading } from '@/components/Loading';

const MOCK_SUMMARY: AnalyticsSummary = {
  month_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  pr_counts: { in_approval: 3, approved: 8, rejected: 1, draft: 2 },
  approved_spend_minor: 4_829_000,
  avg_approval_hours: 19.3,
  top_suppliers: [],
  by_department: [],
};

export default function HomePage() {
  const { t, locale } = useT();
  const { user } = useAuth();
  const { count: inboxCount } = useInboxCount();
  const firstName = (user?.full_name ?? '').split(' ')[0] || '';
  const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date());

  const { data: summary, loading } = useResource(
    () => withMockFallback(() => analyticsApi.summary(), MOCK_SUMMARY),
  );

  const counts = summary?.pr_counts ?? {};
  const totalPr = Object.values(counts).reduce((s, n) => s + n, 0);
  const approved = counts.approved ?? 0;
  const pending = counts.in_approval ?? inboxCount;
  const spentFmt = summary
    ? new Intl.NumberFormat(locale, { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })
        .format(summary.approved_spend_minor / 100)
    : '—';

  const actions = [
    {
      href: '/pr/new',
      icon: Plus,
      title: t('home.action.new'),
      subtitle: t('home.action.new.sub'),
      accent: 'bg-brand-100 text-brand-700',
      hover: 'hover:border-brand-300',
    },
    {
      href: '/approvals',
      icon: Inbox,
      title: t('home.action.inbox'),
      badge: pending > 0 ? String(pending) : undefined,
      subtitle: t('home.action.inbox.sub'),
      accent: 'bg-amber-100 text-amber-700',
      hover: 'hover:border-amber-300',
    },
    {
      href: '/pr',
      icon: List,
      title: t('home.action.list'),
      subtitle: t('home.action.list.sub'),
      accent: 'bg-gray-100 text-gray-700',
      hover: 'hover:border-gray-300',
    },
    {
      href: '/line',
      icon: MessageCircle,
      title: t('home.action.line'),
      badgeOn: t('home.action.line.on'),
      subtitle: t('home.action.line.sub'),
      accent: 'bg-green-100 text-green-700',
      hover: 'hover:border-green-300',
    },
  ];

  const quickLinks = [
    { href: '/budget',    icon: Wallet,    title: t('home.action.budget'),    subtitle: t('home.action.budget.sub'),    accent: 'bg-green-100 text-green-700',  hover: 'hover:border-green-300' },
    { href: '/suppliers', icon: Building2, title: t('home.action.suppliers'), subtitle: t('home.action.suppliers.sub'), accent: 'bg-emerald-100 text-emerald-700', hover: 'hover:border-emerald-300' },
    { href: '/po',        icon: FileText,  title: t('home.action.po'),        subtitle: t('home.action.po.sub'),        accent: 'bg-cyan-100 text-cyan-700',    hover: 'hover:border-cyan-300' },
    { href: '/stock',     icon: Package,   title: t('home.action.stock'),     subtitle: t('home.action.stock.sub'),     accent: 'bg-sky-100 text-sky-700',      hover: 'hover:border-sky-300' },
  ];

  return (
    <section className="screen space-y-8">
      <div className="space-y-1">
        <p className="text-base text-gray-500">{t('home.greeting', { name: firstName })}</p>
        <h1 className="text-3xl md:text-4xl font-bold">{t('home.heading')}</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className={`text-left bg-white rounded-2xl p-6 shadow-soft hover:shadow-lift transition border border-gray-200 ${a.hover} group block`}
            >
              <div className={`w-14 h-14 rounded-2xl ${a.accent} flex items-center justify-center mb-4 group-hover:scale-105 transition`}>
                <Icon className="w-7 h-7" />
              </div>
              <div className="text-xl font-bold mb-1 flex items-center gap-2">
                {a.title}
                {a.badge && <span className="num text-sm bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">{a.badge}</span>}
                {a.badgeOn && <span className="text-xs bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-full">{a.badgeOn}</span>}
              </div>
              <div className="text-base text-gray-600">{a.subtitle}</div>
            </Link>
          );
        })}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">{t('home.quick')}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickLinks.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className={`flex items-center gap-3 bg-white rounded-xl p-4 shadow-soft border border-gray-200 ${a.hover} transition`}
              >
                <div className={`w-10 h-10 rounded-xl ${a.accent} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{a.title}</div>
                  <div className="text-xs text-gray-500 truncate">{a.subtitle}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">{t('home.summary.title')}</h2>
          <span className="text-sm text-gray-500">{monthYear}</span>
        </div>
        {loading && !summary ? (
          <Loading />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label={t('home.summary.all')} value={String(totalPr)} accent="bg-gray-50" />
            <Stat label={t('home.summary.approved')} value={String(approved)} accent="bg-green-50" labelColor="text-green-700" valueColor="text-green-800" icon={CheckCircle2} />
            <Stat label={t('home.summary.pending')} value={String(pending)} accent="bg-amber-50" labelColor="text-amber-700" valueColor="text-amber-800" icon={Clock} />
            <Stat label={t('home.summary.spent')} value={spentFmt} accent="bg-brand-50" labelColor="text-brand-700" valueColor="text-brand-700" icon={Banknote} />
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({
  label, value, accent, labelColor = 'text-gray-600', valueColor = 'text-gray-900', icon: Icon,
}: { label: string; value: string; accent: string; labelColor?: string; valueColor?: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className={`p-4 rounded-xl ${accent}`}>
      <div className={`text-sm mb-1 flex items-center gap-1.5 ${labelColor}`}>
        {Icon && <Icon className="w-4 h-4" />}
        {label}
      </div>
      <div className={`num text-2xl font-bold ${valueColor}`}>{value}</div>
    </div>
  );
}
