/**
 * Tiny typed HTTP client around the backend (see ../api/openapi.yaml).
 *
 * Every function returns the parsed JSON body or throws `ApiError` on non-2xx.
 * Tokens live in localStorage; swap to httpOnly cookie for production.
 *
 * The wrapper transparently refreshes the access token once when a 401 comes
 * back, so callers don't need to think about token lifetimes.
 */

import type { PrStatus } from '@/components/StatusPill';
import type { Source } from './mock-data';

// ---------------------------------------------------------------------------
// Wire types — mirror the OpenAPI schemas
// ---------------------------------------------------------------------------
export interface Money {
  amount_minor: number;
  currency: string;
}
export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  org_id: string;
}
export interface PrSummary {
  id: string;
  pr_number: string;
  title: string;
  status: PrStatus;
  requester_id: string;
  department_id: string | null;
  total: Money;
  submitted_at: string | null;
  created_at: string;
}
export interface PrLineItem {
  id: string;
  line_no: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price_minor: number;
  line_total_minor: number;
  supplier_id: string | null;
  source: Source | null;
  source_url: string | null;
}
export interface ApprovalDecision {
  step_no: number;
  approver_id: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  decided_at: string;
}
export interface ApprovalTrail {
  instance_id: string;
  current_step: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decisions: ApprovalDecision[];
}
export interface PrDetail extends PrSummary {
  justification: string;
  items: PrLineItem[];
  approval: ApprovalTrail | null;
}
export interface InboxEntry {
  instance_id: string;
  step_no: number;
  waiting_since: string;
  pr: PrSummary;
}
export interface ParsedLineItem {
  source: Exclude<Source, 'manual'>;
  source_url: string;
  description: string;
  unit_price_minor: number;
  currency: string;
  supplier: { name: string; external_ref?: string };
  source_metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------
const BASE          = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/v1';
const TOKEN_KEY     = 'nirva.token';
const REFRESH_KEY   = 'nirva.refresh';

export function setToken(token: string)         { try { localStorage.setItem(TOKEN_KEY, token); } catch {} }
export function setRefreshToken(token: string)  { try { localStorage.setItem(REFRESH_KEY, token); } catch {} }
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); } catch {}
}
function getToken():       string | null { try { return localStorage.getItem(TOKEN_KEY); }   catch { return null; } }
function getRefresh():     string | null { try { return localStorage.getItem(REFRESH_KEY); } catch { return null; } }

// ---------------------------------------------------------------------------
// Refresh handling — a single in-flight refresh is shared by all callers
// ---------------------------------------------------------------------------
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  // We may not have a stored refresh token if the server is the only one
  // holding it (cookie-only flow) — call /auth/refresh either way; the
  // server reads the cookie.
  const refresh_token = getRefresh();

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(refresh_token ? { refresh_token } : {}),
      });
      if (!res.ok) {
        clearToken();
        return null;
      }
      const json = await res.json() as { token: string; refresh_token: string };
      setToken(json.token);
      setRefreshToken(json.refresh_token);
      return json.token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// ---------------------------------------------------------------------------
// Core request
// ---------------------------------------------------------------------------
async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  attempt = 0,
): Promise<T> {
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  // One-shot refresh: if the access token is dead and we have a refresh token,
  // grab a new pair and replay the call. Login/refresh themselves never recurse.
  if (res.status === 401 && attempt === 0 && !path.startsWith('/auth/')) {
    const fresh = await refreshAccessToken();
    if (fresh) return request<T>(method, path, body, attempt + 1);
  }

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const err = (data && typeof data === 'object')
      ? (data as { code?: string; message?: string; details?: unknown })
      : {};
    throw new ApiError(
      res.status,
      err.code ?? `HTTP_${res.status}`,
      err.message ?? `Request failed: ${res.status}`,
      err.details,
    );
  }
  return data as T;
}

