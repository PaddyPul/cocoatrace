import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EvidenceMalwareScanner } from '../../services/evidenceMalwareScanner';
import { maximumScanPendingBatchSize, scanPendingEvidence } from './scanPending';

const cleanup = vi.hoisted(() => ({ register: vi.fn(), now: vi.fn() }));
vi.mock('../evidenceCleanup/repository', () => ({ queueInfectedEvidenceObject: cleanup.register }));
vi.mock('../evidenceCleanup/worker', () => ({ cleanupObjectNow: cleanup.now }));
beforeEach(() => {
  vi.clearAllMocks();
  cleanup.register.mockResolvedValue(undefined);
  cleanup.now.mockResolvedValue(true);
});
const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const id = '11111111-1111-4111-8111-111111111111';
const logger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });
function client(
  handler: (sql: string, parameters?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>,
) {
  return { query: vi.fn(handler), release: vi.fn() } as unknown as PoolClient;
}
function scanner(
  result: Awaited<ReturnType<EvidenceMalwareScanner['scan']>> = {
    status: 'clean',
    engine: 'test-scanner',
  },
): EvidenceMalwareScanner {
  return {
    healthcheck: vi.fn().mockResolvedValue(undefined),
    scan: vi.fn().mockResolvedValue(result),
  };
}

describe('bounded pending evidence maintenance', () => {
  it('caps batches at 100 and uses starvation-resistant ordering', async () => {
    const database = client(async (sql) => {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
      if (sql.includes('FROM evidence_items')) return { rows: [] };
      if (sql.includes('pg_advisory_unlock')) return { rows: [{ released: true }] };
      throw new Error('Unexpected SQL');
    });
    await scanPendingEvidence({
      batchSize: maximumScanPendingBatchSize,
      scanner: scanner(),
      storage: { get: vi.fn(), delete: vi.fn() },
      logger: logger(),
      getClient: async () => database,
    });
    const selection = vi
      .mocked(database.query)
      .mock.calls.find(([sql]) => String(sql).includes('FROM evidence_items'));
    expect(selection?.[0]).toContain(
      'ORDER BY malware_scanned_at NULLS FIRST,created_at,id LIMIT $1',
    );
    expect(selection?.[1]).toEqual([100]);
    await expect(scanPendingEvidence({ batchSize: 101 })).rejects.toThrow(/between 1 and 100/);
  });

  it('returns busy and performs no scanner or storage I/O when another session owns the lock', async () => {
    const database = client(async () => ({ rows: [{ acquired: false }] }));
    const malwareScanner = scanner();
    const storage = { get: vi.fn(), delete: vi.fn() };
    await expect(
      scanPendingEvidence({
        scanner: malwareScanner,
        storage,
        logger: logger(),
        getClient: async () => database,
      }),
    ).resolves.toEqual({ busy: true, selected: 0, clean: 0, infected: 0, failed: 0 });
    expect(malwareScanner.healthcheck).not.toHaveBeenCalled();
    expect(malwareScanner.scan).not.toHaveBeenCalled();
    expect(storage.get).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
    expect(database.release).toHaveBeenCalledWith(false);
  });

  it('marks scan errors failed with a timestamp without logging secret error text', async () => {
    const statements: string[] = [];
    const database = client(async (sql) => {
      statements.push(sql);
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
      if (sql.includes('FROM evidence_items'))
        return {
          rows: [
            { id, uploader_organization_id: organizationId, storage_key: 'evidence/test/object' },
          ],
        };
      if (sql.includes('UPDATE evidence_items')) return { rows: [{ id }] };
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
      if (sql.includes('pg_advisory_unlock')) return { rows: [{ released: true }] };
      throw new Error('Unexpected SQL');
    });
    const malwareScanner = scanner();
    vi.mocked(malwareScanner.scan).mockRejectedValue(
      new Error('private raw filename and signature'),
    );
    const log = logger();
    const result = await scanPendingEvidence({
      scanner: malwareScanner,
      storage: { get: vi.fn().mockResolvedValue(Buffer.from('%PDF-safe')), delete: vi.fn() },
      logger: log,
      getClient: async () => database,
    });
    expect(result).toMatchObject({ selected: 1, failed: 1, clean: 0, infected: 0 });
    expect(statements.join('\n')).toContain("malware_scan_status='scan_failed'");
    expect(statements.join('\n')).toContain('malware_scanned_at=NOW()');
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('private raw filename');
  });

  it('fails closed for an empty stored object without calling the scanner', async () => {
    const database = client(async (sql) => {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
      if (sql.includes('FROM evidence_items')) {
        return {
          rows: [
            { id, uploader_organization_id: organizationId, storage_key: 'evidence/test/empty' },
          ],
        };
      }
      if (sql.includes('UPDATE evidence_items')) return { rows: [{ id }] };
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
      if (sql.includes('pg_advisory_unlock')) return { rows: [{ released: true }] };
      throw new Error('Unexpected SQL');
    });
    const malwareScanner = scanner();
    const log = logger();
    const result = await scanPendingEvidence({
      scanner: malwareScanner,
      storage: { get: vi.fn().mockResolvedValue(Buffer.alloc(0)), delete: vi.fn() },
      logger: log,
      getClient: async () => database,
    });
    expect(result).toMatchObject({ selected: 1, clean: 0, infected: 0, failed: 1 });
    expect(malwareScanner.scan).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'EVIDENCE_OBJECT_MISSING' }),
      'Evidence maintenance scan failed',
    );
  });

  it('stops the batch when a failed scan status cannot be persisted', async () => {
    let updateAttempts = 0;
    const database = client(async (sql) => {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
      if (sql.includes('FROM evidence_items')) {
        return {
          rows: [
            { id, uploader_organization_id: organizationId, storage_key: 'evidence/test/first' },
            {
              id: '22222222-2222-4222-8222-222222222222',
              storage_key: 'evidence/test/second',
            },
          ],
        };
      }
      if (sql.includes('UPDATE evidence_items')) {
        updateAttempts += 1;
        throw new Error('private database connection detail');
      }
      if (sql.includes('pg_advisory_unlock')) return { rows: [{ released: true }] };
      throw new Error('Unexpected SQL');
    });
    const malwareScanner = scanner();
    vi.mocked(malwareScanner.scan).mockRejectedValue(new Error('private scanner response'));
    const get = vi.fn().mockResolvedValue(Buffer.from('%PDF-safe'));
    const log = logger();
    await expect(
      scanPendingEvidence({
        batchSize: 2,
        scanner: malwareScanner,
        storage: { get, delete: vi.fn() },
        logger: log,
        getClient: async () => database,
      }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_SCAN_STATE_PERSIST_FAILED' });
    expect(updateAttempts).toBe(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect(malwareScanner.scan).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('private database connection');
  });

  it('keeps an infected status when object deletion fails and reports cleanup separately', async () => {
    const statements: string[] = [];
    const database = client(async (sql) => {
      statements.push(sql);
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
      if (sql.includes('FROM evidence_items'))
        return {
          rows: [
            { id, uploader_organization_id: organizationId, storage_key: 'evidence/test/object' },
          ],
        };
      if (sql.includes('UPDATE evidence_items')) return { rows: [{ id }] };
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
      if (sql.includes('pg_advisory_unlock')) return { rows: [{ released: true }] };
      throw new Error('Unexpected SQL');
    });
    cleanup.now.mockResolvedValue(false);
    const result = await scanPendingEvidence({
      scanner: scanner({
        status: 'infected',
        engine: 'test-scanner',
        signature: 'private-signature',
      }),
      storage: {
        get: vi.fn().mockResolvedValue(Buffer.from('%PDF-infected')),
        delete: vi.fn().mockRejectedValue(new Error('private-provider-message')),
      },
      logger: logger(),
      getClient: async () => database,
    });
    expect(result).toMatchObject({ selected: 1, infected: 1, failed: 1, clean: 0 });
    expect(statements.filter((sql) => sql.includes("malware_scan_status='infected'"))).toHaveLength(
      1,
    );
    expect(
      statements.filter((sql) => sql.includes("malware_scan_status='scan_failed'")),
    ).toHaveLength(0);
  });

  it('destroys a pooled session when advisory unlock cannot be confirmed', async () => {
    const database = client(async (sql) => {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
      if (sql.includes('FROM evidence_items')) return { rows: [] };
      if (sql.includes('pg_advisory_unlock')) throw new Error('connection lost');
      throw new Error('Unexpected SQL');
    });
    await scanPendingEvidence({
      scanner: scanner(),
      storage: { get: vi.fn(), delete: vi.fn() },
      logger: logger(),
      getClient: async () => database,
    });
    expect(database.release).toHaveBeenCalledWith(true);
  });
});

describe('durable maintenance infection cleanup', () => {
  function infectedClient(statements: string[], legacy = false) {
    return client(async (sql) => {
      statements.push(sql);
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
      if (sql.includes('FROM evidence_items'))
        return {
          rows: [
            {
              id,
              uploader_organization_id: organizationId,
              ...(legacy
                ? { storage_path: '/tmp/legacy-evidence/infected.pdf' }
                : { storage_key: 'evidence/test/infected' }),
            },
          ],
        };
      if (sql.includes('UPDATE evidence_items')) return { rows: [{ id }] };
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
      if (sql.includes('pg_advisory_unlock')) return { rows: [{ released: true }] };
      throw Error('Unexpected SQL');
    });
  }
  const infection = () =>
    scanner({ status: 'infected', engine: 'test-scanner', signature: 'private-signature' });
  it('queues infection with database owner and actual bytes before committing, then attempts provider cleanup', async () => {
    const statements: string[] = [];
    const database = infectedClient(statements);
    const content = Buffer.from('infected bytes');
    cleanup.register.mockImplementation(async () => {
      expect(statements.at(-1)).toContain("malware_scan_status='infected'");
      expect(statements).toContain('BEGIN');
      expect(statements).not.toContain('COMMIT');
    });
    cleanup.now.mockImplementation(async () => {
      expect(statements).toContain('COMMIT');
      return true;
    });
    const storage = {
      provider: 's3' as const,
      get: vi.fn().mockImplementation(async () => {
        expect(statements).not.toContain('BEGIN');
        return content;
      }),
      delete: vi.fn(),
    };
    const result = await scanPendingEvidence({
      scanner: infection(),
      storage,
      logger: logger(),
      getClient: async () => database,
    });
    expect(result).toMatchObject({ infected: 1, failed: 0 });
    expect(cleanup.register).toHaveBeenCalledWith(database, {
      objectKey: 'evidence/test/infected',
      organizationId,
      bytes: content.length,
      storageProvider: 's3',
      evidenceId: id,
    });
    expect(cleanup.now).toHaveBeenCalledWith(
      'evidence/test/infected',
      expect.objectContaining({ storage: expect.objectContaining({ provider: 's3' }) }),
    );
    expect(storage.delete).not.toHaveBeenCalled();
  });
  it('rolls back an uncommitted infection when the cleanup reservation fails and does not delete bytes', async () => {
    const statements: string[] = [];
    const database = infectedClient(statements);
    cleanup.register.mockRejectedValue(Error('private cleanup reservation failure'));
    const result = await scanPendingEvidence({
      scanner: infection(),
      storage: {
        provider: 'local',
        get: vi.fn().mockResolvedValue(Buffer.from('infected')),
        delete: vi.fn(),
      },
      logger: logger(),
      getClient: async () => database,
    });
    expect(result).toMatchObject({ infected: 0, failed: 1 });
    expect(statements).toContain('ROLLBACK');
    expect(statements).not.toContain('COMMIT');
    expect(cleanup.now).not.toHaveBeenCalled();
    expect(statements.at(-2)).toContain("malware_scan_status='scan_failed'");
  });
  it('keeps legacy path evidence infected and reports operator cleanup instead of inventing a provider key', async () => {
    const statements: string[] = [];
    const database = infectedClient(statements, true);
    const log = logger();
    const result = await scanPendingEvidence({
      scanner: infection(),
      storage: { provider: 'local', get: vi.fn(), delete: vi.fn() },
      legacyUploadsRoot: '/tmp/legacy-evidence',
      readLegacyFile: vi.fn().mockResolvedValue(Buffer.from('legacy infected')),
      logger: log,
      getClient: async () => database,
    });
    expect(result).toMatchObject({ infected: 1, failed: 1 });
    expect(statements).toContain('COMMIT');
    expect(cleanup.register).not.toHaveBeenCalled();
    expect(cleanup.now).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      { evidenceId: id },
      'Infected legacy evidence requires manual file cleanup',
    );
    expect(statements.join('\n')).not.toContain("malware_scan_status='scan_failed'");
  });
});
