# NIRVAPROCURE

AI Procurement Operating System for Thailand & ASEAN.

A unified platform combining marketplace integration, ERP workflow, AI procurement intelligence, and enterprise operations. Built for SMEs through enterprise organizations.

## Quick start

```bash
docker compose up --build
# → web:     http://localhost:3001
# → api:     http://localhost:3000/v1
# → health:  http://localhost:3000/v1/health
# → db:      postgres://nirva:nirva@localhost:5432/nirvaprocure (seeded)
```

Dev login (anyone @nirva.co.th): password `password123`.

Without Docker:

```bash
# 1. Postgres (any 14+); then apply schema & seed
psql $DATABASE_URL -f database/phase1_schema.sql
psql $DATABASE_URL -f database/seed.sql

# 2. Backend
cd backend && cp .env.example .env && npm install && npm run start:dev

# 3. Frontend (new shell)
cd frontend && cp .env.example .env.local && npm install && npm run dev
```

## Documents

- [01 — Vision Overview](01_Vision_Overview.md)
- [02 — System Architecture](02_System_Architecture.md)
- [03 — Features and Modules](03_Features_and_Modules.md)
- [04 — MVP Roadmap](04_MVP_Roadmap.md)
- [05 — Tech Stack and AI](05_Tech_Stack_and_AI.md)

## Folders

- `ui-wireframe/` — UI wireframes and design mockups
- `api/` — API specifications and contracts
- `database/` — Schema design and ER diagrams
- `prompts/` — LLM prompt templates for NirvaAI

## Source

Scaffolded from `NIRVAPROCURE_Concept_Document.docx`.
