# 03 — Features and Modules

## Core Modules

### NirvaBuy — Procurement
- Purchase requests (PR) with line items, attachments, and budget tagging
- Marketplace link import (Shopee/Lazada/Alibaba/Makro) — paste URL, auto-extract item, price, supplier
- Supplier catalog with quotation history
- Purchase orders, receiving, three-way matching
- Contract repository with renewal alerts

### NirvaFlow — Workflow Engine
- Configurable approval chains by amount, category, department, and entity
- Parallel and sequential approval branches
- Delegation and out-of-office handoff
- ISO-compliant audit trail per step
- SLA timers and escalation rules

### NirvaAI — AI Procurement Intelligence
- AI price comparison across marketplaces and historical POs
- Supplier risk scoring (financial, delivery, compliance signals)
- Fraud detection on requisitions and invoices
- Spending anomaly alerts (per-category, per-supplier, per-requester)
- Forecasting and reorder recommendations
- OCR invoice processing with line-item extraction

### NirvaFinance — Accounting & Invoice
- Invoice intake (manual, email, OCR)
- AP/AR ledger
- Tax handling (Thai VAT, withholding tax)
- Bank reconciliation
- Export to Thai accounting software (Express, Peak, FlowAccount)

### NirvaStock — Inventory
- Multi-warehouse stock tracking
- Stock movements tied to POs and sales
- Reorder point automation (informed by NirvaAI forecasts)
- Cycle counts and stock take

### NirvaGov — Government TOR Automation
- TOR template library (Thai government formats)
- Bid document generation
- Compliance checklist
- Vendor qualification workflow

### NirvaPeople — HR & Permissions
- User and department management
- Role-based access control
- Approval authority matrix
- Cost-center assignment

## AI Features (consolidated)

- AI price comparison
- Supplier risk scoring
- Fraud detection
- Spending anomaly alerts
- Forecasting and reorder recommendations
- OCR invoice processing
