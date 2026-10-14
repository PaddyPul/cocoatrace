import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
const mocks = vi.hoisted(() => ({ execute: vi.fn(), actions: vi.fn(), snapshot: vi.fn() }));
vi.mock('../db', () => ({ query: vi.fn(), pool: {}, getClient: vi.fn() }));
vi.mock('../modules/catalog/paging', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../modules/catalog/paging')>()),
  withCatalogRead: mocks.snapshot,
}));
vi.mock('../services/tradeActionRepository', () => ({ loadTradeActions: mocks.actions }));
import { getContract } from './contractController';
const id = '11111111-1111-4111-8111-111111111111';
const organizationId = '22222222-2222-4222-8222-222222222222';
function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}
const request = {
  params: { id },
  user: { id: 'user', organizationId, permissions: ['*'] },
} as unknown as Request;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.snapshot.mockImplementation(async (callback) => callback(mocks.execute));
  mocks.actions.mockResolvedValue([]);
});
describe('contract private detail boundary', () => {
  it('keeps even wildcard actors party-scoped and stops before related private hydration', async () => {
    mocks.execute.mockResolvedValue({ rows: [] });
    const res = response();
    await getContract(request, res as unknown as Response);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.execute.mock.calls[0][0]).toContain(
      'c.seller_organization_id=$2 OR c.buyer_organization_id=$2',
    );
    expect(mocks.execute.mock.calls[0][1]).toEqual([id, organizationId]);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Contract not found' });
    expect(mocks.actions).not.toHaveBeenCalled();
  });
  it('loads related records and actions in the same bounded snapshot', async () => {
    mocks.execute.mockResolvedValue({ rows: [] }).mockResolvedValueOnce({ rows: [{ id }] });
    const res = response();
    await getContract(request, res as unknown as Response);
    expect(mocks.snapshot).toHaveBeenCalledTimes(1);
    expect(mocks.execute).toHaveBeenCalledTimes(4);
    expect(mocks.execute.mock.calls[1][0]).toContain('LIMIT 1001');
    expect(mocks.actions).toHaveBeenCalledWith(request.user, id, mocks.execute);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id, documents: [], installments: [] }),
    );
  });
  it('does not emit a successful response when snapshot completion fails', async () => {
    mocks.execute.mockResolvedValue({ rows: [] }).mockResolvedValueOnce({ rows: [{ id }] });
    mocks.snapshot.mockImplementationOnce(async (callback) => {
      await callback(mocks.execute);
      throw new Error('Commit failed');
    });
    const res = response();
    await expect(getContract(request, res as unknown as Response)).rejects.toThrow('Commit failed');
    expect(res.json).not.toHaveBeenCalled();
  });
  it('rejects oversized linked evidence before returning a partial contract', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ id }] })
      .mockResolvedValueOnce({ rows: Array.from({ length: 1001 }, () => ({ id })) });
    const res = response();
    await expect(getContract(request, res as unknown as Response)).rejects.toMatchObject({
      statusCode: 422,
      code: 'CATALOG_READ_LIMIT',
    });
    expect(res.json).not.toHaveBeenCalled();
    expect(mocks.actions).not.toHaveBeenCalled();
  });
});