/** Unauthenticated request — supplier portal token is the credential. */
async function publicRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'omit',
  });

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const err = (data && typeof data === 'object')
      ? (data as { code?: string; message?: string; details?: unknown })
      : {};
    throw new ApiError(
      res.status,
      err.code ?? `HTTP_${res.status}`,
      err.message ?? `Request failed: ${res.status}`,
      err.details,
    );
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
interface LoginResponse {
  token: string;
  refresh_token: string;
  user: SessionUser;
}
export const auth = {
  login: (email: string, password: string) =>
    request<LoginResponse>('POST', '/auth/login', { email, password }),
  // Body field is optional on the backend — when omitted, the server uses
  // the httpOnly cookie. We still send the body refresh token to support
  // clients on older flows (mobile / curl debugging).
  refresh: (refresh_token?: string) =>
    request<LoginResponse>('POST', '/auth/refresh', refresh_token ? { refresh_token } : {}),
  // Clears the httpOnly cookies server-side. The frontend AuthProvider also
  // wipes localStorage to be safe across the transition.
  logout: () => request<void>('POST', '/auth/logout'),
};

// ---------------------------------------------------------------------------
// PR
// ---------------------------------------------------------------------------
export const pr = {
  list: (params?: { status?: PrStatus; requester_id?: string; cursor?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status)       qs.set('status', params.status);
    if (params?.requester_id) qs.set('requester_id', params.requester_id);
    if (params?.cursor)       qs.set('cursor', params.cursor);
    if (params?.limit)        qs.set('limit', String(params.limit));
    const tail = qs.toString() ? `?${qs}` : '';
    return request<{ data: PrSummary[]; next_cursor: string | null }>('GET', `/pr${tail}`);
  },
  get: (id: string) => request<PrDetail>('GET', `/pr/${id}`),
  create: (body: {
    title: string;
    justification?: string;
    department_id?: string;
    items: {
      description: string;
      quantity: number;
      unit?: string;
      unit_price_minor: number;
      supplier_id?: string;
      source?: Source;
      source_url?: string;
      source_metadata?: Record<string, unknown>;
    }[];
  }) => request<PrSummary>('POST', '/pr', body),
  submit: (id: string) => request<PrDetail>('POST', `/pr/${id}/submit`),
  importLink: (url: string) => request<ParsedLineItem>('POST', '/pr/import-link', { url }),
  receive: (id: string, body: {
    warehouse_id: string;
    lines: { line_item_id: string; item_id: string; quantity: number }[];
    note?: string;
  }) => request<PrDetail>('POST', `/pr/${id}/receive`, body),

  // Comments thread on a PR.
  listComments: (id: string) =>
    request<{ id: string; body: string; created_at: string; author_id: string; author_name: string }[]>(
      'GET', `/pr/${id}/comments`,
    ),
  addComment: (id: string, body: string) =>
    request<{ id: string; body: string; created_at: string; author_id: string; author_name: string }>(
      'POST', `/pr/${id}/comments`, { body },
    ),
};

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------
export const approvals = {
  inbox: () => request<InboxEntry[]>('GET', '/approvals/inbox'),
  decide: (instanceId: string, decision: 'approved' | 'rejected', comment?: string) =>
    request<PrDetail>('POST', `/approvals/${instanceId}/decision`, { decision, comment }),
};

// ---------------------------------------------------------------------------
// NirvaFlow — workflows + steps
// ---------------------------------------------------------------------------
export interface WorkflowStepWire {
  step_no: number;
  approver_kind: 'user' | 'role' | 'manager_of_requester';
  approver_ref: string;
  sla_hours: number | null;
}
export interface WorkflowWire {
  id: string;
  name: string;
  match_rules: Record<string, unknown>;
  is_active: boolean;
  steps: WorkflowStepWire[];
}
export const workflows = {
  list:   () => request<WorkflowWire[]>('GET', '/workflows'),
  create: (body: Omit<WorkflowWire, 'id'>) =>
    request<WorkflowWire>('POST', '/workflows', body),
  update: (id: string, body: Partial<Omit<WorkflowWire, 'id'>>) =>
    request<WorkflowWire>('PATCH', `/workflows/${id}`, body),
  remove: (id: string) =>
    request<{ ok: boolean }>('DELETE', `/workflows/${id}`),
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  created_at: string;
  read_at?: string | null;
  ref_id?: string | null;
}
export const notifications = {
  list: () => request<AppNotification[]>('GET', '/notifications'),
  lineStatus: () => request<{ linked: boolean }>('GET', '/notifications/line/status'),
  markRead: (id: string) => request<void>('PATCH', `/notifications/${id}/read`),
  markAllRead: () => request<void>('PATCH', '/notifications/read-all'),
  lineTest: () => request<{ queued: boolean }>('POST', '/notifications/line/test'),
};

