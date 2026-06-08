'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Link as LinkIcon, Wand2, Check, Loader2, Plus, Send, Trash2, Package } from 'lucide-react';
import { fmtBaht } from '@/lib/format';
import { pr as prApi, ApiError } from '@/lib/api';
import type { Source } from '@/lib/mock-data';
import { useToast } from '@/components/Toast';
import { useT } from '@/lib/i18n/provider';

interface DraftItem {
  desc: string;
  qty: number;
  priceMinor: number;
  source: Source;
  supplier?: string;
}

// Brand names stay literal; only 'manual' has a translated label resolved
// inside the component (it changes per locale).
const SRC_BADGE_CLS: Record<DraftItem['source'], string> = {
  shopee:  'bg-orange-100 text-orange-800',
  lazada:  'bg-blue-100 text-blue-800',
  makro:   'bg-yellow-100 text-yellow-800',
  alibaba: 'bg-orange-100 text-orange-800',
  manual:  'bg-gray-200 text-gray-700',
};
const SRC_BADGE_BRAND: Record<Exclude<DraftItem['source'], 'manual'>, string> = {
  shopee:  '🛒 Shopee',
  lazada:  '🛍️ Lazada',
  makro:   '🛒 Makro',
  alibaba: '📦 Alibaba',
};

export default function NewPrPage() {
  return (
    <Suspense fallback={null}>
      <NewPrInner />
    </Suspense>
  );
}

