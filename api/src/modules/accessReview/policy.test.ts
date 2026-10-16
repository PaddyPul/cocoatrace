import { describe, expect, it } from 'vitest';
import { activityFinding, assertCompleteRoster, snapshotHash, ROSTER_LIMIT } from './policy';
describe('privileged review evidence policy', () => {
  const now = new Date('2026-10-16T00:00:00Z');
  it('never treats absent or future evidence as proven inactivity', () => {
    expect(activityFinding(null, now)).toBe('unknown');
    expect(activityFinding('2027-01-01', now)).toBe('unknown');
    expect(activityFinding('2026-01-01', now)).toBe('stale_retained_evidence');
    expect(activityFinding('2026-10-15', now)).toBe('recent_retained_evidence');
  });
  it('fails instead of accepting a truncated roster', () => {
    expect(() => assertCompleteRoster(Array(ROSTER_LIMIT))).not.toThrow();
    expect(() => assertCompleteRoster(Array(ROSTER_LIMIT + 1))).toThrow('complete review');
  });
  it('hashes nested findings and membership', () => {
    expect(snapshotHash({ rows: [{ finding: 'unknown' }] })).not.toBe(
      snapshotHash({ rows: [{ finding: 'recent' }] }),
    );
    expect(snapshotHash({ rows: [] })).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
