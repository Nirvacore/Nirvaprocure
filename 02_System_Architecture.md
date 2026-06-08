# 02 — System Architecture

## High-Level Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     Clients                                 │
│   Next.js Web App   │   Flutter Mobile   │   LINE OA Bot    │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│                 API Gateway (NestJS)                        │
│        REST + GraphQL  │  Auth (JWT)  │  Rate Limit         │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│                  Domain Services                            │
│  NirvaBuy │ NirvaFlow │ NirvaAI │ NirvaFinance │ NirvaStock │
│           │           │         │              │            │
│  NirvaGov │ NirvaPeople                                     │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│        Integration Layer                                    │
│  Shopee │ Lazada │ Alibaba │ Makro │ LINE │ Accounting APIs │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│  PostgreSQL  │  Object Storage (S3)  │  Vector DB (AI)      │
└─────────────────────────────────────────────────────────────┘
```

## Module Boundaries

Each Nirva* module is a bounded context with its own data ownership:

| Module        | Owns                                          | Consumes from              |
|---------------|-----------------------------------------------|----------------------------|
| NirvaBuy      | PRs, POs, supplier catalog                    | NirvaFlow (approvals)      |
| NirvaFlow     | Workflow definitions, approval state          | NirvaPeople (roles)        |
| NirvaAI       | Embeddings, comparisons, anomaly models       | NirvaBuy, NirvaFinance     |
| NirvaFinance  | Invoices, payments, ledger entries            | NirvaBuy (POs)             |
| NirvaStock    | Inventory, stock movements, reorder points    | NirvaBuy, NirvaFinance     |
| NirvaGov      | TOR templates, bid documents                  | NirvaBuy, NirvaFlow        |
| NirvaPeople   | Users, roles, permissions, departments        | (foundational)             |

## Cross-Cutting Concerns

- **Auth** — JWT + role-based access control owned by NirvaPeople.
- **Audit log** — immutable event log per entity; required for ISO and government workflows.
- **Notifications** — LINE OA, email, and in-app; routed through a single notification service.
- **AI gateway** — single service brokers requests to OpenAI and Claude, handles prompt templates, caching, and cost attribution.
- **Multi-tenancy** — every table carries `org_id`; row-level security in PostgreSQL.
