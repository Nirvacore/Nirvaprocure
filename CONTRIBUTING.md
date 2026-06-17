# Contributing to NirvaProcure

> **สถานะ: กำลังรวมเข้า NirvaCore**
> Repo นี้จะค่อยๆ ถูกดูดรวมเข้า [nirvacore-v1](https://github.com/Nirvacore/nirvacore-v1)
> Feature ใหม่ทั้งหมด **ให้เขียนใน NirvaCore** ไม่ต้องเพิ่มที่นี่แล้ว

---

## Tech Stack (repo นี้)

```
Backend:    TypeScript · NestJS 10 · Raw PostgreSQL (pg driver) · RLS
Frontend:   TypeScript · Next.js 14 · TailwindCSS
Mobile:     Flutter 3.22
Database:   PostgreSQL 16 with Row Level Security
Auth:       JWT + 2FA + LINE OAuth
```

**ข้อแตกต่างจาก NirvaCore**:
- ใช้ **raw SQL** ไม่ใช่ Prisma
- Multi-tenant ผ่าน **RLS** (`SET LOCAL app.current_org`)
- Schema อยู่ใน SQL migration files (`backend/sql/phase*.sql`)

---

## Module ที่ย้ายเข้า NirvaCore แล้ว

| Module เดิม | อยู่ที่ NirvaCore |
|-------------|-------------------|
| PR (Purchase Request) | `purchase-requests/` |
| PO (Purchase Order) | `purchasing/` |
| Vendors/Suppliers | `vendors/` |
| Budget | `budgeting/` |
| Anomaly Detection | `procurement/anomaly.service.ts` |
| Supplier Risk Scoring | `procurement/supplier-risk.service.ts` |
| Bulk Import | `procurement/bulk-import.service.ts` |
| Supplier Portal | `supplier-portal/` |

## Module ที่รอย้าย

| Module | ความซับซ้อน | หมายเหตุ |
|--------|------------|----------|
| Invoice OCR | สูง | ใช้ external OCR API |
| Government ToR | กลาง | Thai gov procurement rules |
| Marketplace (Shopee/Lazada) | สูง | API integrations |
| Approval SSE Streaming | กลาง | Real-time push |
| LINE Bot Approvals | กลาง | LINE Messaging API |

---

## วิธีย้าย Module เข้า NirvaCore

1. **อ่าน SQL** — ดู raw SQL queries ใน service file
2. **สร้าง Prisma model** — แปลง SQL table → model ใน `schema.prisma`
3. **เขียน NestJS service** — แปลง raw SQL → Prisma queries
4. **เปลี่ยน `withOrg(pool, orgId, cb)`** → `where: { companyId }`
5. **สร้าง controller + module** ตาม pattern ใน NirvaCore CONTRIBUTING.md
6. **เขียน test** — mock PrismaService
7. **ลงใน app.module.ts** ของ NirvaCore

### ตัวอย่างการแปลง

**NirvaProcure (raw SQL)**:
```typescript
const result = await withOrg(pool, orgId, async (client) => {
  return client.query(
    'SELECT * FROM vendors WHERE is_active = true ORDER BY name',
  );
});
```

**NirvaCore (Prisma)**:
```typescript
return this.prisma.vendor.findMany({
  where: { companyId, isActive: true },
  orderBy: { name: 'asc' },
});
```

---

## ไม่ต้องเพิ่ม Feature ใหม่ที่ repo นี้

Feature ใหม่ทั้งหมดเขียนใน **nirvacore-v1** ดู CONTRIBUTING.md ที่นั่น
