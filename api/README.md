# API

OpenAPI specs and route documentation per module.

## Suggested layout

```
api/
├── openapi.yaml             # Top-level merged spec
├── nirvabuy/
│   └── routes.md
├── nirvaflow/
│   └── routes.md
├── nirvaai/
│   └── routes.md
├── nirvafinance/
│   └── routes.md
├── nirvastock/
│   └── routes.md
├── nirvagov/
│   └── routes.md
└── nirvapeople/
    └── routes.md
```

## Phase 1 priority endpoints

- `POST /pr` — create purchase request
- `POST /pr/import-link` — parse a marketplace URL into a PR draft
- `POST /pr/:id/submit` — submit for approval
- `POST /approvals/:id/decision` — approve / reject
- `GET  /pr` — list with filters
- `POST /notifications/line/test` — verify LINE OA wiring
