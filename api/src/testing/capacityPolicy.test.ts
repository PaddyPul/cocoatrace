import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { CapacityPolicy, capacityPolicyErrors, sourceBudgetValues } from './capacityPolicy';
const root = path.resolve(__dirname, '../../..');
const policy = JSON.parse(
  fs.readFileSync(path.join(root, 'docs/performance/capacity-policy.json'), 'utf8'),
) as CapacityPolicy;
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
it('checks every published capacity budget against source syntax without loading runtime configuration', () => {
  expect(policy.budgets).toHaveLength(32);
  expect(capacityPolicyErrors(policy, read)).toEqual([]);
});
it('detects source drift instead of reporting an old ceiling', () => {
  const errors = capacityPolicyErrors(policy, (file) =>
    read(file).replace('EVIDENCE_GLOBAL_TRANSFER_LIMIT = 4', 'EVIDENCE_GLOBAL_TRANSFER_LIMIT = 5'),
  );
  expect(errors).toContain('Source drift: evidence_global_transfer_limit');
});
it('rejects missing source bindings, duplicate IDs and unsafe paths', () => {
  const changed = structuredClone(policy);
  changed.budgets.push({ ...changed.budgets[0] });
  changed.budgets[0].source = '../secret.ts';
  changed.budgets[1].selector = { type: 'declaration', name: 'missing' };
  expect(capacityPolicyErrors(changed, read)).toEqual(
    expect.arrayContaining([
      `Unsafe source: ${changed.budgets[0].id}`,
      `Source drift: ${changed.budgets[1].id}`,
      `Duplicate budget: ${changed.budgets[0].id}`,
    ]),
  );
});
it('reads arithmetic syntax without evaluating arbitrary code or environment values', () => {
  expect(
    sourceBudgetValues('const limit = 10 * 1024 * 1024;', { type: 'declaration', name: 'limit' }),
  ).toEqual([10485760]);
  expect(
    sourceBudgetValues('const limit = process.exit(1);', { type: 'declaration', name: 'limit' }),
  ).toEqual([]);
});
it('keeps engineering targets explicit and distinct from workload measurements', () => {
  const changed = structuredClone(policy);
  changed.loadTargets.classification = 'customer-SLA';
  expect(capacityPolicyErrors(changed, read)).toContain(
    'Load target contract changed; review the load runner and policy together',
  );
});
