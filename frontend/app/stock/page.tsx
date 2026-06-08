'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, Package, Warehouse, RotateCw, PackagePlus } from 'lucide-react';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { stock as stockApi, type Warehouse as Wh, type StockOnHandRow } from '@/lib/api';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';
import { MovementModal } from '@/components/MovementModal';
import { useT } from '@/lib/i18n/provider';

// Offline / no-backend fallback so the page renders in pure-frontend dev.
const MOCK_WAREHOUSES: Wh[] = [
  { id: 'wh-1', name: 'คลังหลัก สำนักงานใหญ่', code: 'HQ',  address: null, is_active: true },
  { id: 'wh-2', name: 'คลังย่อย ชั้น 5',         code: 'F5',  address: null, is_active: true },
];

const MOCK_ON_HAND: StockOnHandRow[] = [
  {
    item_id: 'i1', sku: 'HP-65A',  name: 'HP 65A Black Toner Cartridge', unit: 'ea',
    warehouse_id: 'wh-1', warehouse_code: 'HQ', warehouse_name: 'คลังหลัก สำนักงานใหญ่',
    qty: 2, reorder_point: 5, below_reorder: true,
  },
  {
    item_id: 'i2', sku: 'LAB-GLOVE-M', name: 'ถุงมือแล็บ ขนาด M',       unit: 'pair',
    warehouse_id: 'wh-1', warehouse_code: 'HQ', warehouse_name: 'คลังหลัก สำนักงานใหญ่',
    qty: 120, reorder_point: 50, below_reorder: false,
  },
  {
    item_id: 'i3', sku: 'SSD-2TB',    name: 'SSD Server 2TB',           unit: 'ea',
    warehouse_id: 'wh-2', warehouse_code: 'F5', warehouse_name: 'คลังย่อย ชั้น 5',
    qty: 1, reorder_point: 3, below_reorder: true,
  },
];

