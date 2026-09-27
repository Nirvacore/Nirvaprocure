const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
const phaseOne = readFileSync(path.join(root, 'database/phase1_schema.sql'), 'utf8');

test('CI uses the same Node major as the production images', () => {
  const nodeVersions = [...workflow.matchAll(/node-version:\s*['"]?(\d+)['"]?/g)].map((match) => match[1]);
  assert.ok(nodeVersions.length >= 2);
  assert.deepEqual([...new Set(nodeVersions)], ['26']);
});

test('schema application stops on the first PostgreSQL error without eval', () => {
  assert.match(workflow, /psql[^\n]*-v\s+ON_ERROR_STOP=1/);
  assert.doesNotMatch(workflow, /\beval\b/);
});

test('citext exists before the first CITEXT column is declared', () => {
  const extension = phaseOne.indexOf('CREATE EXTENSION IF NOT EXISTS citext;');
  const firstColumn = phaseOne.indexOf('CITEXT NOT NULL');
  assert.ok(extension >= 0 && firstColumn >= 0 && extension < firstColumn);
});
