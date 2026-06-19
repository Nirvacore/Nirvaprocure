'use client';
import { useState, useId } from 'react';
import { X, Loader2, PackagePlus } from 'lucide-react';
import { stock as stockApi, ApiError, type StockMoveType, type StockOnHandRow, type Warehouse } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useT } from '@/lib/i18n/provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  // Available items + warehouses come from the parent so the modal doesn't
  // re-fetch on every open. Empty arrays render an explanatory message.
  items: { id: string; sku: string; name: string }[];
  warehouses: Warehouse[];
  /** Optional pre-selected row to pre-fill item + warehouse when opened from a card. */
  prefill?: StockOnHandRow;
}

const TYPE_OPTIONS: { key: StockMoveType; labelKey: TranslationKey; hintKey: TranslationKey }[] = [
  { key: 'receive',    labelKey: 'move.type.receive',    hintKey: 'move.type.receive.hint' },
  { key: 'issue',      labelKey: 'move.type.issue',      hintKey: 'move.type.issue.hint' },
  { key: 'adjust_in',  labelKey: 'move.type.adjust_in',  hintKey: 'move.type.adjust_in.hint' },
  { key: 'adjust_out', labelKey: 'move.type.adjust_out', hintKey: 'move.type.adjust_out.hint' },
];

/**
 * Modal to record a stock movement. Optimistic: the parent's `onSaved` is
 * called after the API confirms; the parent refetches the on-hand grid.
 */
export function MovementModal({ open, onClose, onSaved, items, warehouses, prefill }: Props) {
  const { toast } = useToast();
  const { t } = useT();
  const titleId = useId();
  const [type, setType]               = useState<StockMoveType>('receive');
  const [itemId, setItemId]           = useState(prefill?.item_id ?? items[0]?.id ?? '');
  const [warehouseId, setWarehouseId] = useState(prefill?.warehouse_id ?? warehouses[0]?.id ?? '');
  const [qty, setQty]                 = useState('1');
  const [note, setNote]               = useState('');
  const [busy, setBusy]               = useState(false);

  if (!open) return null;

  const canSubmit =
    !!itemId && !!warehouseId && Number(qty) > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await stockApi.recordMovement({
        item_id:      itemId,
        warehouse_id: warehouseId,
        type,
        qty:          Number(qty),
        note:         note.trim() || undefined,
      });
      toast(t('move.toast.saved'), 'ok');
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : t('pr.new.toast.save_failed'), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-2xl w-full max-w-md shadow-lift max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center gap-3 p-5 border-b border-line">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
            <PackagePlus className="w-5 h-5" />
          </div>
          <h2 id={titleId} className="text-lg font-bold flex-1">{t('move.title')}</h2>
          <button onClick={onClose} aria-label={t('common.close')} className="btn-sm w-10 h-10 rounded-lg hover:bg-gray-100 text-ink-muted flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="block font-semibold mb-2 text-sm">{t('move.kind')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setType(opt.key)}
                  className={`btn-sm rounded-xl px-3 py-2 text-left border-2 ${
                    type === opt.key ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-sm">{t(opt.labelKey)}</div>
                  <div className="text-xs text-ink-muted">{t(opt.hintKey)}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-2 text-sm">{t('move.item')}</label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none bg-white"
            >
              {items.length === 0 && <option value="">{t('move.item.empty')}</option>}
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-2 text-sm">{t('move.warehouse')}</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none bg-white"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.code} · {w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-2 text-sm">{t('move.qty')}</label>
            <input
              type="number"
              min={0.0001}
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="num w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">{t('move.qty.hint')}</p>
          </div>

          <div>
            <label className="block font-semibold mb-2 text-sm">{t('move.note')}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={t('move.note.placeholder')}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none resize-none"
            />
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button onClick={submit} disabled={!canSubmit} className="btn-primary flex-1 disabled:opacity-50">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <PackagePlus className="w-5 h-5" />}
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
