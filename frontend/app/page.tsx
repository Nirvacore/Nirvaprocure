'use client';
import React from 'react';
import Link from 'next/link';
import { Plus, Inbox, List, MessageCircle, CheckCircle2, Clock, Banknote } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import { useAuth } from '@/components/AuthProvider';

export default function HomePage() {
  const { t, locale } = useT();
  const { user } = useAuth();
  const firstName = (user?.full_name ?? '').split(' ')[0] || '';
  // Localized "month year" — uses Buddhist calendar in Thai, Gregorian elsewhere.
  const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date());

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
      badge: '3',
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

      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">{t('home.summary.title')}</h2>
          <span className="text-sm text-gray-500">{monthYear}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label={t('home.summary.all')} value="12" accent="bg-gray-50" />
          <Stat label={t('home.summary.approved')} value="8"  accent="bg-green-50" labelColor="text-green-700" valueColor="text-green-800" icon={CheckCircle2} />
          <Stat label={t('home.summary.pending')}  value="3"  accent="bg-amber-50" labelColor="text-amber-700" valueColor="text-amber-800" icon={Clock} />
          <Stat label={t('home.summary.spent')}    value="฿ 48,290" accent="bg-brand-50" labelColor="text-brand-700" valueColor="text-brand-700" icon={Banknote} />
        </div>
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
