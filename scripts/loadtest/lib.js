// Shared helpers for k6 scenarios. ESM in k6 is supported via the standard
// `import` syntax; k6 ships with `http` + `check` as built-ins.

import http  from 'k6/http';
import { check, fail } from 'k6';
import { SharedArray } from 'k6/data';

const BASE  = __ENV.API_BASE ?? 'http://localhost:3000/v1';
// A 5-user seed pool we cycle through. With heavier load we'd parameterize
// the pool size; this is enough to exercise multi-user code paths.
const USERS = new SharedArray('demo users', () => [
  { email: 'suda@nirva.co.th',    password: 'password123' },
  { email: 'por@nirva.co.th',     password: 'password123' },
  { email: 'wipa@nirva.co.th',    password: 'password123' },
  { email: 'somchai@nirva.co.th', password: 'password123' },
  { email: 'jim@nirva.co.th',     password: 'password123' },
]);

/** Pick a random user from the seed pool — round-robin would also work,
 *  but random makes hot-row contention more realistic. */
export function randomUser() {
  return USERS[Math.floor(Math.random() * USERS.length)];
}

/**
 * Log in once and cache the bearer token in `__VU` (per-virtual-user) memory.
 * Subsequent calls reuse the token until it expires (~15 min). We don't
 * benchmark refresh here; that's its own scenario.
 */
const tokenByVU = new Map(); // key: VU id, value: { token, exp }
export function authHeader() {
  const cached = tokenByVU.get(__VU);
  if (cached && Date.now() < cached.exp) return { Authorization: `Bearer ${cached.token}` };

  const u  = randomUser();
  const r  = http.post(`${BASE}/auth/login`,
    JSON.stringify({ email: u.email, password: u.password }),
    { headers: { 'Content-Type': 'application/json' } });
  if (!check(r, { 'login 200': (res) => res.status === 200 })) {
    fail(`login failed: ${r.status} ${r.body}`);
  }
  const body = r.json();
  tokenByVU.set(__VU, {
    token: body.token,
    // 15min - 30s safety margin → re-auth before the cached token actually expires.
    exp:   Date.now() + (15 * 60 * 1000) - 30_000,
  });
  return { Authorization: `Bearer ${body.token}` };
}

export function getJson(path, extraHeaders = {}) {
  return http.get(`${BASE}${path}`, { headers: { ...authHeader(), ...extraHeaders } });
}
export function postJson(path, body, extraHeaders = {}) {
  return http.post(`${BASE}${path}`, JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...extraHeaders },
  });
}

export { BASE };
