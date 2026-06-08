# 05 — Tech Stack and AI

## Stack

| Layer       | Choice                  | Notes                                                       |
|-------------|-------------------------|-------------------------------------------------------------|
| Frontend    | Next.js (App Router)    | Server components for dashboards, client for forms          |
| Backend     | Node.js / NestJS        | Modular monolith aligned with the Nirva* module boundaries  |
| Mobile      | Flutter                 | Single codebase for iOS and Android — Phase 3               |
| Database    | PostgreSQL              | Row-level security for multi-tenancy; `pgvector` for AI     |
| Hosting     | Vercel (frontend) + AWS | AWS for backend (ECS/Fargate), RDS, S3, SQS                 |
| AI          | OpenAI + Claude         | Dual-provider; route by task type and cost                  |

## AI Provider Strategy

- **Claude** — long-context reasoning (contract review, TOR generation, multi-document analysis)
- **OpenAI** — embeddings, vision/OCR for invoices, cheaper bulk classification

Both routed through an internal AI gateway service that handles:
- Prompt templating (templates live in `prompts/`)
- Prompt caching for repeated context
- Cost attribution per org and per feature
- Fallback between providers on rate limits

## Integration Targets

- **Marketplaces** — Shopee, Lazada, Alibaba, Makro (link parsing first, official API where available)
- **Messaging** — LINE Official Account API (notifications, approval-by-reply)
- **Accounting** — FlowAccount, Peak, Express
- **Identity** — email/password initially; SSO (Google, Microsoft) for enterprise

## Build vs. Buy

- **Build** — procurement workflow, AI gateway, marketplace adapters (these are the product)
- **Buy/integrate** — accounting (Thai-localized), email, telephony, payments
