# NIRVAPROCURE Frontend

Next.js 14 (App Router) + TypeScript + Tailwind, sized for elderly + kid usability per the design system.

## Run

```bash
cp .env.example .env.local
npm install
npm run dev
# → http://localhost:3000
```

## Layout

```
frontend/
├── app/
│   ├── layout.tsx           # root layout, loads Noto Sans Thai + Inter, ToastProvider
│   ├── globals.css          # Tailwind + design-system component classes
│   ├── page.tsx             # / — home
│   ├── pr/
│   │   ├── page.tsx         # /pr — list (filter chips + empty state)
│   │   ├── new/page.tsx     # /pr/new — create (Shopee paste mock)
│   │   └── [id]/page.tsx    # /pr/:id — detail (items, justification, trail)
│   ├── approvals/page.tsx   # /approvals — inbox (Undo toasts, urgent badge)
│   ├── settings/page.tsx    # /settings — workflows/users/depts tabs
│   └── line/page.tsx        # /line — phone mockup + Flex Message + notification settings
├── components/
│   ├── Header.tsx
│   ├── MobileNav.tsx
│   ├── NavLink.tsx
│   ├── InboxBadge.tsx
│   ├── StatusPill.tsx
│   └── Toast.tsx            # ToastProvider + useToast() hook (Undo support)
└── lib/
    ├── format.ts            # fmtBaht, fmtRelative
    └── mock-data.ts         # remove once API is wired
```

## Wiring real APIs

Every page currently reads from `lib/mock-data.ts`. To switch to the real backend:

1. Replace `mockPrs`, `mockInbox`, `mockDetailById`, etc. with `fetch()` to the endpoints in `../api/openapi.yaml`
2. Pass `Authorization: Bearer <jwt>` from cookie/localStorage
3. Delete `mock-data.ts` once nothing imports from it

## Design system tokens

Defined in `tailwind.config.ts` and `app/globals.css`. The principles document is at `../design-system/principles.md`. Key constraints:

- 18px base font, 28-32px page titles
- Min 56px (44px sm) tap targets
- Body text is `gray-900`, never light gray
- Status uses color + icon + label together — never color alone
- Thai-first copy in plain language, no procurement jargon

## API wiring

`NEXT_PUBLIC_API_BASE_URL` points at the NestJS backend (see `../backend`). When the JWT auth middleware is in place, store the token via httpOnly cookie or localStorage and attach it as `Authorization: Bearer ...` in fetches.

The full API contract is in `../api/openapi.yaml`.
