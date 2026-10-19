import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { platformRole } from '../web/src/content/platformRole.ts';
import { pilotLimitations } from '../web/src/content/pilotLimitations.ts';

test('customer role disclosure explicitly excludes all six regulated or operational roles', () => {
  for (const role of [
    'certifier',
    'bank',
    'escrow provider',
    'carrier',
    'customs broker',
    'legal compliance authority',
  ])
    assert.ok(platformRole.statement.includes(role));
  assert.match(platformRole.statement, /It is not a/);
  assert.ok(pilotLimitations.sections.some((section) => section.detail === platformRole.statement));
  const detail = platformRole.responsibilities.join(' ');
  assert.match(detail, /does not hold customer funds/);
  assert.match(detail, /does not guarantee product safety/);
  assert.match(detail, /independently confirm carrier events/);
});

test('pilot, investor, public product, payment and shipment views expose the shared role notice', () => {
  for (const name of [
    'PilotLimitationsPage',
    'InvestorDemoPage',
    'PublicProductPage',
    'PaymentDetailPage',
    'ShipmentDetailPage',
  ]) {
    const source = readFileSync(new URL(`../web/src/pages/${name}.tsx`, import.meta.url), 'utf8');
    assert.match(source, /<PlatformRoleNotice\s*\/>/, name);
  }
  const app = readFileSync(new URL('../web/src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /path="\/platform-role"\s+element=\{<PlatformRolePage\s*\/>\}/);
});
