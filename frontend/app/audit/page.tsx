'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { audit as auditApi, type AuditRow, ApiError } from '@/lib/api';
import { SkeletonRows } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useT } from '@/lib/i18n/provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';

const ENTITY_FILTERS: { key: string | null; labelKey: TranslationKey }[] = [
  { key: null,                labelKey: 'audit.filter.all' },
  { key: 'purchase_request',  labelKey: 'audit.filter.pr' },
  { key: 'user',              labelKey: 'audit.filter.user' },
  { key: 'workflow',          labelKey: 'audit.filter.workflow' },
];

/**
 * Read-only audit log viewer. Cursor-paginated; one row per audit_log entry.
 * Each row expands inline to show the JSON diff (useful for proving "what
 * actually changed" during compliance reviews).
 */
export default function AuditPage() {
  const { t } = useT();
  const [rows, setRows]     = useState<AuditRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [entity, setEntity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function load(append: boolean) {
    append ? setMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await auditApi.list({
        entity_type: entity ?? undefined,
        cursor: append ? (cursor ?? undefined) : undefined,
        limit: 50,
      });
      setRows((prev) => (append ? [...prev, ...page.data] : page.data));
      setCursor(page.next_cursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('audit.err.load'));
    } finally {
      append ? setMore(false) : setLoading(false);
    }
  }

  useEffect(() => { void load(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [entity]);

  return (
    <section className="screen space-y-6">
      <Link href="/settings" className="btn-sm inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 -ml-2 px-2 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
        <span>{t('common.back')}</span>
      </Link>

      <div>
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
          <Shield className="w-7 h-7 text-brand-600" />
          {t('audit.heading')}
        </h1>
        <p className="text-base text-gray-600">{t('audit.sub')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ENTITY_FILTERS.map((f) => (
          <button
            key={f.key ?? 'all'}
            onClick={() => setEntity(f.key)}
            className={`min-h-btn-sm px-4 rounded-full text-sm font-medium ${
              entity === f.key
                ? 'bg-brand-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={() => load(false)} />}
      {loading && rows.length === 0 && <SkeletonRows rows={5} />}

      {rows.length === 0 && !loading && !error && (
        <p className="text-base text-gray-500">{t('audit.empty')}</p>
      )}

      {rows.length > 0 && (
        <div className="card !p-0 overflow-hidden divide-y divide-gray-100">
          {rows.map((r) => <AuditEntry key={r.id} row={r} />)}
        </div>
      )}

      {cursor && (
        <button
          onClick={() => load(true)}
          disabled={more}
          className="btn-secondary w-full"
        >
          {more ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {more ? t('common.loading') : t('pr.load.more')}
        </button>
      )}
    </section>
  );
}

function AuditEntry({ row }: { row: AuditRow }) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const hasDiff = row.diff !== null && row.diff !== undefined;
  return (
    <div className="p-4">
      <button
        onClick={() => hasDiff && setOpen((o) => !o)}
        className="w-full text-left flex items-start gap-3"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <code className="text-sm font-semibold text-brand-700">{row.action}</code>
            <span className="text-xs text-gray-500">{row.entity_type}</span>
            <span className="num text-xs text-gray-400">{row.entity_id.slice(0, 8)}</span>
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {row.actor_name ?? <em className="text-gray-400">{t('audit.system')}</em>}
            {' · '}
            <span className="num">{new Date(row.created_at).toLocaleString(locale)}</span>
          </div>
        </div>
        {hasDiff && (open ? <ChevronUp className="w-5 h-5 text-gray-400 mt-1" /> : <ChevronDown className="w-5 h-5 text-gray-400 mt-1" />)}
      </button>
      {open && hasDiff && (
        <pre className="mt-3 p-3 bg-gray-50 rounded-lg text-xs overflow-x-auto font-mono">
          {JSON.stringify(row.diff, null, 2)}
        </pre>
      )}
    </div>
  );
}
