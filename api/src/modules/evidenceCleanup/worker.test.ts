import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { cleanupObjectNow, maximumCleanupBatchSize, runCleanupBatch } from './worker';

const objectKey = 'quarantine/test/11111111-1111-4111-8111-111111111111';
const job = {
  id: '22222222-2222-4222-8222-222222222222',
  object_key: objectKey,
  storage_provider: 'local',
  reason: 'upload_rejected',
  attempts: 1,
  evidence_id: null,
};
const log = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });
function client(
  handler: (
    sql: string,
    values?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number }>,
): PoolClient {
  return { query: vi.fn(handler), release: vi.fn() } as unknown as PoolClient;
}

describe('bounded evidence cleanup worker', () => {
  it('caps the batch, claims with a lease and deletes sequentially', async () => {
    let claims = 0;
    const sequence: string[] = [];
    const second = {
      ...job,
      id: '33333333-3333-4333-8333-333333333333',
      object_key: 'quarantine/test/44444444-4444-4444-8444-444444444444',
    };
    const database = client(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE evidence_upload_intents')) return { rows: [], rowCount: 0 };
      if (sql.includes('WITH exhausted')) return { rows: [], rowCount: 0 };
      if (sql.includes('WITH candidates')) {
        sequence.push(`claim-${claims + 1}`);
        return { rows: [[job], [second], []][claims++] };
      }
      if (sql.includes('FROM evidence_items')) return { rows: [] };
      if (sql.includes("SET state='done'")) return { rows: [], rowCount: 1 };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const storage = {
      provider: 'local' as const,
      delete: vi.fn(async (key: string) => {
        sequence.push(`delete-${key === objectKey ? 1 : 2}`);
      }),
    };
    const result = await runCleanupBatch({
      batchSize: maximumCleanupBatchSize,
      storage,
      logger: log(),
      getClient: async () => database,
    });
    expect(result).toMatchObject({ selected: 2, deleted: 2, retried: 0, dead: 0 });
    expect(storage.delete).toHaveBeenCalledWith(objectKey);
    const claimsMade = vi
      .mocked(database.query)
      .mock.calls.filter(([sql]) => String(sql).includes("SET state='processing'"));
    expect(claimsMade.every((claim) => claim[1]?.[0] === 1)).toBe(true);
    expect(claimsMade[0][1]?.[2]).not.toBe(claimsMade[1][1]?.[2]);
    expect(sequence).toEqual(['claim-1', 'delete-1', 'claim-2', 'delete-2', 'claim-3']);
    await expect(runCleanupBatch({ batchSize: 101 })).rejects.toThrow(/between 1 and 100/);
  });

  it('fails a provider mismatch closed without deleting arbitrary bytes', async () => {
    let claims = 0;
    const database = client(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE evidence_upload_intents')) return { rows: [], rowCount: 0 };
      if (sql.includes('WITH exhausted')) return { rows: [], rowCount: 0 };
      if (sql.includes('WITH candidates')) {
        return { rows: claims++ === 0 ? [{ ...job, storage_provider: 's3' }] : [] };
      }
      if (sql.includes("SET state='dead'")) return { rows: [], rowCount: 1 };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const storage = { provider: 'local' as const, delete: vi.fn() };
    const result = await runCleanupBatch({
      storage,
      logger: log(),
      getClient: async () => database,
    });
    expect(result).toMatchObject({ selected: 1, dead: 1, deleted: 0 });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('will not delete live evidence unless its durable status is infected', async () => {
    let claims = 0;
    const database = client(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE evidence_upload_intents')) return { rows: [], rowCount: 0 };
      if (sql.includes('WITH exhausted')) return { rows: [], rowCount: 0 };
      if (sql.includes('WITH candidates')) {
        return {
          rows:
            claims++ === 0
              ? [{ ...job, object_key: objectKey.replace('quarantine', 'evidence') }]
              : [],
        };
      }
      if (sql.includes('FROM evidence_items')) return { rows: [{ malware_scan_status: 'clean' }] };
      if (sql.includes("SET state='dead'")) return { rows: [], rowCount: 1 };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const storage = { provider: 'local' as const, delete: vi.fn() };
    const result = await runCleanupBatch({
      storage,
      logger: log(),
      getClient: async () => database,
    });
    expect(result.dead).toBe(1);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('persists a schema-safe retry after provider failure', async () => {
    let retryValues: unknown[] | undefined;
    const database = client(async (sql, values) => {
      if (sql.includes("SET state='processing'")) return { rows: [job], rowCount: 1 };
      if (sql.includes('FROM evidence_items')) return { rows: [] };
      if (sql.includes("SET state='pending'")) {
        retryValues = values;
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const result = await cleanupObjectNow(objectKey, {
      storage: {
        provider: 'local',
        delete: vi.fn().mockRejectedValue(new Error('private detail')),
      },
      logger: log(),
      random: () => 0,
      getClient: async () => database,
    });
    expect(result).toBe(false);
    expect(retryValues?.[3]).toBe('ERROR');
    expect(JSON.stringify(retryValues)).not.toContain('private detail');
  });

  it('does not report quota release when its completion token is stale', async () => {
    const database = client(async (sql) => {
      if (sql.includes("SET state='processing'")) return { rows: [job], rowCount: 1 };
      if (sql.includes('FROM evidence_items')) return { rows: [] };
      if (sql.includes("SET state='done'")) return { rows: [], rowCount: 0 };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const result = await cleanupObjectNow(objectKey, {
      storage: { provider: 'local', delete: vi.fn().mockResolvedValue(undefined) },
      logger: log(),
      getClient: async () => database,
    });
    expect(result).toBe(false);
  });
});
