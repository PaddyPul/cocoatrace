import { describe, it, expect } from 'vitest';
import { acceptanceBody, commercialSnapshot, snapshotHash } from './policy';
describe('commercial agreement snapshot', () => {
  const row = {
    id: 'contract',
    quantity_kg: '10.000',
    price_per_kg: '5.000',
    origin_location: 'Accra',
    destination_location: 'London',
    payment_plan: 'deposit_balance',
  };
  it('excludes separately agreed mutable payment terms', () => {
    expect(snapshotHash(commercialSnapshot(row))).toBe(
      snapshotHash(commercialSnapshot({ ...row, payment_plan: 'letter_of_credit' })),
    );
  });
  it('changes hash when base terms or archived routing changes', () => {
    expect(snapshotHash(commercialSnapshot(row))).not.toBe(
      snapshotHash(commercialSnapshot({ ...row, origin_location: 'Tema' })),
    );
    expect(snapshotHash(commercialSnapshot(row))).not.toBe(
      snapshotHash(commercialSnapshot({ ...row, quantity_kg: '11.000' })),
    );
  });
  it('requires explicit confirmation and strict current hash input', () => {
    const snapshotHash = 'a'.repeat(64);
    expect(acceptanceBody.safeParse({ snapshotHash, confirmed: true }).success).toBe(true);
    for (const body of [
      { snapshotHash },
      { snapshotHash, confirmed: false },
      { snapshotHash: 'bad', confirmed: true },
      { snapshotHash, confirmed: true, organizationId: 'other' },
    ])
      expect(acceptanceBody.safeParse(body).success).toBe(false);
  });
});
