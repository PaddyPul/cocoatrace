import { describe, expect, it, vi } from 'vitest';
import {
  workspaceTotals,
  batchTotals,
  productTotals,
  lotTotals,
  evidenceTotals,
} from './workspace';
const organizationId = '11111111-1111-1111-1111-111111111111';
describe('bounded workspace summaries', () => {
  it('does not infer read permission from write or analytics permissions', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ count: 0, active_count: 0 }] });
    const row = await workspaceTotals(execute, {
      organizationId,
      permissions: ['batch.create', 'shipment.update', 'evidence.upload', 'analytics.read.network'],
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(row.batches).toBeNull();
    expect(row.shipments).toBeNull();
    expect(row.evidence).toBeNull();
    expect(row.contracts).toBeNull();
    expect(row.recalls).toEqual({ count: 0, active_count: 0 });
  });
  it('uses aggregate reviewed-certificate facts instead of hydrating batches or trusting legacy flags', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ count: 1500, reviewed_count: 0 }] });
    expect(await batchTotals(execute, { organizationId, permissions: ['batch.read'] })).toEqual({
      count: 1500,
      reviewed_count: 0,
    });
    const [sql, values] = execute.mock.calls[0];
    expect(sql).toContain('COUNT(*)');
    expect(sql).toContain("co.verification_status='verified'");
    expect(sql).toContain('a.id=b.attestation_id');
    expect(sql).not.toContain('b.*');
    expect(values).toEqual([organizationId, false]);
  });
  it('retains independent product and trace read-all boundaries and retained recall holds', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ count: 1 }] });
    await productTotals(execute, {
      organizationId,
      permissions: ['analytics.read.network', 'batch.read.all'],
    });
    expect(execute.mock.calls[0][1]).toEqual([organizationId, false]);
    expect(execute.mock.calls[0][0]).toContain('retained.released_at IS NULL');
    await lotTotals(execute, { organizationId, permissions: ['traceability.read.network'] });
    expect(execute.mock.calls[1][1]).toEqual([organizationId, true]);
    expect(execute.mock.calls[1][0]).toContain('lot_distributions');
  });
  it('counts evidence metadata in uploader scope without approval claims or byte projections', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ count: 1005 }] });
    expect(
      await evidenceTotals(execute, { organizationId, permissions: ['evidence.read'] }),
    ).toEqual({ count: 1005 });
    const [sql, values] = execute.mock.calls[0];
    expect(values).toEqual([organizationId, false]);
    expect(sql).not.toContain('storage_');
    expect(sql).not.toContain('approved');
  });
  it('propagates read failure without replacing totals with zero', async () => {
    await expect(
      workspaceTotals(vi.fn().mockRejectedValue(new Error('timeout')), {
        organizationId,
        permissions: ['batch.read'],
      }),
    ).rejects.toThrow('timeout');
  });
});