// ---------------------------------------------------------------------------
// NirvaAI
// ---------------------------------------------------------------------------
export interface PriceCompareRequest {
  item_name: string;
  currency: string;
  marketplace_listings: {
    source: 'shopee' | 'lazada' | 'makro' | 'alibaba';
    url: string;
    price_minor: number;
    currency: string;
    supplier_name?: string;
  }[];
  historical_pos: {
    date: string;
    supplier_name: string;
    unit_price_minor: number;
    currency: string;
    source_url?: string;
  }[];
}
export interface PriceCompareResult {
  recommended_choice: {
    source: 'shopee' | 'lazada' | 'makro' | 'alibaba';
    url: string;
    unit_price_minor: number;
    supplier_name: string;
  };
  reasoning: string;
  savings_vs_median_minor: number;
  watch_outs: string[];
}
export const ai = {
  priceCompare: (body: PriceCompareRequest) =>
    request<PriceCompareResult>('POST', '/ai/price-compare', body),
};

// ---------------------------------------------------------------------------
// NirvaFinance — invoice OCR
// ---------------------------------------------------------------------------
export interface OcrLineItem {
  description: string;
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
}
export interface OcrInvoiceResult {
  supplier_name?: string;
  invoice_number?: string;
  date?: string;
  currency: string;
  subtotal_minor?: number;
  tax_minor?: number;
  total_minor: number;
  items: OcrLineItem[];
  warnings: string[];
}
export const finance = {
  ocrInvoice: (image_data_url: string, currency = 'THB') =>
    request<OcrInvoiceResult>('POST', '/finance/invoice/ocr', { image_data_url, currency }),
};

// ---------------------------------------------------------------------------
// NirvaPeople
// ---------------------------------------------------------------------------
export interface PeopleUser {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  department: string | null;
  role: string | null;
}
export interface PeopleDepartment {
  id: string;
  name: string;
  cost_center: string | null;
  members: number;
}
export interface PeopleRole {
  id: string;
  name: string;
  permissions: string[];
}
export const people = {
  listUsers: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<PeopleUser[]>('GET', `/people/users${qs}`);
  },
  createUser: (body: {
    email: string; full_name: string; password: string;
    department_id?: string; role_id?: string;
  }) => request<{ id: string; email: string; full_name: string }>('POST', '/people/users', body),
  setActive: (id: string, is_active: boolean) =>
    request<{ id: string; is_active: boolean }>('PATCH', `/people/users/${id}`, { is_active }),
  listDepartments: () => request<PeopleDepartment[]>('GET', '/people/departments'),
  createDepartment: (body: { name: string; cost_center?: string }) =>
    request<PeopleDepartment>('POST', '/people/departments', body),
  listRoles: () => request<PeopleRole[]>('GET', '/people/roles'),
  /**
   * Persist the user's locale choice on the server. Used by the i18n provider
   * when the dropdown switches languages so server-emitted messages (LINE,
   * email) render in the user's chosen language too.
   */
  setMyLocale: (locale: string) =>
    request<{ id: string; preferred_locale: string }>('PUT', '/people/me/locale', { locale }),
};

// ---------------------------------------------------------------------------
// NirvaStock
// ---------------------------------------------------------------------------
export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string | null;
  is_active: boolean;
}
export interface StockOnHandRow {
  item_id: string;
  sku: string;
  name: string;
  unit: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  qty: number;
  reorder_point: number | null;
  below_reorder: boolean;
}
export type StockMoveType =
  | 'receive' | 'issue' | 'adjust_in' | 'adjust_out'
  | 'transfer_in' | 'transfer_out' | 'opening';

