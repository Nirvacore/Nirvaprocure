'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Scale, FileText, CheckCircle2, XCircle, MinusCircle,
  Copy, Download, Loader2, ChevronRight, Printer, Pencil, Undo2, ShoppingCart,
} from 'lucide-react';
import { gov as govApi, type ToRDraft } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useToast } from '@/components/Toast';
import { useT } from '@/lib/i18n/provider';
import {
  advanceMockTorDraft, createMockPrFromTor, readMockTorDraft, revertMockTorDraft,
  storeMockTorDraft, syncMockTorListStatus, updateMockTorDraftBody, mergeMockTorPrLink,
} from '@/lib/tor-mock-store';
import {
  MOCK_TOR_BRIEFS,
  mockTorDraft,
  TOR_ADVANCE_LABEL_KEYS,
  TOR_CHECKLIST_LABEL_KEYS,
  TOR_DETAIL_STATUS_LABEL_KEYS,
  TOR_DETAIL_STATUS_STYLE,
  TOR_REVERT_LABEL_KEYS,
  TOR_UUID_RE,
} from '@/lib/tor-shared';

const CHECKLIST_LABEL_KEYS = TOR_CHECKLIST_LABEL_KEYS;
const STATUS_LABEL_KEYS = TOR_DETAIL_STATUS_LABEL_KEYS;
const ADVANCE_LABEL_KEYS = TOR_ADVANCE_LABEL_KEYS;
const REVERT_LABEL_KEYS = TOR_REVERT_LABEL_KEYS;
const STATUS_STYLE = TOR_DETAIL_STATUS_STYLE;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/v1';

