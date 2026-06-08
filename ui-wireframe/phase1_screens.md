# Phase 1 Wireframe Sketches

ASCII wireframes for the four core Phase 1 screens. Use these as the input brief when producing Figma mockups — they fix the IA, not the visuals.

Sizing assumptions: 1280px desktop primary, mobile breakpoint at 768px (mobile screens will collapse the side nav into a top bar).

---

## 1. PR List

The first screen after login. Mixed-status table with quick filters.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ NIRVAPROCURE     [Search items, suppliers, PR#]              🔔 3   user ▾  │
├────────────┬─────────────────────────────────────────────────────────────────┤
│ ▸ Dashboard│  Purchase Requests                                              │
│ ● Buy      │  ┌──────────────────────────────────────────────────────────┐   │
│   ├ PR     │  │ [+ New PR]   [Import Shopee link]    Status: All     ▾   │   │
│   ├ POs    │  │ Requester: All ▾   Department: All ▾   Date: 30d ▾       │   │
│   └ Supp.  │  └──────────────────────────────────────────────────────────┘   │
│ ○ Approvals│                                                                 │
│   (3)      │  PR#          Title                  Requester    Status   ฿   │
│ ○ Finance  │  ─────────────────────────────────────────────────────────────  │
│ ○ Stock    │  PR-2026-0042 Office printer ink     สุดา จ.       🟡 Wait  3,200│
│ ○ People   │  PR-2026-0041 Lab gloves (Makro)     ปอ น.         🟢 Apvd  1,890│
│            │  PR-2026-0040 Marketing samples      จิ๋ม ส.       🔴 Rej     -- │
│ ─────────  │  PR-2026-0039 Server SSD x2          ปอ น.         ⚫ Draft 8,400│
│ Settings   │  PR-2026-0038 ของกินทีม Q1           สุดา จ.       🟢 Apvd  2,500│
│            │  ...                                                            │
│            │                                              ‹ 1 2 3 ... 12 ›   │
└────────────┴─────────────────────────────────────────────────────────────────┘
```

**Behaviour notes**
- Row click → PR detail (screen 4).
- Status pills use color + label; never color alone (a11y).
- "Import Shopee link" is a shortcut to screen 2 pre-opened in import mode.

---

## 2. Create PR (with marketplace URL paste)

The hero affordance: a single big input at the top where the user pastes a Shopee/Lazada URL. The line item below it auto-fills.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ‹ Back to PR list                                                            │
│                                                                              │
│  New Purchase Request                                            [Save Draft]│
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │ 🔗 Paste marketplace URL  [https://shopee.co.th/...   ] [Parse]      │    │
│  │     Supports: Shopee, Lazada, Alibaba, Makro                         │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Title*       [Office printer ink x4                                       ] │
│  Department   [Finance & Admin                                          ▾] │
│  Justification[Replenish ink for the floor 5 printers, current cartridge..]│
│                                                                              │
│  ── Line items ──────────────────────────────────────────────────────────── │
│  #  Description                          Qty   Unit   Price/u   Total       │
│  ─  ─────────────────────────────────── ───  ─────  ────────  ──────────    │
│  1  HP 65A Black Toner Cartridge          4   ea     1,890.00  7,560.00     │
│     🛒 Shopee · HP Authorized Store · view                  [×] Remove      │
│                                                                              │
│  2  [+ Add line item manually]                                              │
│                                                                              │
│                                              Subtotal:           7,560.00 ฿ │
│                                              Estimated tax:        529.20 ฿ │
│                                              ─────────────────────────────  │
│                                              Total:              8,089.20 ฿ │
│                                                                              │
│                                              [Save Draft]  [Submit ▸]       │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Behaviour notes**
- Parse calls `POST /pr/import-link`; the parsed item appends to the items table with provenance badge ("🛒 Shopee · <shop>").
- Failed parse shows an inline banner above the input, never blocks manual entry.
- "Submit ▸" is disabled until title, department, and ≥1 line item are present.
- Total tax is informational only in Phase 1; final tax is computed in NirvaFinance after invoice OCR (Phase 2).

---

## 3. Approval Inbox

The screen approvers live in. Optimized for speed: keyboard shortcuts and bulk-decision are deferred to Phase 2, but the layout should anticipate them.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Approvals — Waiting for me (3)                          Filter: All ▾        │
│                                                                              │
│  Waiting on you:                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ PR-2026-0042  Office printer ink x4              สุดา จ.   Today 10:21 │  │
│  │ Finance & Admin · 8,089 ฿ · 1 item · Shopee                            │  │
│  │ Justification: Replenish ink for the floor 5 printers...               │  │
│  │ Approval step 1 of 1   ↳ you                                            │  │
│  │                                                                        │  │
│  │ [✓ Approve]   [✗ Reject]   [View detail]                                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ PR-2026-0037  Sample products for Q2 campaign    จิ๋ม ส.    Yesterday  │  │
│  │ Marketing · 24,500 ฿ · 6 items · Lazada                                │  │
│  │ ...                                          [✓]  [✗]   [View]         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ PR-2026-0036  Server SSD x2                      ปอ น.       3 days   │  │
│  │ IT · 8,400 ฿ · 2 items · Manual                                        │  │
│  │ ⚠ Waiting >48h           ...               [✓]  [✗]   [View]           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ─── Completed (last 7 days) ────────────────────────────────────────────── │
│  PR-2026-0041 Lab gloves          🟢 Approved   ปอ น.       Yesterday       │
│  PR-2026-0040 Marketing samples   🔴 Rejected   จิ๋ม ส.     2 days           │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Behaviour notes**
- Each card is enough information to decide without opening detail in 80% of cases.
- "Waiting >48h" badge surfaces SLA breaches — drives the urgency-but-not-panic colour.
- Approving inline triggers a confirmation toast with Undo for 5 seconds (mistakes happen, especially on mobile).

---

## 4. PR Detail

Read-only view with full history. Shown after clicking a PR row or "View detail" from inbox.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ‹ Back                                                                       │
│                                                                              │
│  PR-2026-0042   Office printer ink x4              🟡 In approval (step 1/1) │
│  Requested by สุดา จ. · Finance & Admin · Today 10:21                        │
│                                                                              │
│  ── Items ───────────────────────────────────────────────────────────────── │
│  #  Description                       Qty   Unit  Price/u    Total           │
│  1  HP 65A Black Toner Cartridge       4    ea    1,890.00   7,560.00        │
│     🛒 Shopee · HP Authorized Store · view original                          │
│                                                                              │
│                                    Subtotal:                     7,560.00 ฿ │
│                                    Est. tax:                       529.20 ฿ │
│                                    Total:                        8,089.20 ฿ │
│                                                                              │
│  ── Justification ──────────────────────────────────────────────────────── │
│  Replenish ink for the floor 5 printers, current cartridge is on its last  │
│  hundred pages and Finance needs to print Q1 statements next week.         │
│                                                                              │
│  ── Approval trail ─────────────────────────────────────────────────────── │
│  ● Submitted              สุดา จ.            Today 10:21                    │
│  ◌ Step 1 — pending       ปอ น. (manager)   waiting                         │
│                                                                              │
│  ── Audit log ──────────────────────────────────────────────────────────── │
│  10:21  สุดา จ. created PR                                                  │
│  10:22  สุดา จ. submitted PR for approval                                   │
│  10:22  System: notification queued → LINE (ปอ น.)                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Behaviour notes**
- If the caller is the current-step approver, the Approve/Reject buttons from screen 3 also render here.
- "view original" opens the cleaned canonical Shopee URL (no tracking params).
- Audit log is the same data as the immutable `audit_log` table — filtered to PR-relevant actions.

---

## Out of scope for Phase 1 wireframes

- Settings (workflow builder, users & roles) — text-only spec in [02_System_Architecture.md](../02_System_Architecture.md) is enough for the first build.
- Mobile-specific layouts (Phase 3 along with Flutter app).
- Suppliers screen (deferred until Phase 2 when supplier catalog matters).