export interface MovementInput {
  item_id: string;
  warehouse_id: string;
  type: StockMoveType;
  qty: number;
  note?: string;
  reference_type?: string;
  reference_id?: string;
}

export const stock = {
  listWarehouses: () => request<Warehouse[]>('GET', '/stock/warehouses'),
  onHand: (warehouseId?: string) => {
    const qs = warehouseId ? `?warehouse_id=${warehouseId}` : '';
    return request<StockOnHandRow[]>('GET', `/stock/on-hand${qs}`);
  },
  recordMovement: (body: MovementInput) =>
    request<{ id: string; created_at: string }>('POST', '/stock/movements', body),
};

// ---------------------------------------------------------------------------
// NirvaGov
// ---------------------------------------------------------------------------
export interface ToRBrief {
  procurement_kind: 'goods' | 'services' | 'construction';
  budget_minor: number;
  currency: string;
  scope: string;
  deliverables: string[];
  qualifications?: string[];
  timeline?: { start?: string; end?: string };
  evaluation_method?: 'lowest_price' | 'most_advantageous';
}
export interface ToRDraft {
  id: string;
  title: string;
  status: 'draft' | 'review' | 'approved' | 'archived';
  body_markdown: string | null;
  compliance_checklist: Record<string, 'passed' | 'failed' | 'na'>;
  created_at: string;
}
export interface ToRListItem {
  id: string;
  title: string;
  procurement_kind: ToRBrief['procurement_kind'];
  status: 'draft' | 'review' | 'approved' | 'published';
  created_at: string;
}
export interface ToRTemplate {
  id: string;
  name: string;
  procurement_kind: ToRBrief['procurement_kind'];
  is_official: boolean;
}
export const gov = {
  list: () => request<ToRListItem[]>('GET', '/gov/tor/drafts'),
  templates: () => request<ToRTemplate[]>('GET', '/gov/tor/templates'),
  createDraft: (body: { title: string; brief: ToRBrief; template_id?: string }) =>
    request<ToRDraft>('POST', '/gov/tor/drafts', body),
  getDraft: (id: string) => request<ToRDraft>('GET', `/gov/tor/drafts/${id}`),
  updateDraft: (id: string, body: { body_markdown: string }) =>
    request<ToRDraft>('PATCH', `/gov/tor/drafts/${id}`, body),
  advanceStatus: (id: string) => request<ToRDraft>('POST', `/gov/tor/drafts/${id}/advance`),
  revertStatus: (id: string) => request<ToRDraft>('POST', `/gov/tor/drafts/${id}/revert`),
};

// ---------------------------------------------------------------------------
// CSV bulk import
// ---------------------------------------------------------------------------
export type ImportKind = 'items' | 'suppliers' | 'departments';
export interface ImportResult {
  kind: ImportKind;
  inserted: number;
  updated:  number;
  failed:   { row: number; reason: string }[];
}
export const importCsv = {
  run: (kind: ImportKind, rows: Record<string, unknown>[]) =>
    request<ImportResult>('POST', '/import/csv', { kind, rows }),
};

// ---------------------------------------------------------------------------
// Supplier portal (public — token in URL)
// ---------------------------------------------------------------------------
export interface PortalLine {
  pr_id: string;
  pr_number: string;
  pr_title: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_minor: number;
  line_total_minor: number;
  status: string;
}
export interface PortalOverview {
  supplier_name: string;
  expires_at: string;
  lines: PortalLine[];
}
export const portal = {
  overview: (token: string) =>
    publicRequest<PortalOverview>('GET', `/portal/${encodeURIComponent(token)}`),
  acknowledge: (token: string, prId: string, note?: string) =>
    publicRequest<{ ok: boolean }>(
      'POST',
      `/portal/${encodeURIComponent(token)}/pr/${encodeURIComponent(prId)}/ack`,
      note ? { note } : {},
    ),
};

