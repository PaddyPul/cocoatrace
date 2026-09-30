import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('local private evidence storage', () => {
  let root = '';
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocoatrace-evidence-')); process.env.EVIDENCE_STORAGE_LOCAL_ROOT = root; vi.resetModules(); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); delete process.env.EVIDENCE_STORAGE_LOCAL_ROOT; });
  it('writes, moves, reads and deletes opaque objects', async () => {
    const { evidenceStorage } = await import('./evidenceStorage'); const storage = evidenceStorage();
    const source = 'quarantine/test/11111111-1111-4111-8111-111111111111';
    const destination = 'evidence/test/22222222-2222-4222-8222-222222222222';
    await storage.put(source, Buffer.from('%PDF-test'), 'application/pdf'); await storage.move(source, destination, 'application/pdf');
    expect((await storage.get(destination))?.toString()).toBe('%PDF-test'); await storage.delete(destination); expect(await storage.get(destination)).toBeNull();
  });
  it('rejects traversal and arbitrary keys', async () => {
    const { evidenceStorage } = await import('./evidenceStorage');
    await expect(evidenceStorage().put('../escape', Buffer.from('x'), 'text/plain')).rejects.toThrow(/Invalid private/);
  });
});
