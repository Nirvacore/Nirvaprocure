# NIRVAPROCURE Design System — Principles

> ทำให้คุณป้าวัย 70 ใช้ได้ และเด็ก ม.ต้นใช้ก็ดี

## Core Principles

### 1. Big and obvious

| What | Size | Reason |
|------|------|--------|
| Body text | 18px | The 14–16px web default is too small for older eyes |
| Primary buttons | min-height 60px | Easy to tap on mobile, easy to click with shaky hands |
| Tap targets | min 48×48px | Apple/Google accessibility minimum |
| Icons | 24px+ in body, 32px+ in buttons | Visible without squinting |
| Line height | 1.6+ | Comfortable reading |

### 2. Color is never the only signal

Every state (success, error, pending) uses:
- A **color** (for fast scan)
- An **icon** (for color-blind users)
- A **text label** (for unambiguous meaning)

Example: 🟢 อนุมัติแล้ว — not just a green dot, not just a check mark.

### 3. Plain Thai, no jargon

| Avoid | Prefer |
|-------|--------|
| "ส่งคำขอจัดซื้อ" | "ส่งขออนุมัติ" |
| "Workflow approval pending" | "รอหัวหน้าอนุมัติ" |
| "Requisition #" | "เลขที่ใบขอ" |
| "Submit for review" | "ส่งให้หัวหน้า" |

Use real words people say in chat, not procurement-textbook words.

### 4. One screen, one job

- The PR list shows a list. Don't put approval actions here.
- The create-PR screen has one big input on top — paste-a-link. Manual entry is below it.
- The inbox shows what you must decide. Completed items are visually quieter.

### 5. Forgiving by default

- Every approve/reject shows an **Undo** for 5 seconds before it commits.
- Deleting a draft asks "ลบใบขอนี้ใช่ไหม?" before it happens.
- Empty states explain what to do next, never just "no data".

### 6. Show progress, always

- After tapping a button, the button changes to a spinner state immediately.
- After saving, a checkmark toast confirms.
- During a parse (Shopee URL), show what's happening: "กำลังดึงข้อมูลจาก Shopee..."

## Visual Tokens

### Color (paired with semantic meaning)

```
brand-primary:    #4F46E5   indigo-600  — actions, links
brand-soft:       #EEF2FF   indigo-50   — selected backgrounds

success:          #16A34A   green-600   — approved, complete
success-soft:     #DCFCE7   green-100
warning:          #D97706   amber-600   — waiting, attention
warning-soft:     #FEF3C7   amber-100
danger:           #DC2626   red-600     — rejected, destructive
danger-soft:      #FEE2E2   red-100
neutral-soft:     #F3F4F6   gray-100    — backgrounds
neutral-strong:   #111827   gray-900    — body text (NOT gray-600)
```

**Contrast rule:** Body text is `gray-900` on white. We don't use light gray for content — only for non-essential metadata.

### Typography

- Thai: **Noto Sans Thai** (Google Fonts) — weights 400, 500, 700
- Latin / numbers: **Inter** (Google Fonts) — weights 400, 500, 600, 700

```
display:  28-32px / 700 / 1.2  — page titles
h1:       24px / 700 / 1.3
h2:       20px / 600 / 1.4
body-lg:  18px / 400 / 1.6     — default body
body:     16px / 400 / 1.6     — secondary content
caption:  14px / 500 / 1.4     — metadata only
```

### Spacing

Use a 4px base scale, but in real layouts most things should be 16, 24, or 32px apart.

```
xs: 4px   sm: 8px   md: 16px   lg: 24px   xl: 32px   2xl: 48px
```

Section padding minimum: 24px. Forms get 32px between major fields.

### Shadows and corners

```
shadow-sm:  for cards, very subtle elevation
shadow-md:  for popovers, modal dialogs
shadow-lg:  for the active row/card the user is interacting with

rounded-lg:  12px corners — default for cards, buttons, inputs
rounded-2xl: 16px — for hero containers
rounded-full: pills and avatars only
```

Soft and friendly, never sharp.
