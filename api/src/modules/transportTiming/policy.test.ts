import { describe, it, expect } from 'vitest';
import { arrivalOverdue, timingBody } from './policy';
describe('transport calendar deadlines', () => {
  it('waits until the end of the UTC day and never invents an unknown deadline', () => {
    const now = new Date('2026-10-16T23:59:59Z');
    expect(arrivalOverdue('2026-10-16', 'departed', 'in_transit', now)).toBe(false);
    expect(arrivalOverdue('2026-10-15', 'departed', 'in_transit', now)).toBe(true);
    expect(arrivalOverdue(null, 'departed', 'in_transit', now)).toBe(false);
  });
  it('suppresses arrival and cancellation even with retained past ETA', () => {
    for (const milestone of ['arrived', 'customs_cleared', 'unloaded', 'delivered'])
      expect(arrivalOverdue('2020-01-01', milestone, 'in_transit')).toBe(false);
    expect(arrivalOverdue('2020-01-01', 'departed', 'cancelled')).toBe(false);
  });
  it('rejects imaginary dates and unreviewed changes', () => {
    expect(
      timingBody.safeParse({ expectedRevision: 0, etaArrival: '2026-02-30', reason: 'Delay' })
        .success,
    ).toBe(false);
    expect(
      timingBody.safeParse({ expectedRevision: 0, etaArrival: '2026-02-28', reason: '' }).success,
    ).toBe(false);
  });
});
