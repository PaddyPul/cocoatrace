import { describe, expect, it, vi } from 'vitest';
import { rejectDuplicateActiveCertificate } from './certificateDuplicates';
const scope = {
  farmId: 'farm',
  farmerOrganizationId: 'farmer',
  standard: ' Organic ',
  cropScope: [' COCOA ', 'cocoa', ' Peanut '],
  validFrom: '2026-01-01',
  validTo: '2026-12-31',
};
describe('certificate duplicate scope guard', () => {
  it('normalizes and deduplicates crops, preserves issuer/subject/date scope and excludes the reinstated record', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await rejectDuplicateActiveCertificate(
      { query } as unknown as Parameters<typeof rejectDuplicateActiveCertificate>[0],
      'issuer',
      scope,
      'self',
    );
    expect(query.mock.calls[0][1]).toEqual([
      'farm',
      'issuer',
      'farmer',
      ' Organic ',
      '2026-01-01',
      '2026-12-31',
      ['cocoa', 'peanut'],
      'self',
    ]);
  });
  it('rejects a matching active certificate', async () => {
    await expect(
      rejectDuplicateActiveCertificate(
        {
          query: vi.fn().mockResolvedValue({ rows: [{ id: 'duplicate' }] }),
        } as unknown as Parameters<typeof rejectDuplicateActiveCertificate>[0],
        'issuer',
        scope,
      ),
    ).rejects.toThrow(/already covers/);
  });
  it.each([{ standard: ' ' }, { cropScope: [' '] }, { validFrom: '2027-01-01' }])(
    'rejects empty or reversed scopes before a database write: %j',
    async (changes) => {
      const query = vi.fn();
      await expect(
        rejectDuplicateActiveCertificate(
          { query } as unknown as Parameters<typeof rejectDuplicateActiveCertificate>[0],
          'issuer',
          { ...scope, ...changes },
        ),
      ).rejects.toThrow(/requires/);
      expect(query).not.toHaveBeenCalled();
    },
  );
});
