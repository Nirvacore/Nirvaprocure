// Approval spike: 200 approvers hit /approvals/inbox at once (Monday morning
// pattern) and a smaller subset decide. Exercises the SSE-vs-poll path,
// the write-then-read race in ApprovalsService.decide, and the LINE/Webhook
// fan-out for each terminal approval.
//
// Local target: inbox p95 < 250ms; decide p95 < 400ms. No 5xx.
//
// Limitation: this scenario doesn't yet *seed* fresh PRs to approve, so on
// a second run the same instances may already be terminated. CI should
// re-seed before each run (e.g. `psql -f database/seed.sql` in pre-step).
//
// Run:  k6 run scripts/loadtest/approval-spike.js

import { check } from 'k6';
import { getJson, postJson } from './lib.js';

export const options = {
  scenarios: {
    inbox_burst: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit:  '1s',
      preAllocatedVUs: 100,
      maxVUs:    500,
      stages: [
        { duration: '30s', target: 5   },
        { duration: '30s', target: 100 },
        { duration: '2m',  target: 100 },
        { duration: '20s', target: 0   },
      ],
    },
  },
  thresholds: {
    'http_req_duration{name:inbox}':  ['p(95)<250'],
    'http_req_duration{name:decide}': ['p(95)<400'],
    'http_req_failed':                ['rate<0.005'],
  },
};

export default function () {
  const list = getJson('/approvals/inbox', { Tag: 'inbox' });
  check(list, { 'inbox 200': (r) => r.status === 200 });

  const arr = list.json();
  if (!Array.isArray(arr) || arr.length === 0) return;

  // Decide on the first item only — keeps the scenario predictable when
  // the seed pool is small.
  const inst = arr[0]?.instance_id;
  if (!inst) return;
  const r = postJson(`/approvals/${inst}/decision`, { decision: 'approved' }, { Tag: 'decide' });
  // 200 (decided), 403 (not the right approver — happens because we randomize
  // users) and 409 (already finalized) are all acceptable outcomes.
  check(r, { 'decide ok or expected error': (res) => [200, 403, 409].includes(res.status) });
}
