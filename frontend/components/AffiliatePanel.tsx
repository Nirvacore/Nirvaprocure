'use client';
import { useEffect, useState } from 'react';
import { BadgeDollarSign, CheckCircle2, Loader2, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { ApiError } from '@/lib/api';

const API = '/api';
async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new ApiError(res.status, 'ERR', err.message ?? `${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}
import { useToast } from './Toast';
import { useT } from '@/lib/i18n/provider';

type Platform = 'shopee' | 'lazada' | 'makro' | 'alibaba';

interface AffiliateConfig {
  id: string;
  platform: Platform;
  affiliate_id: string;
  sub_id: string | null;
  is_active: boolean;
  note: string | null;
}

interface ClickStats { platform: string; clicks: number }

// ── API helpers ───────────────────────────────────────────────────────────────
const affiliateApi = {
  list:   () => req<AffiliateConfig[]>('GET', '/affiliate'),
  upsert: (body: { platform: Platform; affiliate_id: string; sub_id?: string; note?: string }) =>
    req<AffiliateConfig>('POST', '/affiliate', body),
  toggle: (id: string, is_active: boolean) =>
    req<void>('PATCH', `/affiliate/${id}/toggle`, { is_active }),
  remove: (id: string) => req<void>('DELETE', `/affiliate/${id}`),
  stats:  () => req<ClickStats[]>('GET', '/affiliate/stats'),
};

const PLATFORMS: Platform[] = ['shopee', 'lazada', 'makro', 'alibaba'];

const PLATFORM_COLORS: Record<Platform, { bg: string; text: string; logo: string }> = {
  shopee:  { bg: 'bg-orange-50',  text: 'text-orange-700', logo: '🛒' },
  lazada:  { bg: 'bg-blue-50',    text: 'text-blue-700',   logo: '🛍️' },
  makro:   { bg: 'bg-yellow-50',  text: 'text-yellow-700', logo: '🏪' },
  alibaba: { bg: 'bg-red-50',     text: 'text-red-700',    logo: '📦' },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AffiliatePanel() {
  const { toast } = useToast();
  const { t }     = useT();

  const [configs, setConfigs] = useState<AffiliateConfig[] | null>(null);
  const [stats,   setStats]   = useState<ClickStats[]>([]);
  const [form, setForm]       = useState<{ platform: Platform; affiliate_id: string; sub_id: string; note: string } | null>(null);
  const [saving, setSaving]   = useState(false);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    try {
      const [cfgs, s] = await Promise.all([affiliateApi.list(), affiliateApi.stats()]);
      setConfigs(cfgs);
      setStats(s);
    } catch {
      setConfigs([]);
    }
  }

  const clicksForPlatform = (p: string) =>
    stats.find((s) => s.platform === p)?.clicks ?? 0;

  function openForm(platform: Platform, existing?: AffiliateConfig) {
    setForm({
      platform,
      affiliate_id: existing?.affiliate_id ?? '',
      sub_id:       existing?.sub_id ?? '',
      note:         existing?.note ?? '',
    });
  }

  async function handleSave() {
    if (!form || !form.affiliate_id.trim()) return;
    setSaving(true);
    try {
      await affiliateApi.upsert({
        platform:     form.platform,
        affiliate_id: form.affiliate_id.trim(),
        sub_id:       form.sub_id.trim() || undefined,
        note:         form.note.trim() || undefined,
      });
      toast(t('affiliate.toast.saved'), 'ok');
      setForm(null);
      await refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : t('affiliate.toast.saved'), 'err');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(cfg: AffiliateConfig) {
    try {
      await affiliateApi.toggle(cfg.id, !cfg.is_active);
      await refresh();
    } catch { /* ignore */ }
  }

  async function handleRemove(id: string) {
    if (!confirm(`${t('affiliate.remove')}?`)) return;
    try {
      await affiliateApi.remove(id);
      toast(t('affiliate.toast.removed'), 'ok');
      await refresh();
    } catch { /* ignore */ }
  }

  const configByPlatform = (p: Platform) => configs?.find((c) => c.platform === p);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
        <BadgeDollarSign className="w-5 h-5 text-green-700 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-green-900">
          <span className="font-semibold">{t('affiliate.heading')}</span>
          {' — '}
          {t('affiliate.sub')}
        </div>
      </div>

      {/* Stats row */}
      {stats.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {stats.map((s) => {
            const style = PLATFORM_COLORS[s.platform as Platform] ?? { bg: 'bg-gray-50', text: 'text-gray-700', logo: '🔗' };
            return (
              <div key={s.platform} className={`${style.bg} ${style.text} rounded-xl px-4 py-2 text-sm font-semibold`}>
                {style.logo} {t('affiliate.stats.clicks', { n: String(s.clicks) })} · {t(`affiliate.platform.${s.platform}` as any)}
              </div>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {configs === null && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      )}

      {/* Platform cards */}
      {configs !== null && (
        <div className="grid sm:grid-cols-2 gap-4">
          {PLATFORMS.map((platform) => {
            const cfg   = configByPlatform(platform);
            const style = PLATFORM_COLORS[platform];
            const clicks = clicksForPlatform(platform);
            const hintKey = `affiliate.id.hint.${platform}`;

            return (
              <div key={platform} className="card space-y-3">
                {/* Platform header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{style.logo}</span>
                    <span className="font-bold text-lg">{t(`affiliate.platform.${platform}` as any)}</span>
                  </div>
                  {cfg && (
                    <div className="flex items-center gap-2">
                      {clicks > 0 && (
                        <span className="text-xs text-gray-500 num">{clicks} links</span>
                      )}
                      <button onClick={() => handleToggle(cfg)} title={cfg.is_active ? t('affiliate.active') : t('affiliate.inactive')}>
                        {cfg.is_active
                          ? <ToggleRight className="w-6 h-6 text-green-600" />
                          : <ToggleLeft  className="w-6 h-6 text-gray-400" />}
                      </button>
                      <button onClick={() => handleRemove(cfg.id)} className="text-red-400 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Configured state */}
                {cfg ? (
                  <div className={`rounded-xl ${style.bg} px-3 py-2`}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`w-4 h-4 ${style.text} flex-shrink-0`} />
                      <code className={`text-sm font-mono ${style.text} break-all`}>{cfg.affiliate_id}</code>
                    </div>
                    {cfg.sub_id && <p className="text-xs text-gray-500 mt-1">sub: {cfg.sub_id}</p>}
                    <button
                      onClick={() => openForm(platform, cfg)}
                      className="text-xs text-gray-500 underline mt-1"
                    >
                      {t('common.edit')}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => openForm(platform)}
                    className="w-full rounded-xl border-2 border-dashed border-gray-200 hover:border-brand-400 hover:bg-brand-50 text-gray-500 hover:text-brand-700 flex items-center justify-center gap-2 py-4 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    {t('affiliate.id.label')}
                  </button>
                )}

                {/* Inline form */}
                {form?.platform === platform && (
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-semibold mb-1">{t('affiliate.id.label')}</label>
                      <input
                        type="text"
                        value={form.affiliate_id}
                        onChange={(e) => setForm({ ...form, affiliate_id: e.target.value })}
                        placeholder={t(hintKey as any)}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">{t('affiliate.sub_id.label')}</label>
                      <input
                        type="text"
                        value={form.sub_id}
                        onChange={(e) => setForm({ ...form, sub_id: e.target.value })}
                        placeholder="e.g. procurement-dept"
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setForm(null)}
                        className="flex-1 btn-secondary rounded-xl py-2 text-sm"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving || !form.affiliate_id.trim()}
                        className="flex-1 btn-primary rounded-xl py-2 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {t('affiliate.save')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