function NewPrInner() {
  const router  = useRouter();
  const params  = useSearchParams();
  const { toast } = useToast();
  const { t } = useT();

  const [url, setUrl]         = useState('');
  const [parsing, setParsing] = useState(false);
  const [submitting, setSub]  = useState(false);
  const [items, setItems]     = useState<DraftItem[]>([]);
  const [title, setTitle]     = useState('');
  const [reason, setReason]   = useState('');
  const [fromStock, setFromStock] = useState<string | null>(null);

  // Prefill on first mount when ?prefill_* params are present (e.g. came from
  // a "reorder" click on the stock page). We hydrate state once and clear the
  // marker so future user edits aren't fighting the URL.
  useEffect(() => {
    const prefillDesc  = params.get('prefill_desc');
    const prefillTitle = params.get('prefill_title');
    const prefillQty   = params.get('prefill_qty');
    const stock        = params.get('from_stock');
    if (!prefillDesc && !prefillTitle && !stock) return;
    if (prefillTitle && !title) setTitle(prefillTitle);
    if (prefillDesc && items.length === 0) {
      setItems([{
        desc: prefillDesc,
        qty: Number(prefillQty || '1') || 1,
        priceMinor: 0,
        source: 'manual',
      }]);
    }
    if (stock) setFromStock(stock);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const total = items.reduce((s, i) => s + i.qty * i.priceMinor, 0);

  async function parseLink() {
    if (!url.trim()) return;
    setParsing(true);
    try {
      const parsed = await prApi.importLink(url);
      setItems((prev) => [...prev, {
        desc: parsed.description,
        qty: 1,
        priceMinor: parsed.unit_price_minor,
        source: parsed.source,
        supplier: parsed.supplier.name,
      }]);
      setUrl('');
      toast(t('pr.new.toast.fetched'), 'ok');
    } catch (err) {
      // Offline / backend not running → use the same Shopee mock the demo had,
      // so the page still feels alive in pure-frontend development.
      if (!(err instanceof ApiError)) {
        const isShopee = /shopee/i.test(url);
        setItems((prev) => [...prev, {
          desc: isShopee ? 'HP 65A Black Toner Cartridge' : t('pr.new.mock.item'),
          qty: 4,
          priceMinor: 189000,
          source: isShopee ? 'shopee' : 'lazada',
          supplier: isShopee ? 'HP Authorized Store' : t('pr.new.mock.supplier'),
        }]);
        setUrl('');
        toast(t('pr.new.toast.offline'), 'warn');
      } else {
        toast(`${t('pr.new.toast.fetch_failed')}: ${err.message}`, 'err');
      }
    } finally {
      setParsing(false);
    }
  }

  function updateItem(i: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (items.length === 0 || !title.trim()) return;
    setSub(true);
    try {
      const created = await prApi.create({
        title,
        justification: reason || undefined,
        items: items.map((it) => ({
          description: it.desc,
          quantity:    it.qty,
          unit:        'unit',
          unit_price_minor: it.priceMinor,
          source: it.source,
        })),
      });
      // Submit immediately so the buyer sees the approval workflow start.
      await prApi.submit(created.id);
      toast(t('pr.new.toast.submitted'), 'ok');
      router.push('/pr');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('pr.new.toast.save_failed');
      toast(msg, 'err');
    } finally {
      setSub(false);
    }
  }

  return (
    <section className="screen space-y-8 max-w-3xl mx-auto">
      <Link href="/" className="btn-sm inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 -ml-2 px-2 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
        <span>{t('common.back')}</span>
      </Link>

      <div>
        <h1 className="text-3xl font-bold mb-2">{t('pr.new.heading')}</h1>
        <p className="text-base text-gray-600">{t('pr.new.sub')}</p>
      </div>

      {fromStock && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <Package className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <strong>{t('pr.new.from_stock')}</strong> — {t('pr.new.from_stock.sub')}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-brand-50 to-indigo-50 rounded-2xl p-6 border-2 border-brand-200">
        <label className="flex items-center gap-2 font-semibold mb-3 text-brand-800">
          <LinkIcon className="w-5 h-5" />
          {t('pr.new.paste.label')}
        </label>
        <div className="flex gap-3">
          <input
            type="url"
            placeholder="https://shopee.co.th/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 px-4 rounded-xl border-2 border-white bg-white shadow-soft focus:border-brand-500 outline-none text-base"
          />
          <button onClick={parseLink} disabled={parsing} className="btn-primary px-6 whitespace-nowrap">
            {parsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            {parsing ? t('pr.new.paste.busy') : t('pr.new.paste.button')}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm text-brand-700">
          {(['Shopee', 'Lazada', 'Makro', 'Alibaba'] as const).map((p) => (
            <span key={p} className="px-2.5 py-1 bg-white rounded-full flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="card space-y-6">
        <div>
          <label className="block font-semibold mb-2 text-base">
            {t('pr.new.title.label')} <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('pr.new.title.placeholder')}
            className="w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none"
          />
        </div>

        <div>
          <label className="block font-semibold mb-2 text-base">{t('pr.new.reason.label')}</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={t('pr.new.reason.placeholder')}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none resize-none"
          />
        </div>

        <div>
          <label className="block font-semibold mb-3 text-base">{t('pr.new.items.label')}</label>
          {items.length === 0 ? (
            <div className="p-6 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 text-center text-gray-500">
              <div className="text-base">{t('pr.new.items.empty')}</div>
              <div className="text-sm mt-1">{t('pr.new.items.empty.sub')}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((it, i) => {
                const badgeCls = SRC_BADGE_CLS[it.source];
                const badgeLabel = it.source === 'manual'
                  ? t('pr.new.source.manual')
                  : SRC_BADGE_BRAND[it.source];
                return (
                  <div key={i} className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold flex-shrink-0 ${badgeCls}`}>
                        {badgeLabel}
                      </span>
                      <input
                        type="text"
                        value={it.desc}
                        onChange={(e) => updateItem(i, { desc: e.target.value })}
                        placeholder={t('pr.new.item.placeholder')}
                        className="flex-1 px-3 rounded-lg border-2 border-white focus:border-brand-500 outline-none bg-white"
                      />
                      <button
                        onClick={() => removeItem(i)}
                        aria-label={t('pr.new.item.remove')}
                        className="w-11 h-11 rounded-lg bg-white hover:bg-red-50 hover:text-red-600 border border-gray-200 flex items-center justify-center flex-shrink-0"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    {it.supplier && (
                      <div className="text-sm text-gray-600 pl-1">
                        {t('pr.new.supplier')}: <strong>{it.supplier}</strong>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-3">
                      <NumInput label={t('pr.new.field.qty')} value={it.qty} onChange={(v) => updateItem(i, { qty: v })} />
                      <NumInput label={t('pr.new.field.price')} value={it.priceMinor / 100} onChange={(v) => updateItem(i, { priceMinor: Math.round(v * 100) })} />
                      <div>
                        <span className="text-xs text-gray-600 font-medium">{t('pr.new.field.total')}</span>
                        <div className="num h-14 px-3 rounded-lg bg-white border-2 border-white flex items-center font-bold">
                          ฿ {fmtBaht(it.qty * it.priceMinor)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => setItems((prev) => [...prev, { desc: '', qty: 1, priceMinor: 0, source: 'manual' }])}
            className="btn-sm mt-3 w-full rounded-xl border-2 border-dashed border-gray-300 hover:border-brand-400 hover:bg-brand-50 text-gray-600 hover:text-brand-700 font-medium flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {t('pr.new.items.add')}
          </button>
        </div>

        <div className="border-t border-gray-200 pt-5 flex items-center justify-between">
          <span className="text-base text-gray-600">{t('pr.new.total')}</span>
          <span className="num text-3xl font-bold">฿ {fmtBaht(total)}</span>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <Link href="/" className="btn-secondary flex-1">{t('pr.new.save_draft')}</Link>
        <button
          onClick={submit}
          disabled={items.length === 0 || !title.trim() || submitting}
          className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          {submitting ? t('pr.new.submitting') : t('pr.new.submit')}
        </button>
      </div>
    </section>
  );
}

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-600 font-medium">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="num w-full px-3 rounded-lg border-2 border-white bg-white focus:border-brand-500 outline-none"
      />
    </label>
  );
}