// ---------------------------------------------------------------------------
// Supplier portal admin (issue/revoke/list opaque tokens)
// ---------------------------------------------------------------------------
export interface PortalTokenRow {
  id: string;
  supplier_id: string;
  supplier_name: string;
  label: string | null;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}
export const portalAdmin = {
  list: (supplierId?: string) => {
    const qs = supplierId ? `?supplier_id=${supplierId}` : '';
    return request<PortalTokenRow[]>('GET', `/portal-admin/tokens${qs}`);
  },
  issue: (body: { supplier_id: string; label?: string; ttl_days?: number }) =>
    request<{ token: string; expires_at: string }>('POST', '/portal-admin/tokens', body),
  revoke: (id: string) =>
    request<{ revoked: boolean }>('POST', `/portal-admin/tokens/${id}/revoke`),
};

// ---------------------------------------------------------------------------
// Department budgets
// ---------------------------------------------------------------------------
export interface BudgetRow {
  id: string;
  department_id: string;
  department_name: string;
  month_start: string;
  amount_minor: number;
  spent_minor: number;
  remaining_minor: number;
  pct_used: number;
  soft_block: boolean;
}
export const budgets = {
  list: (month?: string) =>
    request<BudgetRow[]>('GET', `/budgets${month ? `?month=${month}` : ''}`),
  upsert: (body: { department_id: string; amount_minor: number; month_start?: string; soft_block?: boolean }) =>
    request<BudgetRow>('POST', '/budgets', body),
};

// ---------------------------------------------------------------------------
// Outbound webhooks (admin)
// ---------------------------------------------------------------------------
export type WebhookEvent =
  | 'pr.submitted' | 'pr.decided' | 'pr.received'
  | 'reorder.alert' | 'anomaly.raised';
export interface WebhookRow {
  id: string;
  url: string;
  events: WebhookEvent[];
  is_active: boolean;
  last_delivered_at: string | null;
  last_status: number | null;
  created_at: string;
}
export interface DeliveryRow {
  id: string;
  event: string;
  status_code: number | null;
  error: string | null;
  attempt: number;
  created_at: string;
}
export const webhooks = {
  list:   () => request<WebhookRow[]>('GET', '/webhooks'),
  // The response carries `secret` exactly once — receiver must record it
  // on first creation; the server never returns it again.
  create: (body: { url: string; events: WebhookEvent[] }) =>
    request<WebhookRow & { secret: string }>('POST', '/webhooks', body),
  remove: (id: string) => request<{ ok: boolean }>('DELETE', `/webhooks/${id}`),
  deliveries: (webhookId: string) =>
    request<DeliveryRow[]>('GET', `/webhooks/${webhookId}/deliveries`),
  replay: (webhookId: string, deliveryId: string) =>
    request<DeliveryRow>('POST', `/webhooks/${webhookId}/deliveries/${deliveryId}/replay`),
};

// ---------------------------------------------------------------------------
// Audit log (read-only)
// ---------------------------------------------------------------------------
export interface AuditRow {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  created_at: string;
  diff: unknown;
}
// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------
export interface SupplierRow {
  id: string;
  code: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  category: string | null;
  tax_id: string | null;
  is_active: boolean;
  risk_tier: 'low' | 'medium' | 'high' | 'critical' | null;
  total_pr_count: number;
  total_spent_minor: number;
  created_at: string;
}
export const suppliers = {
  list: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<SupplierRow[]>('GET', `/suppliers${qs}`);
  },
  get: (id: string) => request<SupplierRow>('GET', `/suppliers/${id}`),
  create: (body: {
    code: string; name: string;
    contact_name?: string; contact_email?: string; contact_phone?: string;
    category?: string; tax_id?: string;
  }) => request<SupplierRow>('POST', '/suppliers', body),
  update: (id: string, body: {
    name?: string; contact_name?: string; contact_email?: string;
    contact_phone?: string; category?: string; tax_id?: string; is_active?: boolean;
  }) => request<SupplierRow>('PATCH', `/suppliers/${id}`, body),
  archive: (id: string) => request<void>('DELETE', `/suppliers/${id}`),
};

