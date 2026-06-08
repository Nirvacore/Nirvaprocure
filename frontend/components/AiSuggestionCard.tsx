'use client';
import { useState } from 'react';
import { Sparkles, Loader2, AlertTriangle, ExternalLink, TrendingDown } from 'lucide-react';
import { ai as aiApi, ApiError, type PriceCompareResult } from '@/lib/api';
import { fmtBaht } from '@/lib/format';
import { useT } from '@/lib/i18n/provider';

interface Props {
  itemName: string;
  currency?: string;
  /** Current listing(s) the AI should compare against; usually just the one
   *  on the PR plus a couple of marketplace alternatives the buyer found. */
  marketplaceListings?: {
    source: 'shopee' | 'lazada' | 'makro' | 'alibaba';
    url: string;
    price_minor: number;
    currency: string;
    supplier_name?: string;
  }[];
  /** Recent POs for the same item — gives the AI a median to anchor against. */
  historicalPos?: {
    date: string;
    supplier_name: string;
    unit_price_minor: number;
    currency: string;
  }[];
}

/**
 * "Did you check the price?" card. Lives on the PR detail screen; calls
 * NirvaAI on demand (not on mount) so we don't burn AI quota for every PR
 * view — only when a buyer or approver actively asks.
 */
export function AiSuggestionCard({
  itemName,
  currency = 'THB',
  marketplaceListings = [],
  historicalPos = [],
}: Props) {
  const [result, setResult] = useState<PriceCompareResult | null>(null);
  const [error,  setError]  = useState<string | null>(null);
  const [busy,   setBusy]   = useState(false);
  const { t } = useT();

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await aiApi.priceCompare({
        item_name: itemName,
        currency,
        marketplace_listings: marketplaceListings,
        historical_pos:       historicalPos,
      });
      setResult(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('ai.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-600" />
          {t('ai.title')}
        </h3>
        {!result && (
          <button onClick={run} disabled={busy} className="btn-sm rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 flex items-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? t('ai.busy') : t('ai.button')}
          </button>
        )}
      </div>

      {!result && !error && (
        <p className="text-sm text-gray-600">{t('ai.intro')}</p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-sm text-red-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-brand-50 to-indigo-50 rounded-xl p-4 border border-brand-200">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-sm font-semibold text-brand-800">{t('ai.recommended')}</div>
              {result.savings_vs_median_minor > 0 && (
                <div className="flex items-center gap-1 text-green-700 text-sm font-bold">
                  <TrendingDown className="w-4 h-4" />
                  {t('ai.savings', { amount: fmtBaht(result.savings_vs_median_minor) })}
                </div>
              )}
            </div>
            <div className="text-lg font-bold leading-snug">
              {result.recommended_choice.supplier_name}
            </div>
            <div className="num text-2xl font-bold text-brand-700 mt-1">
              ฿ {fmtBaht(result.recommended_choice.unit_price_minor)}
            </div>
            <a
              href={result.recommended_choice.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-700 hover:underline mt-2 inline-flex items-center gap-1"
            >
              {t('ai.view_source', { source: result.recommended_choice.source })}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-700 mb-1">{t('ai.reasoning')}</div>
            <p className="text-sm text-gray-700 leading-relaxed">{result.reasoning}</p>
          </div>

          {result.watch_outs.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {t('ai.watchouts')}
              </div>
              <ul className="space-y-1 text-sm text-amber-900">
                {result.watch_outs.map((w, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-600 mt-1">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
