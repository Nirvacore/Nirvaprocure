# NirvaProcure — Product Scope & Dev Rules

## What this product IS

**Corporate / SME procurement platform for Thai businesses.**

Thai company managers approve team purchase requests. Staff submits items
they need → manager approves → company buys from any supplier (Lazada,
Alibaba, local vendors). Simple, mobile-first, 8 languages.

Target users: Private company employees and their managers.
NOT government officers. NOT public sector.

## What this product is NOT

- ❌ Government procurement system (no TOR, no พรบ.จัดซื้อ, no tender/bidding)
- ❌ E-commerce marketplace
- ❌ ERP / accounting system
- ❌ Inventory management for warehouses
- ❌ Construction / project management

## In-scope features (build these)

- Purchase Request (PR) → Approval → Purchase Order (PO) workflow
- Supplier directory with risk tiers
- Budget tracking per department
- Goods receive / stock update
- Notifications (LINE, email)
- Audit log
- Multi-language (th/en/zh/ja/vi/id/my/km)
- Mobile app (Flutter)

## Out-of-scope (DO NOT build)

- `/gov` routes or any GoV module → belongs in a separate project (NirvaGov)
- ToR / Terms of Reference documents
- Government tender workflows
- Portal for public bidders
- Any feature that references พรบ.จัดซื้อ or Thai government procurement law

## Dev rules

### Data fetching (MUST follow)
```typescript
const { data, loading, error, refresh } = useResource(
  () => withMockFallback(() => api.xxx(), MOCK_DATA),
  [deps],
);
```
Import from `@/lib/use-resource` and `@/lib/api-with-fallback`.
NEVER use useState+useEffect+try/catch manually for data fetching.
EXCEPTION: cursor-paginated "load more" with append semantics.

### i18n
All user-facing strings must exist in ALL 8 locales in `frontend/lib/i18n/dictionary.ts`.
TypeScript compile enforces parity — zero tolerance for missing keys.

### TypeScript
Run `npx tsc --noEmit` before every PR. Zero errors required.

### Pattern for new pages
Copy the pattern from `frontend/app/suppliers/page.tsx` — it is the canonical example.

## Repo structure
- `frontend/` — Next.js 16 web app
- `backend/` — NestJS 11 API
- `mobile/` — Flutter app
- `database/` — Prisma schema + migrations