// ---------------------------------------------------------------------------
// Purchase Orders (PO)
// ---------------------------------------------------------------------------
export interface PoRow {
  id: string;
  po_number: string;
  pr_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  total_minor: number;
  currency: string;
  notes: string | null;
  issued_by: string;
  issued_at: string | null;
  created_at: string;
}
export const po = {
  list: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return request<PoRow[]>('GET', `/po${qs}`);
  },
  get: (id: string) => request<PoRow>('GET', `/po/${id}`),
  create: (prId: string, supplierId?: string) =>
    request<PoRow>('POST', '/po', { pr_id: prId, supplier_id: supplierId }),
  updateStatus: (id: string, status: string) =>
    request<PoRow>('PATCH', `/po/${id}/status`, { status }),
};

// ---------------------------------------------------------------------------
// Supplier risk scores
// ---------------------------------------------------------------------------
export type RiskTier = 'low' | 'medium' | 'high' | 'critical';
export interface SupplierRiskRow {
  supplier_id:   string;
  supplier_name: string;
  score:         number;
  tier:          RiskTier;
  factors: {
    spend_minor:       number;
    spend_pct:         number;
    price_cov:         number;
    rejection_rate:    number;
    has_coi:           boolean;
    anomaly_count_90d: number;
  };
  computed_at: string;
}
export const supplierRisk = {
  list:    () => request<SupplierRiskRow[]>('GET', '/anomaly/supplier-risks'),
  refresh: () => request<{ computed: number }>('POST', '/anomaly/supplier-risks/refresh'),
};

// ---------------------------------------------------------------------------
// AI cost metering
// ---------------------------------------------------------------------------
export interface AiRun {
  id: string;
  template: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost_usd: string;
  latency_ms: number | null;
  is_stub: boolean;
  created_at: string;
}
export interface AiRunSummary {
  total_cost_usd: number;
  total_tokens:   number;
  calls:          number;
}
export const aiRuns = {
  list: (limit = 100) =>
    request<{ runs: AiRun[]; summary: AiRunSummary }>('GET', `/ai/runs?limit=${limit}`),
};

export const audit = {
  list: (params?: { entity_type?: string; actor_id?: string; cursor?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.entity_type) qs.set('entity_type', params.entity_type);
    if (params?.actor_id)    qs.set('actor_id',   params.actor_id);
    if (params?.cursor)      qs.set('cursor',     params.cursor);
    if (params?.limit)       qs.set('limit',      String(params.limit));
    const tail = qs.toString() ? `?${qs}` : '';
    return request<{ data: AuditRow[]; next_cursor: string | null }>('GET', `/audit/log${tail}`);
  },
};

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export interface AnalyticsSummary {
  month_start: string;
  pr_counts: Record<string, number>;
  approved_spend_minor: number;
  avg_approval_hours: number | null;
  top_suppliers: { name: string; spend_minor: number; po_count: number }[];
  /** `department` is null when the PR has no department assigned — render
   *  a locale-aware fallback label on the frontend rather than relying on
   *  a backend-baked Thai literal. */
  by_department: { department: string | null; spend_minor: number; pr_count: number }[];
}
export interface LeaderboardRow {
  user_id: string;
  full_name: string;
  total_savings_minor: number;
  pr_count: number;
  rank: number;
  badges: string[];
}
export interface SelfSavings {
  savings_minor: number;
  pr_count: number;
  rank: number | null;
}
export const analytics = {
  summary: () => request<AnalyticsSummary>('GET', '/analytics/summary'),
  leaderboard: (limit = 10) =>
    request<LeaderboardRow[]>('GET', `/analytics/savings/leaderboard?limit=${limit}`),
  selfSavings: () => request<SelfSavings>('GET', '/analytics/savings/me'),
};

export const api = {
  auth, pr, approvals, workflows, notifications, ai, finance, people, stock, gov,
  analytics, portal, portalAdmin, importCsv, budgets, webhooks, audit, suppliers, po,
};
export default api;
