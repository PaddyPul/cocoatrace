import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { config } from '../../src/config/env';
import { evidenceStorage } from '../../src/services/evidenceStorage';
const storage = evidenceStorage();
const keys = Array.from(
  { length: 4 },
  () => `evidence/${config.environment}/${crypto.randomUUID()}`,
);
beforeAll(async () => {
  await storage.healthcheck();
  await storage.put(keys[0], Buffer.from('metadata-only proof'), 'application/pdf');
  await storage.put(keys[1], Buffer.alloc(0), 'application/pdf');
  await storage.put(keys[2], Buffer.alloc(config.evidenceMaxFileBytes + 1), 'application/pdf');
});
afterAll(async () => {
  vi.restoreAllMocks();
  for (const key of keys) await storage.delete(key);
});
describe('real provider metadata-only evidence checks', () => {
  it('recognizes nonempty evidence and rejects missing or empty objects without invoking GET', async () => {
    const read = vi
      .spyOn(storage, 'get')
      .mockRejectedValue(new Error('GET must never be used to check existence'));
    try {
      expect(await storage.exists(keys[0])).toBe(true);
      expect(await storage.exists(keys[1])).toBe(false);
      expect(await storage.exists(keys[3])).toBe(false);
      expect(read).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
    }
  });
  it('fails closed on oversized provider objects using metadata alone', async () => {
    const read = vi
      .spyOn(storage, 'get')
      .mockRejectedValue(new Error('GET must never be used to check existence'));
    try {
      await expect(storage.exists(keys[2])).rejects.toMatchObject({
        statusCode: 503,
        code: 'EVIDENCE_STORAGE_READ_LIMIT',
      });
      expect(read).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
    }
  });
  it('tracks deletion immediately and rejects unsafe private keys', async () => {
    await storage.delete(keys[0]);
    expect(await storage.exists(keys[0])).toBe(false);
    await expect(storage.exists('../escape')).rejects.toThrow(
      'Invalid private evidence object key',
    );
  });
});
