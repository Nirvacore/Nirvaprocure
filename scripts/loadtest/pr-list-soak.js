// Sustained read load on /pr list — the most common read in the app.
// Soak test: 10 minutes at steady ~30 RPS. Tests RLS, JWT verify,
// pg pool sizing, and Postgres query plan stability.
//
// Local target: p95 < 150ms, p99 < 400ms, 0% 5xx.
// Pinpointing slowness: enable pg slow query log + look for the order-by
// scan if `purchase_requests` lacks a (org_id, created_at DESC) covering index.
//
// Run:  k6 run scripts/loadtest/pr-list-soak.js

import { check, sleep } from 'k6';
import { getJson } from './lib.js';

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-arrival-rate',
      rate:     30,
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 50,
      maxVUs:    200,
    },
  },
  thresholds: {
    'http_req_duration{name:pr_list}': ['p(95)<150', 'p(99)<400'],
    'http_req_failed{name:pr_list}':   ['rate<0.001'],
  },
};

export default function () {
  const r = getJson('/pr?limit=50', { Tag: 'pr_list' });
  // k6 tags must be set via the http call, not headers; the way we do it
  // here puts the tag on the SAMPLE so the threshold above filters cleanly.
  check(r, {
    'pr list 200': (res) => res.status === 200,
    'has data':    (res) => Array.isArray(res.json('data')),
  });
  // Small jitter so VUs don't synchronize.
  sleep(0.2 + Math.random() * 0.3);
}
