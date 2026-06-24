'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Scale } from 'lucide-react';
import { gov as govApi, type ToRBrief } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { useToast } from '@/components/Toast';
import { useT } from '@/lib/i18n/provider';
import { getMockTorTemplate, updateMockTorTemplate } from '@/lib/tor-mock-store';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

function mockTorTemplateDetail(id: string) {
  const tpl = getMockTorTemplate(id);
  if (!tpl) throw new Error('Template not found');
  return tpl;
}

export default function EditTorTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();
  const { toast } = useToast();
  const router = useRouter();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ToRBrief['procurement_kind']>('goods');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(() => govApi.getTemplate(id), mockTorTemplateDetail(id)),
    [id],
  );

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setKind(data.procurement_kind);
    setBody(data.body_markdown);
  }, [data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !data) return;
    setBusy(true);
    try {
      await withMockFallback(
        () => govApi.updateTemplate(id, {
          name: name.trim(),
          procurement_kind: kind,
          body_markdown: body,
        }),
        updateMockTorTemplate(id, {
          name: name.trim(),
          procurement_kind: kind,
          body_markdown: body,
        }),
      );
      toast(t('tor.templates.toast.updated'), 'ok');
      router.push('/gov/tor/templates');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'err');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Loading />;
  if (error) {
    return (
      <section className="screen max-w-3xl mx-auto">
        <ErrorBanner message={error.message} onRetry={refresh} />
      </section>
    );
  }

  return (
    <section className="screen space-y-6 max-w-3xl mx-auto">
      <Link href="/gov/tor/templates" className="btn-sm inline-flex items-center gap-2 text-ink-soft hover:text-ink -ml-2 px-2 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
        <span>{t('tor.templates.back')}</span>
      </Link>

      <h1 className="text-3xl font-bold flex items-center gap-3">
        <Scale className="w-7 h-7 text-brand-600" />
        {t('tor.templates.edit')}
      </h1>

      <form onSubmit={(e) => void submit(e)} className="card space-y-4">
        <div>
          <label className="label" htmlFor="tpl-name">{t('tor.templates.name')}</label>
          <input
            id="tpl-name"
            className="input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('tor.templates.name.placeholder')}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="tpl-kind">{t('tor.kind.label')}</label>
          <select id="tpl-kind" className="input w-full" value={kind} onChange={(e) => setKind(e.target.value as ToRBrief['procurement_kind'])}>
            <option value="goods">{t('tor.kind.goods')}</option>
            <option value="services">{t('tor.kind.services')}</option>
            <option value="construction">{t('tor.kind.construction')}</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="tpl-body">{t('tor.templates.body')}</label>
          <textarea
            id="tpl-body"
            className="input min-h-[200px] w-full font-mono text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="text-sm text-ink-soft mt-1">{t('tor.templates.body.hint')}</p>
        </div>

        <button type="submit" disabled={busy || !name.trim()} className="btn-primary inline-flex items-center gap-2 px-5">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {t('tor.templates.save')}
        </button>
      </form>
    </section>
  );
}
