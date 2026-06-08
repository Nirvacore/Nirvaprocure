// Server-safe mock data. Do NOT add React hooks or 'use client' here, or
// server components can't import these objects directly. Hooks live in
// lib/mock-hooks.ts.

import type { PrStatus } from '@/components/StatusPill';

export type Source = 'shopee' | 'lazada' | 'makro' | 'alibaba' | 'manual';

export interface PrRow {
  id: string;
  pr_number: string;
  title: string;
  status: PrStatus;
  total_minor: number;
  source: Source;
  created_at: string;
}

export interface InboxItem {
  id: string;
  pr_number: string;
  title: string;
  requester: string;
  dept: string;
  total_minor: number;
  items: number;
  source: Source;
  age: string;
  urgent: boolean;
}

export interface PrDetail {
  id: string;
  pr_number: string;
  title: string;
  status: PrStatus;
  requester: string;
  dept: string;
  submitted_at: string;
  justification: string;
  items: {
    description: string;
    qty: number;
    unit_price_minor: number;
    line_total_minor: number;
    source: Source;
    supplier_name?: string;
  }[];
  total_minor: number;
  trail: { kind: 'submitted' | 'approved' | 'rejected' | 'pending'; by: string; at: string; note?: string }[];
}

export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  rule: string;
  steps: { kind: 'role' | 'user'; label: string; sla?: number }[];
}

export interface UserRow {
  name: string;
  email: string;
  dept: string;
  role: string;
  active: boolean;
}

