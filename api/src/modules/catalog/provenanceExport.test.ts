import { describe, expect, it, vi } from 'vitest';
import {
  provenanceExportInput,
  provenanceExportRead,
  PROVENANCE_EXPORT_MAX_BYTES,
} from './provenanceExport';
const id = '11111111-1111-1111-1111-111111111111',
  org = '22222222-2222-2222-2222-222222222222',
  plot = '33333333-3333-3333-3333-333333333333',
  contractId = '44444444-4444-4444-4444-444444444444';
const actor = {
  id,
  organizationId: org,
  email: 'authorized@integration.test',
  permissions: ['provenance.export.network'],
};
const batch = {
  id,
  farm_id: org,
  plot_ids: [plot],
  organic_claim_status: 'none',
  harvest_date: '2026-01-01',
  current_holder_id: org,
};
function executor(
  options: {
    denied?: boolean;
    missing?: boolean;
    overflow?: string;
    large?: boolean;
    evidenceState?: string;
    contract?: boolean;
  } = {},
) {
  return vi.fn(async (sql: string, _args?: unknown[]) => {
    if (sql === 'SELECT id FROM harvest_batches WHERE id=$1::uuid')
      return { rows: options.missing ? [] : [{ id }] };
    if (sql.startsWith('SELECT EXISTS(')) return { rows: [{ allowed: !options.denied }] };
    if (sql.includes('COALESCE(SUM(octet_length'))
      return { rows: [{ bytes: String(options.large ? PROVENANCE_EXPORT_MAX_BYTES : 100) }] };
    if (
      options.overflow &&
      sql.startsWith('SELECT ') &&
      sql.includes(options.overflow) &&
      sql.includes('LIMIT')
    )
      return { rows: Array.from({ length: 1001 }, () => ({ id })) };
    if (sql.includes('FROM harvest_batches b'))
      return { rows: sql.includes('LIMIT') ? [{ id }] : [{ ...batch }] };
    if (sql.includes('FROM farm_plots p'))
      return {
        rows: sql.includes('LIMIT')
          ? [{ id: plot }]
          : [{ id: plot, gps_lat: 0, gps_lng: 0, eudr_cutoff_checked: false }],
      };
    if (sql.includes('FROM evidence_items e'))
      return {
        rows: sql.includes('LIMIT')
          ? [{ id }, { id: plot }]
          : [
              {
                id,
                type: 'certificate_pdf',
                validation_status: options.evidenceState || 'validated',
                malware_scan_status: 'clean',
              },
              {
                id: plot,
                type: 'weighing_ticket',
                validation_status: 'validated',
                malware_scan_status: 'clean',
              },
            ],
      };
    if (sql.includes('FROM trust_claim_reviews r')) return { rows: [] };
    if (sql.includes('FROM sales_contracts c'))
      return {
        rows: options.contract
          ? sql.includes('LIMIT')
            ? [{ id: contractId }]
            : [{ id: contractId, eudr_due_diligence_reference: 'DUE' }]
          : [],
      };
    if (sql.includes('FROM shipments sh')) return { rows: [] };
    throw new Error('Unexpected query: ' + sql);
  });
}
describe('bounded shared provenance packs', () => {
  it.each([{ format: 'zip' }, { contractId: 'bad' }, { contractId: ['bad'] }, { limit: '1000' }])(
    'rejects unsupported or malformed parameters %j',
    (parameters) => {
      expect(() => provenanceExportInput(id, parameters)).toThrow();
    },
  );
  it('rejects malformed batch IDs and export format on the view', () => {
    expect(() => provenanceExportInput('bad', {})).toThrow();
    expect(() => provenanceExportInput(id, { format: 'json' }, 'read')).toThrow();
  });
  it('denies unrelated organizations before any metadata hydration', async () => {
    const read = executor({ denied: true });
    await expect(
      provenanceExportRead(read, { ...actor, permissions: ['provenance.export'] }, id),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(read).toHaveBeenCalledTimes(2);
    const missing = executor({ missing: true });
    await expect(provenanceExportRead(missing, actor, id)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(missing).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['read', 'provenance.export.network'],
    ['export', 'provenance.read.network'],
  ] as const)('does not substitute %s authority with %s', async (mode, permission) => {
    const read = executor({ denied: true });
    await expect(
      provenanceExportRead(read, { ...actor, permissions: [permission] }, id, {}, mode),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(read).toHaveBeenCalledTimes(2);
  });
  it.each(['read', 'export'] as const)(
    'keeps %s network authority explicit, metadata safe, trust and complete shape consistent',
    async (mode) => {
      const read = executor();
      const report = await provenanceExportRead(
        read,
        { ...actor, permissions: [`provenance.${mode}.network`] },
        id,
        {},
        mode,
      );
      expect(report.payload.completenessPercent).toBe(67);
      expect(report.payload.trust.organic.status).toBe('not_claimed');
      expect(report.payload.evidenceItems).toHaveLength(2);
      expect(report.serialized).not.toContain('storage_path');
      expect(
        read.mock.calls
          .filter(([sql]) => sql.includes('FROM farm_plots p'))
          .every(([sql]) => sql.includes('p.id=ANY($2::uuid[])')),
      ).toBe(true);
      expect(read.mock.calls.some(([sql]) => sql.startsWith('SELECT EXISTS('))).toBe(false);
    },
  );
  it('counts only validated and clean evidence in completeness', async () => {
    const report = await provenanceExportRead(executor({ evidenceState: 'invalid' }), actor, id);
    expect(report.payload.completenessPercent).toBe(50);
    expect(report.payload.evidenceItems[0].validation_status).toBe('invalid');
  });
  it('refuses oversized linked collections before hydration', async () => {
    const read = executor({ overflow: 'FROM evidence_items e' });
    await expect(provenanceExportRead(read, actor, id)).rejects.toMatchObject({
      statusCode: 422,
      code: 'PROVENANCE_EXPORT_LIMIT',
    });
    expect(read.mock.calls.some(([sql]) => sql.startsWith('SELECT e.id,e.type'))).toBe(false);
  });
  it('rejects byte overflow before any large batch record leaves PostgreSQL', async () => {
    const read = executor({ large: true });
    await expect(provenanceExportRead(read, actor, id, {}, 'read')).rejects.toMatchObject({
      statusCode: 422,
      code: 'PROVENANCE_READ_LIMIT',
    });
    expect(read.mock.calls.some(([sql]) => sql.startsWith('SELECT b.*'))).toBe(false);
  });
  it('requires batch and party authorization for explicit contract context', async () => {
    const denied = executor();
    await expect(provenanceExportRead(denied, actor, id, { contractId })).rejects.toMatchObject({
      statusCode: 403,
    });
    const read = executor({ contract: true });
    const report = await provenanceExportRead(read, actor, id, { contractId });
    expect(report.payload.contractId).toBe(contractId);
    const contractQuery = read.mock.calls.find(([sql]) => sql.includes('FROM sales_contracts c'))!;
    expect(contractQuery[0]).toContain('h.batch_id=$2::uuid');
    expect(contractQuery[0]).toContain(
      'c.seller_organization_id=$4::uuid OR c.buyer_organization_id=$4::uuid',
    );
    expect(contractQuery[1]).toEqual([contractId, id, true, org]);
  });
});
