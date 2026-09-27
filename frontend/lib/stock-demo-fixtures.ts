import type { StockOnHandRow, Warehouse } from './api';

/**
 * Development-only stock fixtures. Keep these behind a lazy import so the
 * production bundle cannot accidentally ship demo inventory as live data.
 */
const demoWarehouses: Warehouse[] = [
  { id: 'wh-1', name: 'คลังหลัก สำนักงานใหญ่', code: 'HQ', address: null, is_active: true },
  { id: 'wh-2', name: 'คลังย่อย ชั้น 5', code: 'F5', address: null, is_active: true },
];

const demoOnHand: StockOnHandRow[] = [
  {
    item_id: 'i1', sku: 'HP-65A', name: 'HP 65A Black Toner Cartridge', unit: 'ea',
    warehouse_id: 'wh-1', warehouse_code: 'HQ', warehouse_name: 'คลังหลัก สำนักงานใหญ่',
    qty: 2, reorder_point: 5, below_reorder: true,
  },
  {
    item_id: 'i2', sku: 'LAB-GLOVE-M', name: 'ถุงมือแล็บ ขนาด M', unit: 'pair',
    warehouse_id: 'wh-1', warehouse_code: 'HQ', warehouse_name: 'คลังหลัก สำนักงานใหญ่',
    qty: 120, reorder_point: 50, below_reorder: false,
  },
  {
    item_id: 'i3', sku: 'SSD-2TB', name: 'SSD Server 2TB', unit: 'ea',
    warehouse_id: 'wh-2', warehouse_code: 'F5', warehouse_name: 'คลังย่อย ชั้น 5',
    qty: 1, reorder_point: 3, below_reorder: true,
  },
];

export function loadDemoWarehouses(): Warehouse[] {
  return demoWarehouses.map((warehouse) => ({ ...warehouse }));
}

export function loadDemoOnHand(warehouseId?: string): StockOnHandRow[] {
  return demoOnHand
    .filter((row) => !warehouseId || row.warehouse_id === warehouseId)
    .map((row) => ({ ...row }));
}