export default function StockPage() {
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [modalOpen, setModalOpen]     = useState(false);
  const [prefillRow, setPrefillRow]   = useState<StockOnHandRow | undefined>(undefined);
  const { t } = useT();

  const warehouses = useResource(
    () => withMockFallback(() => stockApi.listWarehouses(), MOCK_WAREHOUSES),
  );

  const onHand = useResource(
    () => withMockFallback(
      () => stockApi.onHand(warehouseId ?? undefined),
      warehouseId ? MOCK_ON_HAND.filter((r) => r.warehouse_id === warehouseId) : MOCK_ON_HAND,
    ),
    [warehouseId],
  );

  const lowCount = useMemo(
    () => (onHand.data ?? []).filter((r) => r.below_reorder).length,
    [onHand.data],
  );

  // Items for the movement modal dropdown — derive from the on-hand rows so
  // we don't need a separate items endpoint just for this. Dedupe by id.
  const itemOptions = useMemo(() => {
    const map = new Map<string, { id: string; sku: string; name: string }>();
    for (const r of onHand.data ?? []) {
      if (!map.has(r.item_id)) map.set(r.item_id, { id: r.item_id, sku: r.sku, name: r.name });
    }
    return [...map.values()];
  }, [onHand.data]);

  function openMovement(row?: StockOnHandRow) {
    setPrefillRow(row);
    setModalOpen(true);
  }

  return (
    <section className="screen space-y-6">
      <Link href="/" className="btn-sm inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 -ml-2 px-2 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
        <span>{t('common.back')}</span>
      </Link>

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-1">{t('stock.heading')}</h1>
          <p className="text-base text-gray-600">{t('stock.sub')}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {lowCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-900 font-semibold">
              <AlertTriangle className="w-5 h-5" />
              {t('stock.alert.low', { count: lowCount })}
            </div>
          )}
          <button onClick={() => openMovement()} className="btn-primary px-5">
            <PackagePlus className="w-5 h-5" />
            {t('stock.action.movement')}
          </button>
        </div>
      </div>

      {/* Warehouse selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip
          active={warehouseId === null}
          onClick={() => setWarehouseId(null)}
          icon={<Warehouse className="w-4 h-4" />}
        >
          {t('stock.filter.all')}
        </FilterChip>
        {(warehouses.data ?? []).map((w) => (
          <FilterChip
            key={w.id}
            active={warehouseId === w.id}
            onClick={() => setWarehouseId(w.id)}
          >
            {w.code} · {w.name}
          </FilterChip>
        ))}
      </div>

      {onHand.error && <ErrorBanner message={onHand.error.message} onRetry={onHand.refresh} />}
      {onHand.loading && !onHand.data && <Loading />}
      {onHand.data && onHand.data.length === 0 && (
        <div className="bg-white rounded-2xl p-10 text-center border border-gray-200">
          <Package className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <div className="text-xl font-bold mb-1">{t('stock.empty.heading')}</div>
          <div className="text-base text-gray-600">{t('stock.empty.sub')}</div>
        </div>
      )}

      {onHand.data && onHand.data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {onHand.data.map((row) => (
            <StockCard
              key={`${row.item_id}-${row.warehouse_id}`}
              row={row}
              onAdjust={() => openMovement(row)}
            />
          ))}
        </div>
      )}

      <MovementModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => onHand.refresh()}
        items={itemOptions}
        warehouses={warehouses.data ?? []}
        prefill={prefillRow}
      />
    </section>
  );
}

function FilterChip({
  active, onClick, icon, children,
}: { active: boolean; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-btn-sm px-4 rounded-full text-sm font-medium flex items-center gap-2 ${
        active ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function StockCard({ row, onAdjust }: { row: StockOnHandRow; onAdjust: () => void }) {
  const router = useRouter();
  const { t } = useT();
  const lowStock = row.below_reorder;

  function reorder() {
    // Push to the PR draft with prefill params. /pr/new reads `prefill_*`
    // and pre-fills a manual line item so the buyer just confirms qty/price.
    const params = new URLSearchParams({
      from_stock:    row.item_id,
      prefill_title: t('stock.reorder.title', { name: row.name }),
      prefill_desc:  row.name,
      // Suggest replenishing to comfortably above reorder; the brief default
      // is "reorder up to 2x the threshold" — buyers can tweak.
      prefill_qty:   String(Math.max((row.reorder_point ?? 1) * 2 - row.qty, 1)),
      prefill_unit:  row.unit,
    });
    router.push(`/pr/new?${params.toString()}`);
  }

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-soft border-2 ${lowStock ? 'border-amber-300' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          lowStock ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {lowStock ? <AlertTriangle className="w-6 h-6" /> : <Package className="w-6 h-6" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="num text-xs text-gray-500 mb-0.5">{row.sku}</div>
          <div className="text-base font-bold leading-snug">{row.name}</div>
          <div className="text-xs text-gray-500 mt-1">{row.warehouse_code} · {row.warehouse_name}</div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-gray-600">{t('stock.card.qty')}</span>
          <span className={`num text-2xl font-bold ${lowStock ? 'text-amber-800' : 'text-gray-900'}`}>
            {row.qty} <span className="text-base text-gray-500">{row.unit}</span>
          </span>
        </div>
        {row.reorder_point != null && (
          <div className="flex items-baseline justify-between gap-2 mt-1 text-sm text-gray-600">
            <span>{t('stock.card.reorder')}</span>
            <span className="num">{row.reorder_point}</span>
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <button
            onClick={onAdjust}
            className="btn-sm rounded-xl bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-bold px-3 flex-1 text-sm flex items-center justify-center gap-1"
            aria-label={t('stock.action.movement')}
          >
            {t('stock.card.adjust')}
          </button>
          {lowStock && (
            <button onClick={reorder} className="btn-primary btn-sm px-3 text-sm flex-1">
              <RotateCw className="w-4 h-4" />
              {t('stock.card.reorder.button')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
