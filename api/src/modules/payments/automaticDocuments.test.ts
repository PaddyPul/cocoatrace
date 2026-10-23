import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), present: vi.fn() }));
vi.mock('../../db', () => ({ query: mocks.query }));
vi.mock('./documentsAndSecurity', () => ({ automaticallyPresentDocuments: mocks.present }));
import { reconcileDocumentSets } from './automaticDocuments';
import { ValidationError } from '../../errors';

describe('automatic document submission recovery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it('continues past incomplete sets and surfaces infrastructure failures without stopping later trades', async () => {
    mocks.query.mockResolvedValue({
      rows: [
        { id: 'a', seller_organization_id: 'seller-a' },
        { id: 'b', seller_organization_id: 'seller-b' },
        { id: 'c', seller_organization_id: 'seller-c' },
      ],
    });
    mocks.present
      .mockRejectedValueOnce(new ValidationError('Missing insurance'))
      .mockRejectedValueOnce(new Error('Storage unavailable'))
      .mockResolvedValueOnce({});
    expect(await reconcileDocumentSets()).toEqual({ presented: 1, failed: 1 });
    expect(mocks.present.mock.calls).toEqual([
      ['seller-a', 'a'],
      ['seller-b', 'b'],
      ['seller-c', 'c'],
    ]);
    expect(mocks.query.mock.calls[0][0]).toContain("c.payment_terms_status='agreed'");
    expect(mocks.query.mock.calls[0][0]).toContain("p.security_status='verified'");
    expect(mocks.query.mock.calls[0][0]).toContain("status<>'resolved'");
  });
  it('rotates full batches and wraps rather than starving later trades behind a blocked first page', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: `id-${i}`,
      seller_organization_id: 'seller',
    }));
    let pages = 0;
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT p.id')) return { rows: pages++ === 0 ? rows : [] };
      return { rows: [] };
    });
    mocks.present.mockRejectedValue(new ValidationError('Not ready'));
    await reconcileDocumentSets();
    await reconcileDocumentSets();
    await reconcileDocumentSets();
    expect(mocks.query.mock.calls.filter(([sql]) => sql.includes('SELECT p.id'))[1][1]).toEqual([
      'id-19',
    ]);
    expect(mocks.query.mock.calls.filter(([sql]) => sql.includes('SELECT p.id'))[2][1]).toEqual([
      null,
    ]);
  });
});
