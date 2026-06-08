'use client';
import { useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  Copy, Loader2, Plus, RefreshCw, Trash2, Webhook,
} from 'lucide-react';
import {
  webhooks as webhooksApi, ApiError,
  type WebhookRow, type WebhookEvent, type DeliveryRow,
} from '@/lib/api';
import { useToast } from './Toast';
import { useT } from '@/lib/i18n/provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';

const EVENT_LABEL_KEYS: Record<WebhookEvent, TranslationKey> = {
  'pr.submitted':  'webhooks.event.pr_submitted',
  'pr.decided':    'webhooks.event.pr_decided',
  'pr.received':   'webhooks.event.pr_received',
  'reorder.alert': 'webhooks.event.reorder_alert',
  'anomaly.raised':'webhooks.event.anomaly_raised',
};

/**
 * Admin panel for outbound webhooks. Subscribers get a raw `secret` ONCE on
 * create — we show it inline with a copy button and warn that we can't show
 * it again. The card persists until the user dismisses it.
 */
export function WebhooksPanel() {
  const { toast }     = useToast();
  const { t, locale } = useT();
  const [items, setItems]   = useState<WebhookRow[] | null>(null);
  const [busy, setBusy]     = useState(false);

  // Form state for new webhook
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl]           = useState('');
  const [events, setEvents]     = useState<Set<WebhookEvent>>(new Set());
  // After-create reveal (secret returned ONCE — never available again)
  const [reveal, setReveal] = useState<{ id: string; url: string; secret: string } | null>(null);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    try {
      const list = await webhooksApi.list();
      setItems(list);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : t('webhooks.err.load'), 'err');
      setItems([]);
    }
  }

  function toggleEvent(e: WebhookEvent) {
    setEvents((cur) => {
      const next = new Set(cur);
      next.has(e) ? next.delete(e) : next.add(e);
      return next;
    });
  }

  async function create() {
    if (!url.trim()) { toast(t('webhooks.err.url'), 'warn'); return; }
    if (events.size === 0) { toast(t('webhooks.err.events'), 'warn'); return; }
    setBusy(true);
    try {
      const res = await webhooksApi.create({ url, events: [...events] });
      setReveal({ id: res.id, url: res.url, secret: res.secret });
      setUrl(''); setEvents(new Set()); setShowForm(false);
      await refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : t('webhooks.err.create'), 'err');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(t('webhooks.confirm.delete'))) return;
    try {
      await webhooksApi.remove(id);
      await refresh();
      toast(t('webhooks.toast.deleted'), 'ok');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : t('webhooks.err.delete'), 'err');
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 flex items-start gap-3">
        <Webhook className="w-5 h-5 text-brand-700 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-brand-900">{t('webhooks.hint')}</div>
      </div>

      {reveal && <RevealedSecret reveal={reveal} onDismiss={() => setReveal(null)} />}

      {items === null && (
        <div className="flex items-center justify-center py-6 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t('common.loading')}
        </div>
      )}

      {items && items.length === 0 && !showForm && (
        <div className="card text-center py-8">
          <Webhook className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <div className="font-semibold mb-1">{t('webhooks.empty')}</div>
          <div className="text-sm text-gray-600 mb-4">{t('webhooks.empty.sub')}</div>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((w) => (
            <WebhookCard
              key={w.id}
              webhook={w}
              locale={locale}
              onRemove={() => remove(w.id)}
            />
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="card space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <Plus className="w-5 h-5 text-brand-600" />
            {t('webhooks.add')}
          </h3>
          <div>
            <label className="block font-semibold mb-2 text-sm">{t('webhooks.url.label')}</label>
            <input
              type="url" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourapp.example.com/hooks/nirva"
              className="w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none font-mono text-sm"
            />
          </div>
          <div>
            <label className="block font-semibold mb-2 text-sm">{t('webhooks.events.label')}</label>
            <div className="flex flex-col gap-2">
              {(Object.keys(EVENT_LABEL_KEYS) as WebhookEvent[]).map((e) => (
                <label key={e} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={events.has(e)} onChange={() => toggleEvent(e)}
                    className="w-5 h-5 rounded text-brand-600" />
                  <span className="font-medium">{t(EVENT_LABEL_KEYS[e])}</span>
                  <code className="ml-auto text-xs text-gray-500">{e}</code>
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">{t('common.cancel')}</button>
            <button onClick={create} disabled={busy} className="btn-primary flex-1">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              {t('webhooks.create')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-2xl border-2 border-dashed border-gray-300 hover:border-brand-400 hover:bg-brand-50 text-gray-600 hover:text-brand-700 font-bold flex items-center justify-center gap-2 py-5"
        >
          <Plus className="w-5 h-5" />
          {t('webhooks.add.short')}
        </button>
      )}
    </div>
  );
}

// ─── WebhookCard with collapsible delivery log ────────────────────────────────

function WebhookCard({
  webhook, locale, onRemove,
}: {
  webhook: WebhookRow;
  locale: string;
  onRemove: () => void;
}) {
  const { toast } = useToast();
  const { t }     = useT();
  const [open,       setOpen]       = useState(false);
  const [deliveries, setDeliveries] = useState<DeliveryRow[] | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  async function loadLog() {
    if (deliveries !== null) { setOpen((v) => !v); return; }
    setOpen(true);
    setLoadingLog(true);
    try {
      const rows = await webhooksApi.deliveries(webhook.id);
      setDeliveries(rows);
    } catch {
      setDeliveries([]);
    } finally {
      setLoadingLog(false);
    }
  }

  async function handleReplay(d: DeliveryRow) {
    setReplayingId(d.id);
    try {
      const newRow = await webhooksApi.replay(webhook.id, d.id);
      // Prepend the new delivery row so user sees the result immediately.
      setDeliveries((cur) => (cur ? [newRow, ...cur] : [newRow]));
      toast(newRow.status_code && newRow.status_code < 300
        ? `✓ ${newRow.status_code}`
        : t('webhooks.log.err.replay'), newRow.status_code && newRow.status_code < 300 ? 'ok' : 'err');
    } catch {
      toast(t('webhooks.log.err.replay'), 'err');
    } finally {
      setReplayingId(null);
    }
  }

  return (
    <li className="card space-y-0 overflow-hidden p-0">
      {/* Main row */}
      <div className="flex items-start gap-3 p-4">
        <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0">
          <Webhook className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm break-all">{webhook.url}</div>
          <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-1">
            {webhook.events.map((e) => (
              <span key={e} className="bg-gray-100 px-2 py-0.5 rounded">
                {EVENT_LABEL_KEYS[e] ? t(EVENT_LABEL_KEYS[e]) : e}
              </span>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-2 flex items-center gap-3 flex-wrap">
            {webhook.last_status === null ? (
              <span>{t('webhooks.never_sent')}</span>
            ) : webhook.last_status >= 200 && webhook.last_status < 300 ? (
              <span className="text-green-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('webhooks.last_sent', { status: webhook.last_status })}
              </span>
            ) : (
              <span className="text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t('webhooks.last_sent', { status: webhook.last_status })}
              </span>
            )}
            {webhook.last_delivered_at && (
              <span className="num">· {new Date(webhook.last_delivered_at).toLocaleString(locale)}</span>
            )}
            {/* Delivery log toggle */}
            <button
              onClick={loadLog}
              className="flex items-center gap-1 text-brand-700 hover:text-brand-900 font-medium"
            >
              {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {open ? t('webhooks.log.hide') : t('webhooks.log.show')}
            </button>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="btn-sm w-10 h-10 rounded-lg hover:bg-red-50 text-red-600 flex items-center justify-center"
          aria-label={t('common.delete')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Delivery log panel */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {t('webhooks.log.title')}
            </span>
            <button
              onClick={async () => {
                setLoadingLog(true);
                try {
                  setDeliveries(await webhooksApi.deliveries(webhook.id));
                } finally { setLoadingLog(false); }
              }}
              className="text-gray-400 hover:text-gray-700"
              title={t('line.bind.refresh')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLog ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingLog && deliveries === null && (
            <div className="flex justify-center py-3">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          )}

          {deliveries !== null && deliveries.length === 0 && (
            <p className="text-sm text-gray-500 py-2">{t('webhooks.log.empty')}</p>
          )}

          {deliveries !== null && deliveries.length > 0 && (
            <ul className="space-y-1.5">
              {deliveries.map((d) => {
                const ok = d.status_code !== null && d.status_code >= 200 && d.status_code < 300;
                const failed = !ok;
                return (
                  <li key={d.id} className="flex items-start gap-2 text-xs py-1.5 px-2 rounded-lg bg-white border border-gray-100">
                    {/* Status dot */}
                    <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      ok ? 'bg-green-500' : d.status_code ? 'bg-amber-500' : 'bg-gray-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-gray-600">{d.event}</code>
                        {d.status_code && (
                          <span className={`num font-semibold ${ok ? 'text-green-700' : 'text-amber-700'}`}>
                            {d.status_code}
                          </span>
                        )}
                        {d.attempt > 1 && (
                          <span className="text-gray-400">{t('webhooks.log.attempt', { n: String(d.attempt) })}</span>
                        )}
                        <span className="num text-gray-400 ml-auto">
                          {new Date(d.created_at).toLocaleString(locale)}
                        </span>
                      </div>
                      {d.error && (
                        <p className="text-amber-700 mt-0.5 truncate" title={d.error}>{d.error}</p>
                      )}
                    </div>
                    {/* Replay button — only on failed deliveries */}
                    {failed && (
                      <button
                        onClick={() => handleReplay(d)}
                        disabled={replayingId !== null}
                        className="flex-shrink-0 btn-sm flex items-center gap-1 text-brand-700 border border-brand-200 rounded-lg px-2 py-1 hover:bg-brand-50 disabled:opacity-50"
                      >
                        {replayingId === d.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RefreshCw className="w-3.5 h-3.5" />}
                        {t('webhooks.log.replay')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

// ─── Revealed secret banner ───────────────────────────────────────────────────

function RevealedSecret({
  reveal, onDismiss,
}: { reveal: { url: string; secret: string }; onDismiss: () => void }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(reveal.secret); setCopied(true); }
    catch { /* clipboard may be blocked */ }
  }
  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-amber-900">{t('webhooks.secret.title')}</div>
          <div className="text-sm text-amber-800">{t('webhooks.secret.body')}</div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-3 font-mono text-sm break-all border border-amber-200">
        {reveal.secret}
      </div>
      <div className="flex gap-2">
        <button onClick={copy} className="btn-sm rounded-lg bg-white border border-amber-300 hover:bg-amber-50 text-amber-900 font-semibold px-4 flex items-center gap-2">
          <Copy className="w-4 h-4" />
          {copied ? t('webhooks.secret.copied') : t('webhooks.secret.copy')}
        </button>
        <button onClick={onDismiss} className="btn-sm rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold px-4">
          {t('webhooks.secret.dismiss')}
        </button>
      </div>
    </div>
  );
}