export default function TorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useT();
  const { toast } = useToast();
  const [local, setLocal] = useState<ToRDraft | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [creatingPr, setCreatingPr] = useState(false);
  const [editing, setEditing] = useState(false);
  const [bodyEdit, setBodyEdit] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(
      () => govApi.getDraft(id),
      mergeMockTorPrLink(mockTorDraft(id, readMockTorDraft(id))),
    ),
    [id],
  );

  const draft = local ?? data;
  const isLiveDraft = TOR_UUID_RE.test(id);
  const canEdit = draft?.status === 'draft' || draft?.status === 'review';
  const advanceKey = draft ? ADVANCE_LABEL_KEYS[draft.status] : undefined;
  const revertKey = draft ? REVERT_LABEL_KEYS[draft.status] : undefined;
  const statusStyle = draft ? STATUS_STYLE[draft.status] : null;
  const failedChecklistCount = draft
    ? Object.values(draft.compliance_checklist).filter((s) => s === 'failed').length
    : 0;
  const fmtDate = draft
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(draft.created_at))
    : '';

  async function advanceStatus() {
    if (!draft || !advanceKey) return;
    setAdvancing(true);
    try {
      const updated = await withMockFallback(
        () => govApi.advanceStatus(id),
        advanceMockTorDraft(id, mockTorDraft(id, readMockTorDraft(id))),
      );
      storeMockTorDraft(updated);
      syncMockTorListStatus(id, updated.status);
      setLocal(updated);
      toast(t('tor.toast.status'), 'ok');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'err');
    } finally {
      setAdvancing(false);
    }
  }

  async function revertStatus() {
    if (!draft || !revertKey) return;
    setReverting(true);
    try {
      const updated = await withMockFallback(
        () => govApi.revertStatus(id),
        revertMockTorDraft(id, mockTorDraft(id, readMockTorDraft(id))),
      );
      storeMockTorDraft(updated);
      syncMockTorListStatus(id, updated.status);
      setLocal(updated);
      toast(t('tor.toast.status'), 'ok');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'err');
    } finally {
      setReverting(false);
    }
  }

  async function createPrFromTor() {
    if (!draft) return;
    const brief = MOCK_TOR_BRIEFS[id];
    if (!brief) {
      toast(t('common.error'), 'err');
      return;
    }
    setCreatingPr(true);
    try {
      const updated = await withMockFallback(
        () => govApi.createPrFromTor(id),
        createMockPrFromTor(id, draft, brief),
      );
      storeMockTorDraft(updated);
      setLocal(updated);
      toast(t('tor.toast.pr_created'), 'ok');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'err');
    } finally {
      setCreatingPr(false);
    }
  }

  function copyBody() {
    if (!draft?.body_markdown) return;
    void navigator.clipboard.writeText(draft.body_markdown).then(() => {
      toast(t('tor.toast.copied'), 'ok');
    });
  }

  function downloadBody() {
    if (!draft?.body_markdown) return;
    const slug = draft.title.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().slice(0, 60) || 'tor-draft';
    const blob = new Blob([draft.body_markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slug}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast(t('tor.toast.downloaded'), 'ok');
  }

  function startEdit() {
    setBodyEdit(draft?.body_markdown ?? '');
    setEditing(true);
  }

  async function saveBody() {
    if (!draft) return;
    setSaving(true);
    try {
      const updated = await withMockFallback(
        () => govApi.updateDraft(id, { body_markdown: bodyEdit }),
        updateMockTorDraftBody(id, mockTorDraft(id, readMockTorDraft(id)), bodyEdit),
      );
      storeMockTorDraft(updated);
      setLocal(updated);
      setEditing(false);
      toast(t('tor.toast.saved'), 'ok');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="screen space-y-6 max-w-4xl mx-auto">
      <Link href="/gov/tor" className="no-print btn-sm inline-flex items-center gap-2 text-ink-soft hover:text-ink -ml-2 px-2 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
        <span>{t('tor.list.back')}</span>
      </Link>

      {error && <ErrorBanner message={error?.message} onRetry={refresh} />}
      {loading && !draft && <Loading />}

      {draft && (
        <>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3 text-ink">
                <Scale className="w-6 h-6 text-brand-600 flex-shrink-0" />
                {draft.title}
              </h1>
              <p className="text-sm text-ink-soft mt-2 num">{fmtDate}</p>
            </div>
            {statusStyle && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                {t(STATUS_LABEL_KEYS[draft.status])}
              </span>
            )}
          </div>

          {draft.linked_pr_id && (
            <Link
              href={`/pr/${draft.linked_pr_id}`}
              className="no-print card hover:border-brand-300 transition-colors block"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="w-5 h-5 text-blue-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-soft mb-1">{t('tor.linked_pr.title')}</div>
                  <div className="font-semibold text-ink leading-snug num">
                    {draft.linked_pr_number ?? draft.linked_pr_id}
                  </div>
                  <div className="text-sm text-brand-600 mt-1">{t('tor.linked_pr.view')}</div>
                </div>
              </div>
            </Link>
          )}

          <div className="flex flex-wrap gap-2 no-print">
            {advanceKey && (
              <button
                type="button"
                onClick={() => void advanceStatus()}
                disabled={advancing || reverting || creatingPr}
                className="btn-primary inline-flex items-center gap-2 px-5"
              >
                {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                {t(advanceKey)}
              </button>
            )}
            {revertKey && (
              <button
                type="button"
                onClick={() => void revertStatus()}
                disabled={advancing || reverting || creatingPr}
                className="btn-secondary inline-flex items-center gap-2 px-5"
              >
                {reverting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                {t(revertKey)}
              </button>
            )}
            {draft.status === 'approved' && !draft.linked_pr_id && MOCK_TOR_BRIEFS[id] && (
              <button
                type="button"
                onClick={() => void createPrFromTor()}
                disabled={advancing || reverting || creatingPr}
                className="btn-primary inline-flex items-center gap-2 px-5"
              >
                {creatingPr ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                {t('tor.action.create_pr')}
              </button>
            )}
            {draft.body_markdown && !editing && (
              <>
                <button
                  type="button"
                  onClick={copyBody}
                  className="btn-secondary inline-flex items-center gap-2 px-5"
                >
                  <Copy className="w-4 h-4" />
                  {t('tor.action.copy')}
                </button>
                <button
                  type="button"
                  onClick={downloadBody}
                  className="btn-secondary inline-flex items-center gap-2 px-5"
                >
                  <Download className="w-4 h-4" />
                  {t('tor.action.download')}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-secondary inline-flex items-center gap-2 px-5"
                >
                  <Printer className="w-4 h-4" />
                  {t('tor.action.print')}
                </button>
                {isLiveDraft && (
                  <a
                    href={`${API_BASE}/gov/tor/drafts/${id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary inline-flex items-center gap-2 px-5"
                  >
                    <FileText className="w-4 h-4" />
                    {t('detail.pdf')}
                  </a>
                )}
              </>
            )}
          </div>

          {failedChecklistCount > 0 && canEdit && !editing && (
            <div className="no-print card border-amber-200 bg-amber-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-amber-900">
                {t('tor.checklist.failed_banner', { count: failedChecklistCount })}
              </p>
              <button
                type="button"
                onClick={startEdit}
                className="btn-secondary inline-flex items-center gap-2 px-4 shrink-0"
              >
                <Pencil className="w-4 h-4" />
                {t('tor.action.edit')}
              </button>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="space-y-6">
              <div className="card">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-ink">
                    <FileText className="w-5 h-5 text-ink-muted" />
                    {t('tor.draft.title')}
                  </h2>
                  {canEdit && !editing && (
                    <button
                      type="button"
                      onClick={startEdit}
                      className="no-print btn-sm inline-flex items-center gap-2 text-ink-soft hover:text-ink"
                    >
                      <Pencil className="w-4 h-4" />
                      {t('tor.action.edit')}
                    </button>
                  )}
                </div>
                {editing ? (
                  <div className="no-print space-y-3">
                    <textarea
                      aria-label={t('tor.detail.body_label')}
                      className="input min-h-[280px] w-full font-mono text-sm leading-relaxed"
                      value={bodyEdit}
                      onChange={(e) => setBodyEdit(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void saveBody()}
                        disabled={saving}
                        className="btn-primary inline-flex items-center gap-2 px-5"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {t('common.save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        disabled={saving}
                        className="btn-secondary px-5"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : draft.body_markdown ? (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-ink leading-relaxed">
                    {draft.body_markdown}
                  </div>
                ) : (
                  <div className="text-ink-soft">{t('tor.detail.no_body')}</div>
                )}
              </div>
            </div>

            <div className="card h-fit lg:sticky lg:top-24 no-print">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-ink">
                <FileText className="w-5 h-5 text-ink-muted" />
                {t('tor.checklist.title')}
              </h2>
              {Object.keys(draft.compliance_checklist).length > 0 ? (
                <ul className="space-y-2">
                  {Object.entries(draft.compliance_checklist).map(([key, status]) => (
                    <ChecklistItem
                      key={key}
                      label={CHECKLIST_LABEL_KEYS[key] ? t(CHECKLIST_LABEL_KEYS[key]) : key}
                      status={status}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-soft">{t('tor.checklist.hint')}</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ChecklistItem({ label, status }: { label: string; status: 'passed' | 'failed' | 'na' }) {
  const cfg = {
    passed: { icon: CheckCircle2, cls: 'text-green-600',  bg: 'bg-green-50' },
    failed: { icon: XCircle,      cls: 'text-red-600',    bg: 'bg-red-50' },
    na:     { icon: MinusCircle,  cls: 'text-ink-muted',  bg: 'bg-gray-50' },
  }[status];
  const Icon = cfg.icon;
  return (
    <li className={`flex items-start gap-3 p-3 rounded-xl ${cfg.bg}`}>
      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${cfg.cls}`} />
      <span className="text-sm leading-snug text-ink">{label}</span>
    </li>
  );
}
