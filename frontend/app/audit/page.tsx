'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { audit as auditApi, type AuditRow } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
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

type AuditPage = { data: AuditRow[]; next_cursor: string | null };

const MOCK_AUDIT: AuditPage = {
  data: [
    { id: 1, action: 'pr.create', entity_type: 'purchase_request', entity_id: '1', actor_user_id: 'u1', actor_name: 'สุดา จันทร์', created_at: '2026-06-07T10:21:00Z', diff: { title: 'หมึกเครื่องพิมพ์ ชั้น 5' } },
    { id: 2, action: 'pr.submit', entity_type: 'purchase_request', entity_id: '1', actor_user_id: 'u1', actor_name: 'สุดา จันทร์', created_at: '2026-06-07T10:22:00Z', diff: null },
    { id: 3, action: 'approval.decide', entity_type: 'approval_instance', entity_id: 'ai-1', actor_user_id: 'u2', actor_name: 'ปอ นวลรัตน์', created_at: '2026-06-07T14:00:00Z', diff: { decision: 'approved' } },
    { id: 4, action: 'workflow.update', entity_type: 'workflow', entity_id: 'wf-1', actor_user_id: 'u3', actor_name: 'Admin', created_at: '2026-06-06T09:00:00Z', diff: { min_amount_minor: 50000 } },
  ],
  next_cursor: null,
};

/**
 * Read-only audit log viewer. Cursor-paginated; one row per audit_log entry.
 * Each row expands inline to show the JSON diff (useful for proving "what
 * actually changed" during compliance reviews).
 */
export default function AuditPage() {
  const { t } = useT();
  const [entity, setEntity]       = useState<string | null>(null);
  const [cursor, setCursor]       = useState<string | null>(null);
  const [accumulated, setAccumulated] = useState<AuditRow[]>([]);

  useEffect(() => {
    setCursor(null);
    setAccumulated([]);
  }, [entity]);

  const { data: page, loading, error, refresh } = useResource(
    () => withMockFallback(
      () => auditApi.list({
        entity_type: entity ?? undefined,
        cursor: cursor ?? undefined,
        limit: 50,
      }),
      entity
        ? { ...MOCK_AUDIT, data: MOCK_AUDIT.data.filter(r => r.entity_type === entity) }
        : MOCK_AUDIT,
    ),
    [entity, cursor],
  );

  useEffect(() => {
    if (!page) return;
    setAccumulated(prev => (cursor ? [...prev, ...page.data] : page.data));
  }, [page, cursor]);

  const nextCursor = page?.next_cursor ?? null;
  const loadingMore = loading && cursor !== null;
  const initialLoading = loading && cursor === null && accumulated.length === 0;

  return (
    <section className="screen space-y-6">
      <Link href="/settings" className="btn-sm inline-flex items-center gap-2 text-ink-soft hover:text-ink -ml-2 px-2 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
        <span>{t('common.back')}</span>
      </Link>

      <div>
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
          <Shield className="w-7 h-7 text-brand-600" />
          {t('audit.heading')}
        </h1>
        <p className="text-base text-ink-soft">{t('audit.sub')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ENTITY_FILTERS.map((f) => (
          <button
            key={f.key ?? 'all'}
            onClick={() => setEntity(f.key)}
            className={`min-h-btn-sm px-4 rounded-full text-sm font-medium ${
              entity === f.key
                ? 'bg-brand-600 text-white'
                : 'bg-white border border-line text-ink-soft hover:bg-gray-50'
            }`}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error.message} onRetry={refresh} />}
      {initialLoading && <SkeletonRows rows={5} />}

      {accumulated.length === 0 && !initialLoading && !error && (
        <p className="text-base text-ink-muted">{t('audit.empty')}</p>
      )}

      {accumulated.length > 0 && (
        <div className="card !p-0 overflow-hidden divide-y divide-gray-100">
          {accumulated.map((r) => <AuditEntry key={r.id} row={r} />)}
        </div>
      )}

      {nextCursor && (
        <button
          onClick={() => setCursor(nextCursor)}
          disabled={loadingMore}
          className="btn-secondary w-full"
        >
          {loadingMore ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {loadingMore ? t('common.loading') : t('pr.load.more')}
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
            <span className="text-xs text-ink-muted">{row.entity_type}</span>
            <span className="num text-xs text-ink-muted/70">{row.entity_id.slice(0, 8)}</span>
          </div>
          <div className="text-sm text-ink-soft mt-1">
            {row.actor_name ?? <em className="text-ink-muted">{t('audit.system')}</em>}
            {' · '}
            <span className="num">{new Date(row.created_at).toLocaleString(locale)}</span>
          </div>
        </div>
        {hasDiff && (open ? <ChevronUp className="w-5 h-5 text-ink-muted mt-1" /> : <ChevronDown className="w-5 h-5 text-ink-muted mt-1" />)}
      </button>
      {open && hasDiff && (
        <pre className="mt-3 p-3 bg-gray-50 rounded-lg text-xs overflow-x-auto font-mono">
          {JSON.stringify(row.diff, null, 2)}
        </pre>
      )}
    </div>
  );
}
