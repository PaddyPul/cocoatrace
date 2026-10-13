import crypto from 'node:crypto';
import { config } from '../src/config/env';
import { evidenceStorage } from '../src/services/evidenceStorage';

async function main() {
  if (
    config.environment !== 'test' ||
    config.evidenceStorageDriver !== 's3' ||
    new URL(config.evidenceStorageEndpoint!).hostname !== '127.0.0.1' ||
    config.evidenceStorageBucket !== 'cocoatrace-test-evidence'
  )
    throw new Error('Disposable integration storage guard refused');
  const storage = evidenceStorage();
  const key = `quarantine/test/${crypto.randomUUID()}`;
  const finalKey = `evidence/test/${crypto.randomUUID()}`;
  const content = Buffer.from('Disposable storage readiness');
  let phase = 'bucket';
  let failed = false;
  try {
    await storage.healthcheck();
    phase = 'put';
    await storage.put(key, content, 'application/octet-stream');
    phase = 'get';
    const found = await storage.get(key);
    if (!found?.equals(content)) throw new Error('READINESS_BYTES_MISMATCH');
    phase = 'head';
    if (!(await storage.exists(key))) throw new Error('READINESS_OBJECT_MISSING');
    phase = 'promotion';
    await storage.move(key, finalKey, 'application/octet-stream');
    phase = 'promotion-read';
    if (!(await storage.get(finalKey))?.equals(content))
      throw new Error('READINESS_PROMOTION_BYTES_MISMATCH');
    phase = 'source-absence';
    if (await storage.exists(key)) throw new Error('READINESS_SOURCE_RETAINED');
    phase = 'delete';
    await storage.delete(finalKey);
    phase = 'absence';
    if (await storage.exists(finalKey)) throw new Error('READINESS_DELETE_FAILED');
    console.log(
      JSON.stringify({
        status: 'passed',
        check: 'integration-storage',
        timeoutMs: config.evidenceStorageTimeoutMs,
      }),
    );
  } catch (error) {
    failed = true;
    const raw = (error as { code?: unknown }).code;
    const code =
      typeof raw === 'string' && /^[A-Z0-9_]{1,80}$/.test(raw)
        ? raw
        : 'INTEGRATION_STORAGE_PROBE_FAILED';
    console.error(
      JSON.stringify({
        status: 'failed',
        check: 'integration-storage',
        phase,
        code,
        timeoutMs: config.evidenceStorageTimeoutMs,
      }),
    );
  } finally {
    if (failed) {
      try {
        await storage.delete(key);
        await storage.delete(finalKey);
      } catch {
        /* Disposable project teardown owns the test object. */
      }
    }
    process.exitCode = failed ? 1 : 0;
  }
}
void main().catch(() => {
  console.error('INTEGRATION_STORAGE_GUARD_FAILED');
  process.exitCode = 1;
});
