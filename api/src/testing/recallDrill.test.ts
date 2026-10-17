import { describe, expect, it } from 'vitest';
import {
  assertDrillReport,
  buildDrillReport,
  DRILL_SCENARIOS,
  type DrillScenario,
} from './recallDrill';
const sha = 'a'.repeat(40);
const rows = (): DrillScenario[] =>
  DRILL_SCENARIOS.map((name) => ({
    name,
    status: 'passed',
    elapsedMs: 10,
    graphComplete: true,
    expectedRecipients: 3,
    identifiedRecipients: 3,
    missingRecipients: 0,
    unexpectedRecipients: 0,
    unresolvedRecipients: 2,
    unresolvedContactRecipients: 1,
    expectedQuantityGrams: 10000,
    accountedQuantityGrams: 10000,
    retainedQuantityGrams: 6000,
  }));
const report = (scenarios = rows()) =>
  buildDrillReport(
    sha,
    new Date('2026-10-17T00:00:00Z'),
    new Date('2026-10-17T00:00:01Z'),
    scenarios,
  );
describe('recorded synthetic recall drill evidence', () => {
  it('reports complete identification while leaving pending acknowledgement/contact explicitly unresolved', () => {
    const r = report();
    expect(r.status).toBe('passed');
    expect(r.scenarios[0].unresolvedRecipients).toBe(2);
    expect(() => assertDrillReport(r, sha)).not.toThrow();
  });
  it.each([
    'graphComplete',
    'missingRecipients',
    'unexpectedRecipients',
    'accountedQuantityGrams',
    'expectedQuantityGrams',
    'retainedQuantityGrams',
    'unresolvedRecipients',
    'unresolvedContactRecipients',
    'elapsedMs',
    'status',
  ] as const)('rejects inconsistent or incomplete %s', (field) => {
    const data = rows();
    Object.assign(data[0], {
      [field]:
        field === 'graphComplete'
          ? false
          : field === 'status'
            ? 'failed'
            : field === 'expectedQuantityGrams'
              ? 0
              : field === 'elapsedMs'
                ? Infinity
                : field === 'accountedQuantityGrams'
                  ? 9999
                  : field === 'retainedQuantityGrams'
                    ? 10001
                    : field.startsWith('unresolved')
                      ? 4
                      : 1,
    });
    expect(report(data).status).toBe('failed');
    expect(() => assertDrillReport(report(data), sha)).toThrow();
  });
  it('rejects missing, duplicate and stale scenarios rather than counting partial success', () => {
    expect(report(rows().slice(1)).status).toBe('failed');
    const duplicate = rows();
    duplicate[2] = duplicate[0];
    expect(report(duplicate).status).toBe('failed');
    expect(() => assertDrillReport(report(), 'b'.repeat(40))).toThrow();
  });
  it('rejects extra fields rather than accepting resource or contact data in a safe report', () => {
    expect(() => assertDrillReport({ ...report(), email: 'private@example.test' }, sha)).toThrow();
    const data = rows();
    Object.assign(data[0], { recipientId: 'private-id' });
    expect(report(data).status).toBe('failed');
  });
  it('rejects impossible elapsed times and invalid counts', () => {
    expect(() => assertDrillReport({ ...report(), elapsedMs: 0 }, sha)).toThrow();
    const data = rows();
    data[0].identifiedRecipients = NaN;
    expect(report(data).status).toBe('failed');
  });
});
