import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { queueInfectedEvidenceObject, registerObject } from './repository';

const input = {
  objectKey: 'quarantine/test/11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  bytes: 128,
  storageProvider: 'local' as const,
  uploadIntentId: '33333333-3333-4333-8333-333333333333',
  reason: 'upload_quarantine' as const,
};

function client(handler: (sql: string, values?: unknown[]) => Promise<unknown>): PoolClient {
  return { query: vi.fn(handler) } as unknown as PoolClient;
}

describe('evidence cleanup repository', () => {
  it('registers object ownership before provider I/O', async () => {
    const database = client(async () => ({ rows: [{ object_key: input.objectKey }] }));
    await registerObject(database, input);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT(object_key) DO NOTHING'),
      expect.arrayContaining([input.objectKey, input.organizationId, input.bytes, 'local']),
    );
  });

  it('rejects an idempotency conflict owned by another tenant', async () => {
    const database = client(async (sql) =>
      sql.includes('INSERT INTO')
        ? { rows: [] }
        : {
            rows: [
              {
                object_key: input.objectKey,
                organization_id: '44444444-4444-4444-8444-444444444444',
                bytes: input.bytes,
                storage_provider: 'local',
                upload_intent_id: input.uploadIntentId,
                evidence_id: null,
                reason: input.reason,
              },
            ],
          },
    );
    await expect(registerObject(database, input)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('queues infected evidence through an ownership-fenced upsert', async () => {
    const database = client(async () => ({ rows: [{ id: 'cleanup-id' }], rowCount: 1 }));
    await queueInfectedEvidenceObject(database, {
      objectKey: 'evidence/test/55555555-5555-4555-8555-555555555555',
      organizationId: input.organizationId,
      bytes: 128,
      storageProvider: 'local',
      evidenceId: '66666666-6666-4666-8666-666666666666',
    });
    const sql = String(vi.mocked(database.query).mock.calls[0][0]);
    expect(sql).toContain("'pending','malware_infected'");
    expect(sql).toContain('evidence_object_cleanup.organization_id=EXCLUDED.organization_id');
  });

  it('accepts an ownership-matching dead infection ticket without reviving it', async () => {
    const evidenceId = '66666666-6666-4666-8666-666666666666';
    const database = client(async (sql) =>
      sql.includes('INSERT INTO')
        ? { rows: [], rowCount: 0 }
        : {
            rows: [
              {
                object_key: 'evidence/test/55555555-5555-4555-8555-555555555555',
                organization_id: input.organizationId,
                bytes: 128,
                storage_provider: 'local',
                upload_intent_id: null,
                evidence_id: evidenceId,
                reason: 'malware_infected',
                state: 'dead',
              },
            ],
          },
    );
    await expect(
      queueInfectedEvidenceObject(database, {
        objectKey: 'evidence/test/55555555-5555-4555-8555-555555555555',
        organizationId: input.organizationId,
        bytes: 128,
        storageProvider: 'local',
        evidenceId,
      }),
    ).resolves.toBeUndefined();
    expect(database.query).toHaveBeenCalledTimes(2);
  });
});
