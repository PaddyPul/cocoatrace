import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  query: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [], rowCount: 0 })),
  release: vi.fn(),
}));
vi.mock('../../db', () => ({
  getClient: vi.fn(async () => database),
  query: vi.fn(),
}));
import { listingRepository } from './repository';
import { ListingWorkflowError } from './types';

describe('listing transaction repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('commits the listing write and its audit on the same transaction', async () => {
    await listingRepository.transaction(async (tx) => {
      await tx.withdraw('listing');
      await tx.audit({ id: 'user', organizationId: 'seller' }, 'listing.delete', 'listing');
    });
    expect(
      database.query.mock.calls.map(([sql]) =>
        sql.startsWith('INSERT INTO audit_events') ? 'AUDIT' : sql,
      ),
    ).toEqual(['BEGIN', 'UPDATE listings SET active=FALSE WHERE id=$1', 'AUDIT', 'COMMIT']);
    expect(database.release).toHaveBeenCalledOnce();
  });
  it('rolls back domain rejection without commit and releases the connection', async () => {
    const failure = new ListingWorkflowError('unavailable', 'Holding not available');
    await expect(
      listingRepository.transaction(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(database.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(database.release).toHaveBeenCalledOnce();
  });
  it('rolls back a write when audit fails', async () => {
    database.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('INSERT INTO audit_events')) throw new Error('audit unavailable');
      return { rows: [], rowCount: 0 };
    });
    await expect(
      listingRepository.transaction(async (tx) => {
        await tx.withdraw('listing');
        await tx.audit({ id: 'user', organizationId: 'seller' }, 'listing.delete', 'listing');
      }),
    ).rejects.toThrow('audit unavailable');
    expect(database.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
    expect(database.query.mock.calls.map(([sql]) => sql)).not.toContain('COMMIT');
    expect(database.release).toHaveBeenCalledOnce();
  });
});
