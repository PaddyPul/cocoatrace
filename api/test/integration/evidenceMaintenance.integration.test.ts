import crypto from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { config } from '../../src/config/env';
import { pool, query } from '../../src/db';
import { scanPendingEvidence } from '../../src/modules/evidenceMaintenance/scanPending';
import { evidenceStorage } from '../../src/services/evidenceStorage';
import type { EvidenceMalwareScanner } from '../../src/services/evidenceMalwareScanner';
let organizationId: string, userId: string, farmId: string;
const fixtures: { id: string; key: string }[] = [];
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const cleanScanner = (): EvidenceMalwareScanner => ({
  healthcheck: vi.fn(async () => undefined),
  scan: vi.fn(async () => ({ status: 'clean' as const, engine: 'integration-maintenance' })),
});
async function evidence(index = 0) {
  const key = `evidence/${config.environment}/${crypto.randomUUID()}`;
  await evidenceStorage().put(
    key,
    Buffer.from(`%PDF-1.7\nmaintenance-${index}`),
    'application/pdf',
  );
  const id = (
    await query(
      `INSERT INTO evidence_items
    (uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,storage_key,storage_provider,validation_status,malware_scan_status,claim_description,linked_entity_type,linked_entity_id,created_at)
    VALUES($1,$2,'other','maintenance.pdf','sha256:maintenance',$3,$4,'validated','legacy_unscanned','Maintenance fixture','farm',$6,TIMESTAMPTZ '1800-01-01'+$5::int*INTERVAL '1 second') RETURNING id`,
      [userId, organizationId, key, evidenceStorage().provider, index, farmId],
    )
  ).rows[0].id;
  fixtures.push({ id, key });
  return { id: String(id), key };
}
async function stored(id: string) {
  return (
    await query(
      'SELECT malware_scan_status,malware_scanned_at,malware_scanner_engine FROM evidence_items WHERE id=$1',
      [id],
    )
  ).rows[0];
}
beforeAll(async () => {
  const tag = crypto.randomUUID();
  organizationId = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Maintenance fixture ' + tag],
    )
  ).rows[0].id;
  userId = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [
        organizationId,
        `maintenance-${tag}@integration.test`,
        'NOT-A-LOGIN-PASSWORD',
        'Maintenance fixture',
      ],
    )
  ).rows[0].id;
  farmId = (
    await query(
      "INSERT INTO farms(farmer_organization_id,name,country,region,district) VALUES($1,'Maintenance farm','GH','Northern','Tamale') RETURNING id",
      [organizationId],
    )
  ).rows[0].id;
});
afterEach(async () => {
  const current = fixtures.splice(0);
  try {
    if (current.length)
      await query('DELETE FROM evidence_items WHERE id=ANY($1::uuid[])', [
        current.map((row) => row.id),
      ]);
  } finally {
    for (const item of current) await evidenceStorage().delete(item.key);
  }
  vi.clearAllMocks();
});
afterAll(() => pool.end());
describe('bounded pending evidence maintenance with real PostgreSQL job ownership', () => {
  it('serializes concurrent runs before scanner health or object reads and scans each selected row once', async () => {
    const item = await evidence();
    let entered!: () => void, finish!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const stalled = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const scanner: EvidenceMalwareScanner = {
      healthcheck: vi.fn(async () => undefined),
      scan: vi.fn(async () => {
        entered();
        await stalled;
        return { status: 'clean' as const, engine: 'integration-maintenance' };
      }),
    };
    const first = scanPendingEvidence({ batchSize: 1, scanner, logger });
    try {
      await started;
      const secondScanner = cleanScanner();
      const get = vi.fn(async () => {
        throw new Error('Busy worker must not read storage');
      });
      const second = await scanPendingEvidence({
        batchSize: 1,
        scanner: secondScanner,
        storage: { get, delete: vi.fn(async () => undefined) },
        logger,
      });
      expect(second).toEqual({ busy: true, selected: 0, clean: 0, infected: 0, failed: 0 });
      expect(secondScanner.healthcheck).not.toHaveBeenCalled();
      expect(get).not.toHaveBeenCalled();
      finish();
      expect(await first).toMatchObject({
        busy: false,
        selected: 1,
        clean: 1,
        infected: 0,
        failed: 0,
      });
      expect(scanner.scan).toHaveBeenCalledTimes(1);
      expect((await stored(item.id)).malware_scan_status).toBe('clean');
    } finally {
      finish();
      await first;
    }
  });
  it('caps selected records before hydration and processes the batch sequentially', async () => {
    const rows = [await evidence(0), await evidence(1), await evidence(2)];
    let active = 0,
      maxActive = 0;
    const storage = evidenceStorage();
    const get = vi.fn(async (key: string) => {
      active++;
      maxActive = Math.max(maxActive, active);
      try {
        await new Promise<void>((resolve) => setImmediate(resolve));
        return await storage.get(key);
      } finally {
        active--;
      }
    });
    const scanner = cleanScanner();
    const result = await scanPendingEvidence({
      batchSize: 2,
      scanner,
      storage: { get, delete: (key) => storage.delete(key) },
      logger,
    });
    expect(result).toMatchObject({ selected: 2, clean: 2, failed: 0 });
    expect(get).toHaveBeenCalledTimes(2);
    expect(scanner.scan).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
    expect((await stored(rows[0].id)).malware_scan_status).toBe('clean');
    expect((await stored(rows[1].id)).malware_scan_status).toBe('clean');
    expect((await stored(rows[2].id)).malware_scan_status).toBe('legacy_unscanned');
  });
  it('keeps scanner failures unavailable and moves a failed old row behind untouched candidates', async () => {
    const first = await evidence(0),
      second = await evidence(1);
    const scanner = cleanScanner();
    vi.mocked(scanner.scan).mockRejectedValueOnce(new Error('Fixture scanner unavailable'));
    expect(await scanPendingEvidence({ batchSize: 1, scanner, logger })).toMatchObject({
      selected: 1,
      clean: 0,
      failed: 1,
    });
    const failed = await stored(first.id);
    expect(failed.malware_scan_status).toBe('scan_failed');
    expect(failed.malware_scanned_at).not.toBeNull();
    expect(
      await scanPendingEvidence({ batchSize: 1, scanner: cleanScanner(), logger }),
    ).toMatchObject({ selected: 1, clean: 1, failed: 0 });
    expect((await stored(second.id)).malware_scan_status).toBe('clean');
    expect((await stored(first.id)).malware_scan_status).toBe('scan_failed');
  });
  it('persists infection before attempting deletion and never labels failed deletion clean or retryable', async () => {
    const item = await evidence();
    const storage = evidenceStorage();
    const deletion = vi.fn(async () => {
      expect((await stored(item.id)).malware_scan_status).toBe('infected');
      throw new Error('Fixture object deletion failure');
    });
    const scanner: EvidenceMalwareScanner = {
      healthcheck: vi.fn(async () => undefined),
      scan: vi.fn(async () => ({
        status: 'infected' as const,
        engine: 'integration-maintenance',
        signature: 'Fixture-Infection',
      })),
    };
    const result = await scanPendingEvidence({
      batchSize: 1,
      scanner,
      storage: { get: (key) => storage.get(key), delete: deletion },
      logger,
    });
    expect(result).toMatchObject({ selected: 1, clean: 0, infected: 1, failed: 1 });
    expect(deletion).toHaveBeenCalledTimes(1);
    expect((await stored(item.id)).malware_scan_status).toBe('infected');
    expect(await storage.get(item.key)).not.toBeNull();
  });
  it('fails closed for missing objects and oversized provider bytes without calling the scanner', async () => {
    const missing = await evidence();
    await evidenceStorage().delete(missing.key);
    const scanner = cleanScanner();
    expect(await scanPendingEvidence({ batchSize: 1, scanner, logger })).toMatchObject({
      clean: 0,
      failed: 1,
    });
    expect((await stored(missing.id)).malware_scan_status).toBe('scan_failed');
    expect(scanner.scan).not.toHaveBeenCalled();
    const oversized = await evidence(1);
    await evidenceStorage().delete(oversized.key);
    await evidenceStorage().put(
      oversized.key,
      Buffer.alloc(config.evidenceMaxFileBytes + 1),
      'application/pdf',
    );
    expect(await scanPendingEvidence({ batchSize: 1, scanner, logger })).toMatchObject({
      clean: 0,
      failed: 1,
    });
    expect((await stored(oversized.id)).malware_scan_status).toBe('scan_failed');
    expect(scanner.scan).not.toHaveBeenCalled();
  });
});
