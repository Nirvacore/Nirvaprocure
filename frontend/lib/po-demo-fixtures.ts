import type { PoRow } from './api';

const demoPos: PoRow[] = [
  { id: 'po-1', po_number: 'PO-2026-0018', pr_id: '2', supplier_id: 'sup-2', supplier_name: 'บริษัท แม็คโคร จำกัด', status: 'received', total_minor: 189000_00, currency: 'THB', notes: null, issued_by: 'ปอ นวลรัตน์', issued_at: '2026-05-20', created_at: '2026-05-19' },
  { id: 'po-2', po_number: 'PO-2026-0017', pr_id: '5', supplier_id: 'sup-3', supplier_name: 'ร้านเครื่องเขียนสยาม', status: 'received', total_minor: 25000_00, currency: 'THB', notes: null, issued_by: 'วิภา ศรีสุข', issued_at: '2026-05-10', created_at: '2026-05-09' },
  { id: 'po-3', po_number: 'PO-2026-0019', pr_id: '1', supplier_id: 'sup-1', supplier_name: 'HP Authorized Store Thailand', status: 'sent', total_minor: 808920_00, currency: 'THB', notes: null, issued_by: 'ปอ นวลรัตน์', issued_at: '2026-06-07', created_at: '2026-06-07' },
  { id: 'po-4', po_number: 'PO-2026-0016', pr_id: null, supplier_id: null, supplier_name: null, status: 'draft', total_minor: 840000_00, currency: 'THB', notes: 'SSD Server x2', issued_by: 'พงษ์ ตันติ', issued_at: null, created_at: '2026-06-01' },
  { id: 'po-5', po_number: 'PO-2026-0015', pr_id: '3', supplier_id: null, supplier_name: 'Lazada Partner', status: 'cancelled', total_minor: 0, currency: 'THB', notes: 'rejected', issued_by: 'วิภา ศรีสุข', issued_at: '2026-04-15', created_at: '2026-04-14' },
];

export function loadDemoPos(filter?: string): PoRow[] { return filter ? demoPos.filter((p) => p.status === filter) : demoPos; }
export function loadDemoPo(id: string): PoRow { return demoPos.find((p) => p.id === id) ?? demoPos[0]; }
