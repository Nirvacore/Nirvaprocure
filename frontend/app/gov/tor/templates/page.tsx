'use client';
import Link from 'next/link';
import { ArrowLeft, FileText, Scale } from 'lucide-react';
import { gov as govApi } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { MOCK_TOR_TEMPLATES, TOR_KIND_LABEL_KEYS } from '@/lib/tor-shared';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useT } from '@/lib/i18n/provider';

export default function TorTemplatesPage() {
  const { t } = useT();
  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(() => govApi.templates(), MOCK_TOR_TEMPLATES),
  );

  return (
    <section className="screen space-y-6 max-w-3xl mx-auto">
      <Link href="/gov/tor" className="btn-sm inline-flex items-center gap-2 text-ink-soft hover:text-ink -ml-2 px-2 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
        <span>{t('tor.templates.back')}</span>
      </Link>

      <div>
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
          <Scale className="w-7 h-7 text-brand-600" />
          {t('tor.templates.heading')}
        </h1>
        <p className="text-ink-soft">{t('tor.template.hint')}</p>
      </div>

      {error && <ErrorBanner message={error.message} onRetry={refresh} />}
      {loading && !data && <Loading />}

      {data && (
        <div className="space-y-3">
          {data.map((tpl) => (
            <div key={tpl.id} className="card">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink leading-snug mb-2">{tpl.name}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-ink-soft">
                      {t(TOR_KIND_LABEL_KEYS[tpl.procurement_kind])}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      tpl.is_official ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-ink-soft'
                    }`}>
                      {tpl.is_official ? t('tor.template.official') : t('tor.templates.custom')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/gov/tor/new" className="btn-primary inline-flex px-5">
        {t('tor.list.new')}
      </Link>
    </section>
  );
}
