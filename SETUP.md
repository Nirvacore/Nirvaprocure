# NirvaProcure — Setup Guide (New Computer)

## What this project is

Thai **corporate/SME** procurement platform. Staff buys from Lazada/Alibaba/suppliers.
Manager approves. Mobile-first. 8 languages.
**Separate from NirvaGov** (NirvaGov = government agencies).

## Clone on new computer

```bash
mkdir -p ~/HQ/02_DEV/nirvaprocure
cd ~/HQ/02_DEV/nirvaprocure
git clone git@github.com:Nirvacore/Nirvaprocure.git NIRVAPROCURE
cd NIRVAPROCURE
```

## SSH key setup (if new machine)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_nirvacore -C "nirvaprocure"
# Add ~/.ssh/id_nirvacore.pub to GitHub → Settings → SSH keys
```

`~/.ssh/config`:
```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_nirvacore
  AddKeysToAgent yes
```

## Install dependencies

```bash
cd frontend && npm install --legacy-peer-deps
cd ../backend && npm install
```

## How to work with Cursor

1. Open `~/HQ/02_DEV/nirvaprocure/NIRVAPROCURE` in Cursor
2. Cursor reads `CLAUDE.md` automatically — scope boundary is defined there
3. GoV module is OUT OF SCOPE — Cursor should not build GoV features here

## How to work with Claude

Open new Claude Code session, say:
> "ต่อ NirvaProcure" — Claude reads memory and picks up where we left off

## Tech stack

- Frontend: Next.js 16, TypeScript, Tailwind v4 — `cd frontend && npm run dev`
- Backend: NestJS 11, Prisma, PostgreSQL — `cd backend && npm run start:dev`
- Mobile: Flutter — `cd mobile && flutter run`
- CI: GitHub Actions (frontend + backend + Flutter)

## Key files

- `CLAUDE.md` — product scope (Cursor reads this every session)
- `frontend/lib/i18n/dictionary.ts` — all translations, 8 locales
- `frontend/lib/api.ts` — all API types and calls
- `frontend/lib/use-resource.ts` — canonical data fetch hook

## PR workflow

Cursor opens DRAFT PRs automatically. To merge:
1. Open github.com/Nirvacore/Nirvaprocure/pulls
2. Click PR → "Ready for review" → "Merge pull request" (green button)

## Claude memory

Claude saves session context at:
`~/.claude/projects/-Users-machd-Claude/memory/`
New machine: these files don't transfer — briefly re-explain context to Claude.
