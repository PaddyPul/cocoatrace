import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { evaluateAudit } from './check-dependencies.mjs';
const now = new Date('2026-10-05T12:00:00Z');
const advisory = 'GHSA-vfj7-8cjw-p6xm';
const report = {
  auditReportVersion: 2,
  vulnerabilities: {
    braces: {
      nodes: ['node_modules/braces'],
      via: [{ url: `https://github.com/advisories/${advisory}`, severity: 'high' }],
    },
    parent: { via: ['braces'] },
  },
};
const lock = { packages: { 'node_modules/braces': { version: '3.0.3', dev: true } } };
const exception = {
  advisory,
  package: 'braces',
  version: '3.0.3',
  scope: 'development-only',
  owner: 'engineering',
  reason: 'trusted build inputs',
  expires: '2026-11-05',
};
test('a clean report passes without exceptions', () => {
  assert.equal(
    evaluateAudit({ auditReportVersion: 2, vulnerabilities: {} }, lock, [], now).status,
    'passed',
  );
});
test('known dev-only advisory is accounted for through its dependency chain', () => {
  const result = evaluateAudit(report, lock, [exception], now);
  assert.equal(result.status, 'passed');
  assert.equal(result.accepted.length, 1);
});
test('production findings never use development exceptions', () => {
  assert.equal(evaluateAudit(report, lock, [exception], now, true).status, 'failed');
  assert.equal(
    evaluateAudit(
      report,
      { packages: { 'node_modules/braces': { version: '3.0.3' } } },
      [exception],
      now,
    ).status,
    'failed',
  );
});
test('new advisories, versions and missing lock nodes fail', () => {
  assert.equal(
    evaluateAudit(report, lock, [{ ...exception, advisory: 'GHSA-other' }], now).status,
    'failed',
  );
  assert.equal(
    evaluateAudit(report, lock, [{ ...exception, version: '3.0.4' }], now).status,
    'failed',
  );
  assert.equal(evaluateAudit(report, { packages: {} }, [exception], now).status, 'failed');
});
test('expired, undated and unowned exceptions fail', () => {
  for (const overrides of [
    { expires: '2026-10-05' },
    { expires: 'invalid' },
    { owner: '' },
    { reason: '' },
  ]) {
    assert.equal(
      evaluateAudit(report, lock, [{ ...exception, ...overrides }], now).status,
      'failed',
    );
  }
});
test('unresolved or cyclic chains fail instead of silently bypassing findings', () => {
  for (const vulnerabilities of [
    { parent: { via: ['missing'] } },
    { parent: { via: ['parent'] } },
    { parent: { via: [] } },
  ]) {
    assert.equal(
      evaluateAudit({ auditReportVersion: 2, vulnerabilities }, lock, [], now).status,
      'failed',
    );
  }
});
test('registry errors and malformed responses fail closed', () => {
  for (const response of [
    { error: { code: 'ENET' } },
    { auditReportVersion: 1, vulnerabilities: {} },
    { auditReportVersion: 2, vulnerabilities: [] },
  ]) {
    assert.throws(() => evaluateAudit(response, lock, [], now));
  }
});

test('Express resolves patched qs and hostile constructor data does not crash serialization', () => {
  const apiRequire = createRequire(new URL('../api/package.json', import.meta.url));
  const expressRequire = createRequire(apiRequire.resolve('express'));
  const qs = expressRequire('qs');
  const parsed = qs.parse('x%5Bconstructor%5D%5BisBuffer%5D=y', { plainObjects: true });
  assert.doesNotThrow(() => qs.stringify(parsed));
});

// Exercise the production Express proxy dependency, not only advisory metadata.
test('mapped IPv6 trust prefixes cannot turn unrelated clients into trusted proxies', () => {
  const require = createRequire(import.meta.url);
  const proxyaddr = createRequire(require.resolve('express'))('proxy-addr');
  const request = {
    connection: { remoteAddress: '198.51.100.7' },
    headers: { 'x-forwarded-for': '1.2.3.4' },
  };
  for (const subnet of ['::ffff:10.0.0.0/8', '::/1']) {
    assert.equal(proxyaddr(request, proxyaddr.compile(subnet)), '198.51.100.7');
  }
  const trusted = {
    connection: { remoteAddress: '10.0.0.7' },
    headers: { 'x-forwarded-for': '198.51.100.7' },
  };
  assert.equal(proxyaddr(trusted, proxyaddr.compile('10.0.0.0/8')), '198.51.100.7');
  assert.equal(proxyaddr(trusted, proxyaddr.compile('::ffff:10.0.0.0/104')), '198.51.100.7');
});
