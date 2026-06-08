# 04 — MVP Roadmap

## Phase 1 — Procurement Foundation

**Goal:** Replace the spreadsheet-and-LINE-chat procurement workflow that most Thai SMEs use today.

- Procurement requests (PR) with line items and attachments
- Approval workflow (configurable by amount and department)
- Shopee link import — paste a product URL, auto-extract item, price, supplier
- LINE notifications for approval requests and status changes
- Basic user/role management
- Web app (Next.js) only — no mobile yet

**Success signal:** A pilot SME submits, approves, and tracks 100% of monthly purchases through the system instead of LINE chat.

## Phase 2 — AI and Accounting

**Goal:** Make the procurement layer measurably smarter and connect to finance.

- AI price-compare engine (Shopee vs. Lazada vs. historical POs)
- OCR invoice processing with line-item extraction
- Accounting sync (export to FlowAccount or Peak)
- Supplier catalog and quotation history
- Basic spending dashboards

**Success signal:** AI suggestions actually change buyer behavior — measurable savings vs. baseline.

## Phase 3 — Full Ecosystem

**Goal:** Become the procurement OS for mid-market and enterprise.

- Multi-marketplace integration (Lazada, Alibaba, Makro added to Shopee)
- Government TOR automation (NirvaGov)
- Full ERP ecosystem: NirvaFinance, NirvaStock, NirvaPeople
- Mobile app (Flutter)
- Multi-entity consolidation
- Advanced AI: fraud detection, supplier risk scoring, forecasting

**Success signal:** First enterprise customer with multi-entity rollout; government-supplier customers using TOR module.

## Sequencing Notes

- Phase 1 must ship before Phase 2 features start — resist the urge to build AI before the procurement workflow is real.
- LINE notifications are a Phase 1 must, not a nice-to-have, in Thailand.
- Shopee comes first among marketplaces (largest SME-relevant catalog and most accessible API/scraping path).
