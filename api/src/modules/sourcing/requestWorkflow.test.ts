import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn(), outsideQuery: vi.fn() }));
vi.mock('../../db', () => ({
  query: mocks.outsideQuery,
  getClient: async () => ({ query: mocks.query, release: mocks.release }),
}));
vi.mock('../../services/audit', () => ({ hashObject: () => 'hash' }));
import { createRequest } from './requestWorkflow';
import { createSourcingRequestSchema } from '../../validation';
const actor = { id: 'buyer', organizationId: 'organization' };
const input = createSourcingRequestSchema.parse({
  title: 'Cocoa request',
  commodity: 'cocoa',
  quantityKg: 2,
  deliveryLocation: 'Accra',
});
beforeEach(() => vi.resetAllMocks());
describe('sourcing request creation transaction', () => {
  it('rolls back the inserted request when the strict audit insert fails', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO sourcing_requests')) return { rows: [{ id: 'request' }] };
      if (sql.includes('INSERT INTO audit_events')) throw new Error('audit unavailable');
      return { rows: [] };
    });
    await expect(createRequest(actor, input)).rejects.toThrow('audit unavailable');
    const statements = mocks.query.mock.calls.map(([sql]) => sql as string);
    expect(statements[0]).toBe('BEGIN');
    expect(statements[1]).toContain('INSERT INTO sourcing_requests');
    expect(statements[2]).toContain('INSERT INTO audit_events');
    expect(statements.slice(3)).toEqual(['ROLLBACK']);
    expect(mocks.outsideQuery).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it('writes the request fields and audit through the same client before commit', async () => {
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes('INSERT INTO sourcing_requests') ? [{ id: 'request' }] : [],
    }));
    await expect(createRequest(actor, input)).resolves.toEqual({ id: 'request' });
    expect(mocks.query.mock.calls[1][1]).toEqual([
      'organization',
      'buyer',
      'Cocoa request',
      'cocoa',
      2,
      [],
      {},
      {},
      'Accra',
      'CIF',
      null,
      null,
      'matched',
      'draft',
    ]);
    expect(mocks.query.mock.calls[2][1]).toEqual([
      'buyer',
      'organization',
      'sourcing_request.create',
      'sourcing_request',
      'request',
      'hash',
      '{}',
    ]);
    expect(mocks.query).toHaveBeenLastCalledWith('COMMIT');
    expect(mocks.outsideQuery).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
