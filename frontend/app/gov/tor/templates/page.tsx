'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, FileText, Loader2, Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import { gov as govApi } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { MOCK_TOR_TEMPLATES, TOR_KIND_LABEL_KEYS } from '@/lib/tor-shared';
import { deleteMockTorTemplate, mergeMockTorTemplates } from '@/lib/tor-mock-store';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useToast } from '@/components/Toast';
import { useT } from '@/lib/i18n/provider';

function mockDeleteTorTemplate(id: string) {
  deleteMockTorTemplate(id);
  return { ok: true as const };
}

function isEditableTemplate(tpl: { id: string; is_official: boolean }) {
  return !tpl.is_official && tpl.id.startsWith('tpl-custom-');
}

function isDeletableTemplate(tpl: { id: string; is_official: boolean }) {
  return !tpl.is_official && tpl.id.startsWith('tpl-custom-');
}

export default function TorTemplatesPage() {
  const { t } = useT();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(() => govApi.templates(), mergeMockTorTemplates(MOCK_TOR_TEMPLATES)),
  );

  async function removeTemplate(id: string) {
    if (!confirm(t('tor.templates.confirm.delete'))) return;
    setDeletingId(id);
    try {
      await withMockFallback(() => govApi.deleteTemplate(id), mockDeleteTorTemplate(id));
      toast(t('tor.templates.toast.deleted'), 'ok');
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'err');
    } finally {
      setDeletingId(null);
    }
  }

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
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isEditableTemplate(tpl) && (
                    <Link
                      href={`/gov/tor/templates/${tpl.id}/edit`}
                      className="btn-sm p-2 text-ink-soft hover:text-brand-600 hover:bg-brand-50 rounded-lg"
                      aria-label={t('tor.templates.edit')}
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
                  )}
                  {isDeletableTemplate(tpl) && (
                    <button
                      type="button"
                      className="btn-sm p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      disabled={deletingId === tpl.id}
                      aria-label={t('tor.templates.delete')}
                      onClick={() => void removeTemplate(tpl.id)}
                    >
                      {deletingId === tpl.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/gov/tor/templates/new" className="btn-primary inline-flex items-center gap-2 px-5">
          <Plus className="w-4 h-4" />
          {t('tor.templates.create')}
        </Link>
        <Link href="/gov/tor/new" className="btn-secondary inline-flex px-5">
          {t('tor.list.new')}
        </Link>
      </div>
    </section>
  );
}
