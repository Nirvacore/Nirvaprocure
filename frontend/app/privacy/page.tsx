'use client';
import Link from 'next/link';
import { ArrowLeft, Shield, Mail, FileText, Eye, Trash2 } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';

/**
 * Public privacy notice page — required by PDPA §22 (right to be informed)
 * and ISO/IEC 27018. Lists what data we collect, why, where it lives, who
 * processes it, how long we keep it, and the user's rights with the contact
 * channel to exercise them.
 *
 * Renders outside the AppShell (login-style chrome) so the unauthenticated
 * cookie banner can link here without forcing a login first.
 */
export default function PrivacyPage() {
  const { t } = useT();
  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-indigo-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-bold">NIRVAPROCURE</span>
          </Link>
          <Link href="/" className="btn-sm inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 -mr-2 px-2 rounded-lg">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{t('common.back')}</span>
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{t('privacy.title')}</h1>
          <p className="text-sm text-gray-500">{t('privacy.version', { version: 'v1', date: '2026-05-23' })}</p>
        </header>

        <Section icon={FileText} title={t('privacy.sec.what.title')}>
          <p>{t('privacy.sec.what.body')}</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>{t('privacy.sec.what.identity')}</li>
            <li>{t('privacy.sec.what.contact')}</li>
            <li>{t('privacy.sec.what.workplace')}</li>
            <li>{t('privacy.sec.what.activity')}</li>
            <li>{t('privacy.sec.what.tech')}</li>
          </ul>
        </Section>

        <Section icon={Shield} title={t('privacy.sec.why.title')}>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('privacy.sec.why.contract')}</li>
            <li>{t('privacy.sec.why.legit')}</li>
            <li>{t('privacy.sec.why.legal')}</li>
          </ul>
        </Section>

        <Section icon={FileText} title={t('privacy.sec.where.title')}>
          <p>{t('privacy.sec.where.body')}</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>{t('privacy.sec.where.fly')}</li>
            <li>{t('privacy.sec.where.s3')}</li>
            <li>{t('privacy.sec.where.line')}</li>
            <li>{t('privacy.sec.where.ai')}</li>
          </ul>
        </Section>

        <Section icon={FileText} title={t('privacy.sec.retention.title')}>
          <p>{t('privacy.sec.retention.body')}</p>
        </Section>

        <Section icon={Eye} title={t('privacy.sec.rights.title')}>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>{t('privacy.sec.rights.access')}</strong></li>
            <li><strong>{t('privacy.sec.rights.rectify')}</strong></li>
            <li><strong>{t('privacy.sec.rights.erase')}</strong></li>
            <li><strong>{t('privacy.sec.rights.portability')}</strong></li>
            <li><strong>{t('privacy.sec.rights.object')}</strong></li>
            <li><strong>{t('privacy.sec.rights.complain')}</strong></li>
          </ul>
        </Section>

        <Section icon={Trash2} title={t('privacy.sec.cookies.title')}>
          <p>{t('privacy.sec.cookies.body')}</p>
        </Section>

        <Section icon={Mail} title={t('privacy.sec.contact.title')}>
          <p>{t('privacy.sec.contact.body')}</p>
          <p className="mt-2 font-mono text-sm">
            privacy@nirvaprocure.com<br />
            dpo@nirvaprocure.com
          </p>
        </Section>

        <footer className="border-t border-gray-200 pt-6 text-sm text-gray-500">
          {t('privacy.footer')}
        </footer>
      </article>
    </main>
  );
}

function Section({
  icon: Icon, title, children,
}: { icon: typeof Shield; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Icon className="w-5 h-5 text-brand-600" />
        {title}
      </h2>
      <div className="text-base text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}
