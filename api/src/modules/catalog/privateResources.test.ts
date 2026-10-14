import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ trust: vi.fn() }));
vi.mock('../trust/assessment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../trust/assessment')>();
  return { ...actual, loadBatchTrust: mocks.trust };
});
import {
  privateBatchDetail,
  privateCertificateDetail,
  privateFarmDetail,
  privateHoldingDetail,
} from './privateResources';
import { plotPage, plotSummary } from './farmPlots';
import { resourceIdParamsSchema } from '../../validation';
import { pool } from '../../db';
import type { Actor } from '../../services/resourcePolicy';
import type { Execute } from './paging';
const id = '11111111-1111-4111-8111-111111111111',
  organizationId = '22222222-2222-4222-8222-222222222222';
const actor: Actor = {
  organizationId,
  permissions: [
    'farm.read',
    'batch.read',
    'certificate.read',
    'holding.read',
    'offer.create',
    'shipment.update',
  ],
};
const parameters = { plotMode: 'paged', certificateMode: 'paged', evidenceMode: 'paged' };
const families = ['farm', 'batch', 'certificate'] as const;
type Family = (typeof families)[number];
const read = (family: Family, execute: Execute, who: Actor) =>
  family === 'farm'
    ? privateFarmDetail(execute, who, id, parameters)
    : family === 'batch'
      ? privateBatchDetail(execute, who, id, parameters)
      : privateCertificateDetail(execute, who, id);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.trust.mockResolvedValue(new Map());
});
afterAll(async () => {
  await pool.end();
});
describe('private source detail scope and nondisclosure', () => {
  it.each(families)(
    '%s refuses an unrelated ordinary/multi-role reader without loading private details',
    async (family) => {
      const execute = vi.fn(async () => ({ rows: [{ allowed: false }] }));
      expect(await read(family, execute, actor)).toBeNull();
      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute.mock.calls[0]).toHaveLength(2);
      const sql = (execute.mock.calls[0] as unknown as [string])[0];
      expect(sql).toMatch(/^SELECT EXISTS/);
      expect(mocks.trust).not.toHaveBeenCalled();
    },
  );
  it.each(families)(
    '%s network read still returns absent rather than fabricating a resource',
    async (family) => {
      const execute = vi.fn(async () => ({ rows: [] }));
      expect(
        await read(family, execute, {
          ...actor,
          permissions: [...actor.permissions, `${family}.read.all`],
        }),
      ).toBeNull();
      expect(execute).toHaveBeenCalledTimes(1);
    },
  );
  for (const mode of ['related', 'network'] as const)
    it.each(families)(
      `${mode} %s read preserves authorized details and the shared executor`,
      async (family) => {
        const execute = vi.fn(async (sql: string) => ({
          rows: sql.startsWith('SELECT EXISTS')
            ? [{ allowed: true }]
            : [
                {
                  id,
                  private_marker: 'authorized private detail',
                  organic_claim_status: 'self_declared',
                },
              ],
        }));
        const who =
          mode === 'network'
            ? { ...actor, permissions: [...actor.permissions, `${family}.read.all`] }
            : actor;
        const result = await read(family, execute, who);
        expect(JSON.stringify(result)).toContain('authorized private detail');
        if (family === 'batch') expect(mocks.trust).toHaveBeenCalledWith([id], execute, true);
      },
    );
  it.each(['ordinary', 'network'])(
    'holding reads remain holder-scoped for %s callers',
    async (mode) => {
      const execute = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] }));
      expect(
        await privateHoldingDetail(
          execute,
          { ...actor, permissions: mode === 'network' ? ['*'] : actor.permissions },
          id,
        ),
      ).toBeNull();
      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute.mock.calls[0][0]).toContain('h.holder_organization_id = $2');
      expect(execute.mock.calls[0][1]).toEqual([id, organizationId]);
    },
  );
  it.each(['page', 'summary'])(
    'plot %s does not distinguish foreign and absent parent farms',
    async (mode) => {
      for (const exists of [true, false]) {
        const execute: Execute = vi.fn(async (sql: string) => ({
          rows: sql.startsWith('SELECT id FROM farms')
            ? exists
              ? [{ id }]
              : []
            : [{ allowed: false }],
        }));
        await expect(
          mode === 'page' ? plotPage(execute, actor, id, {}) : plotSummary(execute, actor, id, {}),
        ).rejects.toMatchObject({ statusCode: 404, message: 'Farm not found' });
      }
    },
  );
  it('validates UUID params without altering an authorized identifier', () => {
    expect(resourceIdParamsSchema.parse({ id })).toEqual({ id });
  });
  it.each([undefined, { id: 123 }, { id: 'not-a-uuid' }, { id: id + '-private' }])(
    'rejects malformed detail parameters %j',
    (value) => {
      expect(resourceIdParamsSchema.safeParse(value).success).toBe(false);
    },
  );
});
