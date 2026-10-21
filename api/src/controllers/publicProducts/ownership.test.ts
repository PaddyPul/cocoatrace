import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  relationship: vi.fn(),
  activate: vi.fn(),
  transaction: vi.fn(),
  release: vi.fn(),
}));
vi.mock('../../db', () => ({
  query: mocks.query,
  getClient: async () => ({ query: mocks.transaction, release: mocks.release }),
}));
vi.mock('../../config/env', () => ({ config: { publicWebUrl: 'https://example.test' } }));
vi.mock('../../services/audit', () => ({ record: vi.fn() }));
vi.mock('../../services/resourcePolicy', () => ({
  hasBatchRelationship: mocks.relationship,
  hasExplicitPermission: (actor: { permissions: string[] }, permission: string) =>
    actor.permissions.includes(permission) || actor.permissions.includes('*'),
}));
vi.mock('../../modules/recall/lifecycle', () => ({ activateRecall: mocks.activate }));
vi.mock('../../modules/catalog/publicNotices', () => ({ readPublicNotices: vi.fn() }));
vi.mock('../../modules/catalog/publicJourney', () => ({ readPublicJourney: vi.fn() }));
vi.mock('../../modules/catalog/publicEvidence', () => ({ readPublicEvidence: vi.fn() }));
vi.mock('../../modules/catalog/recallRecords', () => ({ legacyRecalls: vi.fn() }));
vi.mock('../../modules/catalog/productProfiles', () => ({ legacyProducts: vi.fn() }));
vi.mock('../../modules/catalog/paging', () => ({ withCatalogRead: vi.fn() }));
vi.mock('../../modules/trust/assessment', () => ({
  loadBatchTrust: vi.fn(),
  legacyOrganicStatus: vi.fn(),
}));
import * as compatibility from '../publicProductController';
import * as rendering from './rendering';
import * as administration from './administration';
import * as recalls from './recalls';

function response() {
  const res = { status: vi.fn(), json: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}
function request(permissions: string[] = []) {
  return {
    params: { slug: 'private-lot', batchId: 'batch-1' },
    body: { reason: 'Safety concern' },
    user: { id: 'user-1', organizationId: 'org-1', permissions },
  } as unknown as Request;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation((sql: string, values: unknown[]) =>
    ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)
      ? Promise.resolve({ rows: [] })
      : mocks.query(sql, values),
  );
});
describe('separate public rendering, profile administration and recall ownership', () => {
  it('keeps every compatibility export bound to its owned handler', () => {
    expect(compatibility).toMatchObject({ ...rendering, ...administration, ...recalls });
  });
  it('does not render or create scans for an unpublished or absent profile', async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    for (const handler of [
      rendering.getPublicProduct,
      rendering.getProductQr,
      rendering.recordScan,
    ]) {
      const res = response();
      await handler(request(), res as unknown as Response);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Product profile not found' });
    }
    expect(
      mocks.query.mock.calls.every(
        ([sql]) =>
          sql.includes("visibility='published'") || sql.includes("visibility = 'published'"),
      ),
    ).toBe(true);
  });
  it('denies unrelated profile reads before private hydration', async () => {
    mocks.relationship.mockResolvedValue(false);
    const res = response();
    await administration.getProfileForBatch(request(), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('does not confuse broad read permission with profile mutation ownership', async () => {
    mocks.query.mockResolvedValue({ rows: [{ id: 'batch-1', current_holder_id: 'other' }] });
    const res = response();
    await administration.upsertProfile(
      request(['product_profile.read.all']),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it.each([['recall.manage'], ['recall.manage.all'], ['*']])(
    'passes the exact recall management scope for %s',
    async (permission) => {
      mocks.activate.mockResolvedValue({ id: 'recall-1' });
      const req = request([permission]);
      const res = response();
      await recalls.createRecall(req, res as unknown as Response);
      expect(mocks.activate).toHaveBeenCalledWith(
        req.user,
        permission !== 'recall.manage',
        req.body,
      );
      expect(res.status).toHaveBeenCalledWith(201);
    },
  );
});
