## Summary
<!-- 1-3 bullet points: what changed and why -->

-

## Type
- [ ] Feature
- [ ] Bug fix
- [ ] Refactor / cleanup
- [ ] CI / infra
- [ ] Docs

## Surfaces changed
- [ ] Backend (NestJS)
- [ ] Frontend (Next.js)
- [ ] Mobile (Flutter)
- [ ] Database (SQL schema)
- [ ] i18n dictionary

## Checklist
- [ ] `cd frontend && npx tsc --noEmit` passes
- [ ] `cd backend  && npx tsc --noEmit` passes
- [ ] If i18n keys added: parity verified (319 keys × 8 locales)
- [ ] No `Colors.grey.shade*`, `withOpacity`, or raw `Colors.white` in card backgrounds
- [ ] New `.env` values documented in `.env.example`
- [ ] If schema changed: new migration file in `database/`

## Test plan
<!-- How did you verify this? Screenshots, curl output, flutter screenshot, etc. -->
