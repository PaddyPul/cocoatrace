import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPilotEvidence, validateCapabilities } from './pilot-evidence.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sample = () => ({
  version: 1,
  reviewedAt: '2026-10-17',
  scope: 'Repository only',
  capabilities: [
    {
      id: 'trade',
      title: 'Trade',
      status: 'current',
      backlog: ['TRD-001'],
      evidence: ['api/source.ts'],
      limits: 'Local acceptance only',
    },
  ],
});
test('rejects current claims without completed backlog acceptance', () => {
  const data = sample();
  assert.throws(
    () => validateCapabilities(data, new Map([['TRD-001', 'partial']]), () => true),
    /unfinished/,
  );
  data.capabilities[0].status = 'partial';
  validateCapabilities(data, new Map([['TRD-001', 'partial']]), () => true);
  assert.throws(
    () => validateCapabilities(data, new Map([['TRD-001', 'complete']]), () => true),
    /requires review/,
  );
});
test('rejects missing evidence, path traversal, unknown IDs and ambiguous claims', () => {
  for (const change of [
    (d) => d.capabilities.push(d.capabilities[0]),
    (d) => (d.capabilities[0].backlog = ['UNKNOWN']),
    (d) => (d.capabilities[0].evidence = ['api/../../secret']),
    (d) => (d.capabilities[0].title = 'Claim | hidden'),
    (d) => (d.capabilities[0].limits = ''),
  ]) {
    const data = sample();
    change(data);
    assert.throws(() => validateCapabilities(data, new Map([['TRD-001', 'complete']]), () => true));
  }
  assert.throws(
    () => validateCapabilities(sample(), new Map([['TRD-001', 'complete']]), () => false),
    /Missing/,
  );
});
test('generated matrix accepts Git CRLF but rejects stale output and broken overview links', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'bettertrade-evidence-'));
  try {
    const data = JSON.parse(
      fs.readFileSync(path.join(root, 'docs/investor/capabilities.json'), 'utf8'),
    );
    const overview = fs.readFileSync(
      path.join(root, 'docs/investor/ARCHITECTURE_SECURITY_OVERVIEW.md'),
      'utf8',
    );
    const files = new Set([
      'docs/DELIVERY_BACKLOG.md',
      'docs/runbooks/FREE_STAGING_PLAN.md',
      'docs/investor/capabilities.json',
      'docs/investor/ARCHITECTURE_SECURITY_OVERVIEW.md',
      ...data.capabilities.flatMap((row) => row.evidence),
      ...[...overview.matchAll(/\]\(([^)]+)\)/g)].map(([, href]) =>
        path.relative(root, path.resolve(root, 'docs/investor', href)),
      ),
    ]);
    for (const file of files) {
      const target = path.join(fixture, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(root, file), target);
    }
    checkPilotEvidence(fixture, true);
    const matrix = path.join(fixture, 'docs/investor/CAPABILITY_MATRIX.md');
    fs.writeFileSync(matrix, fs.readFileSync(matrix, 'utf8').replaceAll('\n', '\r\n'));
    assert.equal(checkPilotEvidence(fixture).status, 'passed');
    fs.appendFileSync(matrix, 'stale');
    assert.throws(() => checkPilotEvidence(fixture), /stale/);
    checkPilotEvidence(fixture, true);
    fs.appendFileSync(
      path.join(fixture, 'docs/investor/ARCHITECTURE_SECURITY_OVERVIEW.md'),
      '\n[missing](../../api/missing.ts)',
    );
    assert.throws(() => checkPilotEvidence(fixture), /source link/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
test('current repository claims and source-linked overview pass the maintained check', () => {
  assert.equal(checkPilotEvidence(root).status, 'passed');
});
