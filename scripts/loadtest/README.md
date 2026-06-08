# Load Tests (k6)

Three scenarios that exercise the most-trafficked paths:

| File | What it stresses | Target |
|---|---|---|
| `login-burst.js`  | `/auth/login` throttler, bcrypt, JWT signing | 50 RPS, p95<200ms, only 4xx is expected 429 |
| `pr-list-soak.js` | `/pr` list reads, RLS, pg pool, JWT verify   | 30 RPS for 10 min, p95<150ms, 5xx ~0%       |
| `approval-spike.js` | `/approvals/inbox` + `/decide` write race    | 100 VUs burst, p95<400ms for decide        |

## Install

```bash
brew install k6           # or https://k6.io/docs/getting-started/installation/
```

## Run

```bash
# Against local docker-compose stack
k6 run scripts/loadtest/login-burst.js
k6 run scripts/loadtest/pr-list-soak.js
k6 run scripts/loadtest/approval-spike.js

# Against a real deploy
API_BASE=https://api.nirvaprocure.com/v1 \
  k6 run scripts/loadtest/pr-list-soak.js

# Output Prometheus metrics
k6 run --out experimental-prometheus-rw scripts/loadtest/pr-list-soak.js
```

## What to look for

- **p95 latency creeping** during the soak — usually pg query plan flipping
  to a seq scan. Fix with `EXPLAIN ANALYZE` + index.
- **5xx during the spike** — almost always the JWT verify pool exhausting
  or pg connection saturation. Tune `pg.Pool({ max })` and the throttler.
- **429s on `/auth/login`** are EXPECTED — they prove the throttler works.

## Limits / TODO

- `approval-spike.js` doesn't reseed PRs; CI should run `psql -f seed.sql`
  before each run (or factor in seeding to the test itself).
- We don't yet measure SSE connection throughput. That needs `k6 ws` with a
  custom EventSource-like client. Phase 6.
- No webhook receive-side load — production should run a counter receiver
  alongside to validate fan-out latency.
