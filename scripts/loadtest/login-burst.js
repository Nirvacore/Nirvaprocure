// Burst-login scenario: simulates the morning rush when everyone logs in
// at 09:00 Asia/Bangkok. Hits /auth/login concurrently; this is the route
// that's THROTTLED hardest in the backend (5 / 15min per IP), so when we
// run this against shared infra we expect a wave of 429s near the cap.
//
// Local target (single Postgres): handle 50 RPS at p95 < 200ms with no
// 5xx and the only 4xx being expected throttler 429s.
//
// Run:  k6 run scripts/loadtest/login-burst.js
//       API_BASE=https://api.nirvaprocure.com/v1 k6 run scripts/loadtest/login-burst.js

import { check } from 'k6';
import { randomUser, BASE } from './lib.js';
import http from 'k6/http';

export const options = {
  scenarios: {
    burst: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit:  '1s',
      preAllocatedVUs: 50,
      maxVUs:    200,
      stages: [
        { duration: '30s', target: 5  },   // warm
        { duration: '30s', target: 50 },   // ramp
        { duration: '1m',  target: 50 },   // hold
        { duration: '20s', target: 0  },
      ],
    },
  },
  thresholds: {
    'http_req_duration{status:200}': ['p(95)<200'],
    // 5xx must stay under 1%. 4xx (throttler 429) is expected at the cap.
    'http_req_failed{status:5xx}': [{ threshold: 'rate<0.01', abortOnFail: true }],
  },
};

export default function () {
  const u = randomUser();
  const r = http.post(`${BASE}/auth/login`,
    JSON.stringify({ email: u.email, password: u.password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_login' } });
  check(r, {
    'status is 200 or 429': (res) => res.status === 200 || res.status === 429,
  });
}
