const assert = require('node:assert/strict');
const { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
const phaseOne = readFileSync(path.join(root, 'database/phase1_schema.sql'), 'utf8');
const phaseFiveIncentives = readFileSync(path.join(root, 'database/phase5_incentives_schema.sql'), 'utf8');
const schemaRunnerPath = path.join(root, 'scripts/ci/apply-test-schemas.sh');
const schemaRunner = readFileSync(schemaRunnerPath, 'utf8');

test('CI uses the same Node major as the production images', () => {
  const nodeVersions = [...workflow.matchAll(/node-version:\s*['"]?(\d+)['"]?/g)].map((match) => match[1]);
  const imageVersions = ['frontend', 'backend'].map((app) => {
    const dockerfile = readFileSync(path.join(root, app, 'Dockerfile'), 'utf8');
    return dockerfile.match(/^FROM node:(\d+)-/m)?.[1];
  });
  assert.ok(nodeVersions.length >= 2);
  assert.deepEqual([...new Set(nodeVersions)], [...new Set(imageVersions)]);
});

test('schema runner lists every SQL file once and keeps seed last', () => {
  const listed = [...schemaRunner.matchAll(/^\s{2}([a-z0-9_]+\.sql)$/gm)].map((match) => match[1]);
  const files = readdirSync(path.join(root, 'database')).filter((file) => file.endsWith('.sql'));
  assert.equal(new Set(listed).size, listed.length);
  assert.deepEqual([...listed].sort(), [...files].sort());
  assert.equal(listed.at(-1), 'seed.sql');
});

test('schema runner stops immediately when PostgreSQL rejects a file', () => {
  const fakeBin = mkdtempSync(path.join(tmpdir(), 'nirvaprocure-psql-'));
  const calls = path.join(fakeBin, 'calls');
  const fakePsql = path.join(fakeBin, 'psql');
  writeFileSync(fakePsql, '#!/usr/bin/env bash\necho "$*" >> "$FAKE_CALLS"\n[[ "$*" != *phase2_stock_schema.sql* ]]\n');
  chmodSync(fakePsql, 0o755);

  try {
    const result = spawnSync(schemaRunnerPath, [], {
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        FAKE_CALLS: calls,
        PGHOST: 'localhost',
        PGUSER: 'nirva',
        PGPASSWORD: 'test-only',
        PGDATABASE: 'nirvaprocure_test',
      },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    const invoked = readFileSync(calls, 'utf8').trim().split('\n');
    assert.equal(invoked.length, 2);
    assert.match(invoked[0], /-X -v ON_ERROR_STOP=1/);
    assert.match(invoked[1], /phase2_stock_schema\.sql/);
  } finally {
    rmSync(fakeBin, { recursive: true, force: true });
  }
});

test('citext exists before the first CITEXT column is declared', () => {
  const extension = phaseOne.indexOf('CREATE EXTENSION IF NOT EXISTS citext;');
  const firstColumn = phaseOne.indexOf('CITEXT NOT NULL');
  assert.ok(extension >= 0 && firstColumn >= 0 && extension < firstColumn);
});

test('child approval tables inherit tenant scope through their parent rows', () => {
  assert.doesNotMatch(phaseOne, /'approval_steps'|'approval_decisions'/);
  assert.match(phaseOne, /CREATE POLICY approval_steps_org_isolation[\s\S]*approval_workflows[\s\S]*current_setting\('app\.current_org'\)/);
  assert.match(phaseOne, /CREATE POLICY approval_decisions_org_isolation[\s\S]*approval_instances[\s\S]*current_setting\('app\.current_org'\)/);
});

test('badge period uniqueness uses a PostgreSQL expression index', () => {
  assert.doesNotMatch(phaseFiveIncentives, /UNIQUE\s*\([^)]*context\s*->>/);
  assert.match(
    phaseFiveIncentives,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_user_badges_period\s+ON user_badges\s*\(user_id, badge_key, \(context->>'period'\)\)/,
  );
});