export interface Department {
  name: string;
  cost_center: string;
  head: string;
  members: number;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

export const mockPrs: PrRow[] = [
  { id: '1', pr_number: 'PR-2026-0042', title: 'หมึกเครื่องพิมพ์ ชั้น 5',  status: 'pending',  total_minor: 808920,  source: 'shopee', created_at: 'วันนี้' },
  { id: '2', pr_number: 'PR-2026-0041', title: 'ถุงมือแล็บ x 200 คู่',      status: 'approved', total_minor: 189000,  source: 'makro',  created_at: 'เมื่อวาน' },
  { id: '3', pr_number: 'PR-2026-0040', title: 'สินค้าตัวอย่าง Q2',         status: 'rejected', total_minor: 0,       source: 'lazada', created_at: '2 วัน' },
  { id: '4', pr_number: 'PR-2026-0039', title: 'SSD Server x 2',           status: 'draft',    total_minor: 840000,  source: 'manual', created_at: '3 วัน' },
  { id: '5', pr_number: 'PR-2026-0038', title: 'ของกินทีม Q1',              status: 'approved', total_minor: 250000,  source: 'manual', created_at: '5 วัน' },
];

export const mockInbox: InboxItem[] = [
  { id: 'ai-1', pr_number: 'PR-2026-0042', title: 'หมึกเครื่องพิมพ์ ชั้น 5',  requester: 'สุดา จ.', dept: 'ฝ่ายการเงิน', total_minor: 808920,  items: 1, source: 'shopee', age: 'วันนี้ 10:21', urgent: false },
  { id: 'ai-2', pr_number: 'PR-2026-0037', title: 'สินค้าตัวอย่างแคมเปญ Q2', requester: 'จิ๋ม ส.', dept: 'ฝ่ายการตลาด', total_minor: 2450000, items: 6, source: 'lazada', age: 'เมื่อวาน',   urgent: false },
  { id: 'ai-3', pr_number: 'PR-2026-0036', title: 'SSD Server x 2',         requester: 'ปอ น.',   dept: 'ฝ่ายไอที',    total_minor: 840000,  items: 2, source: 'manual', age: '3 วันที่แล้ว', urgent: true },
];

export const mockDetailById: Record<string, PrDetail> = {
  '1': {
    id: '1',
    pr_number: 'PR-2026-0042',
    title: 'หมึกเครื่องพิมพ์ ชั้น 5',
    status: 'pending',
    requester: 'สุดา จันทร์',
    dept: 'ฝ่ายการเงิน',
    submitted_at: 'วันนี้ 10:21',
    justification: 'เติมหมึกเครื่องพิมพ์ชั้น 5 ของฝ่ายการเงิน ตลับปัจจุบันใกล้หมด สัปดาห์หน้าต้องพิมพ์รายงาน Q1',
    items: [
      { description: 'HP 65A Black Toner Cartridge', qty: 4, unit_price_minor: 189000, line_total_minor: 756000, source: 'shopee', supplier_name: 'HP Authorized Store' },
    ],
    total_minor: 808920,
    trail: [
      { kind: 'submitted', by: 'สุดา จันทร์',           at: 'วันนี้ 10:21' },
      { kind: 'pending',   by: 'ปอ นวลรัตน์ (หัวหน้าฝ่าย)', at: 'กำลังรออยู่' },
    ],
  },
};

export const mockWorkflows: Workflow[] = [
  { id: 'wf-1', name: 'ใบขอทั่วไป (น้อยกว่า 50,000 ฿)', active: true, rule: 'ยอดน้อยกว่า ฿ 50,000',
    steps: [{ kind: 'role', label: 'หัวหน้าฝ่ายของผู้ขอ', sla: 24 }] },
  { id: 'wf-2', name: 'ใบขอกลาง (50,000 - 200,000 ฿)',  active: true, rule: 'ยอด ฿ 50,000 - 200,000',
    steps: [
      { kind: 'role', label: 'หัวหน้าฝ่ายของผู้ขอ', sla: 24 },
      { kind: 'user', label: 'ฝ่ายการเงิน (คุณวิภา)', sla: 48 },
    ] },
  { id: 'wf-3', name: 'ใบขอใหญ่ (มากกว่า 200,000 ฿)',   active: true, rule: 'ยอดมากกว่า ฿ 200,000',
    steps: [
      { kind: 'role', label: 'หัวหน้าฝ่ายของผู้ขอ', sla: 24 },
      { kind: 'user', label: 'ฝ่ายการเงิน (คุณวิภา)', sla: 48 },
      { kind: 'user', label: 'CFO (คุณสมชาย)',        sla: 72 },
    ] },
];

export const mockUsers: UserRow[] = [
  { name: 'สุดา จันทร์',  email: 'suda@nirva.co.th',    dept: 'การเงิน', role: 'ผู้ขอ',       active: true },
  { name: 'ปอ นวลรัตน์',  email: 'por@nirva.co.th',     dept: 'การเงิน', role: 'หัวหน้า',     active: true },
  { name: 'วิภา ศรีสุข',   email: 'wipa@nirva.co.th',    dept: 'การเงิน', role: 'ฝ่ายการเงิน', active: true },
  { name: 'สมชาย ใจดี',   email: 'somchai@nirva.co.th', dept: 'บริหาร',  role: 'CFO',         active: true },
  { name: 'จิ๋ม สุภาพร',   email: 'jim@nirva.co.th',     dept: 'การตลาด', role: 'ผู้ขอ',       active: true },
  { name: 'พงษ์ ตันติ',    email: 'pong@nirva.co.th',    dept: 'ไอที',    role: 'ผู้ขอ',       active: false },
];

export const mockDepartments: Department[] = [
  { name: 'การเงิน', cost_center: 'CC-100', head: 'ปอ นวลรัตน์', members: 5 },
  { name: 'การตลาด', cost_center: 'CC-200', head: 'จิ๋ม สุภาพร', members: 8 },
  { name: 'ไอที',    cost_center: 'CC-300', head: 'พงษ์ ตันติ',  members: 4 },
  { name: 'บริหาร',  cost_center: 'CC-001', head: 'สมชาย ใจดี', members: 2 },
];

export const srcLabel: Record<Source, string> = {
  shopee:  '🛒 Shopee',
  lazada:  '🛍️ Lazada',
  makro:   '🛒 Makro',
  alibaba: '📦 Alibaba',
  manual:  '✍️ พิมพ์เอง',
};
