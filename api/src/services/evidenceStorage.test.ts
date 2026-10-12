import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const source = 'quarantine/test/11111111-1111-4111-8111-111111111111';
const destination = 'evidence/test/22222222-2222-4222-8222-222222222222';
let root = '';
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'bettertrade-evidence-'));
  vi.stubEnv('APP_ENV', 'test');
  vi.stubEnv('EVIDENCE_STORAGE_DRIVER', 'local');
  vi.stubEnv('EVIDENCE_STORAGE_LOCAL_ROOT', root);
  vi.stubEnv('EVIDENCE_MAX_FILE_BYTES', '8');
  vi.stubEnv('EVIDENCE_STORAGE_TIMEOUT_MS', '500');
  vi.resetModules();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fs.rmSync(root, { recursive: true, force: true });
});
async function s3() {
  vi.stubEnv('EVIDENCE_STORAGE_DRIVER', 's3');
  vi.stubEnv('EVIDENCE_STORAGE_ENDPOINT', 'http://objects.example.test');
  vi.stubEnv('EVIDENCE_STORAGE_BUCKET', 'test-evidence');
  vi.stubEnv('EVIDENCE_STORAGE_ACCESS_KEY', 'TEST-ACCESS');
  vi.stubEnv('EVIDENCE_STORAGE_SECRET_KEY', 'TEST-SECRET');
  vi.stubEnv('EVIDENCE_STORAGE_AUTO_CREATE_BUCKET', 'false');
  vi.resetModules();
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  const { evidenceStorage } = await import('./evidenceStorage');
  const storage = evidenceStorage();
  await storage.healthcheck();
  return { storage, fetcher };
}
function chunks(parts: string[], cancel = vi.fn()) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(Buffer.from(part));
      controller.close();
    },
    cancel,
  });
}
describe('local private evidence storage', () => {
  it('writes, moves, reads and deletes opaque objects within the configured limit', async () => {
    const { evidenceStorage } = await import('./evidenceStorage');
    const storage = evidenceStorage();
    await storage.put(source, Buffer.from('%PDFtest'), 'application/pdf');
    await storage.move(source, destination, 'application/pdf');
    expect((await storage.get(destination))?.toString()).toBe('%PDFtest');
    await storage.delete(destination);
    expect(await storage.get(destination)).toBeNull();
  });
  it('rejects traversal and arbitrary keys', async () => {
    const { evidenceStorage } = await import('./evidenceStorage');
    await expect(
      evidenceStorage().put('../escape', Buffer.from('x'), 'text/plain'),
    ).rejects.toThrow(/Invalid private/);
  });
  it('rejects oversized local objects by stat before opening an allocation stream', async () => {
    const filename = path.join(root, 'test', source);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, '123456789');
    const stream = vi.spyOn(fs, 'createReadStream');
    const { evidenceStorage } = await import('./evidenceStorage');
    await expect(evidenceStorage().get(source)).rejects.toMatchObject({
      statusCode: 503,
      code: 'EVIDENCE_STORAGE_READ_LIMIT',
    });
    expect(stream).not.toHaveBeenCalled();
  });
  it('still bounds local reads when bytes grow after the stat check', async () => {
    const filename = path.join(root, 'test', source);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, '123456789');
    vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 1 } as fs.Stats);
    const { evidenceStorage } = await import('./evidenceStorage');
    await expect(evidenceStorage().get(source)).rejects.toMatchObject({
      code: 'EVIDENCE_STORAGE_READ_LIMIT',
    });
  });
  it('aborts a stalled local read within the configured deadline', async () => {
    const { evidenceStorage } = await import('./evidenceStorage');
    vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 1 } as fs.Stats);
    const stream = new Readable({ read() {} });
    vi.spyOn(fs, 'createReadStream').mockReturnValue(stream as fs.ReadStream);
    vi.useFakeTimers();
    const rejected = expect(evidenceStorage().get(source)).rejects.toMatchObject({
      code: 'EVIDENCE_STORAGE_TIMEOUT',
    });
    await vi.advanceTimersByTimeAsync(500);
    await rejected;
    expect(stream.destroyed).toBe(true);
  });
  it('bounds legacy file-path reads using the same allocation guard', async () => {
    const filename = path.join(root, 'legacy-evidence.pdf');
    fs.writeFileSync(filename, '123456789');
    const { readBoundedEvidenceFile } = await import('./evidenceStorage');
    await expect(readBoundedEvidenceFile(filename)).rejects.toMatchObject({
      code: 'EVIDENCE_STORAGE_READ_LIMIT',
    });
  });
});
describe('metadata-only evidence existence', () => {
  it('local checks regular nonempty files and reports empty or absent objects without a body read', async () => {
    const { evidenceStorage } = await import('./evidenceStorage');
    const storage = evidenceStorage();
    await storage.put(source, Buffer.from('1234'), 'application/pdf');
    const read = vi.spyOn(fs, 'createReadStream');
    expect(await storage.exists(source)).toBe(true);
    expect(await storage.exists(destination)).toBe(false);
    await storage.delete(source);
    await storage.put(source, Buffer.alloc(0), 'application/pdf');
    expect(await storage.exists(source)).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });
  it('local metadata rejects oversized files without reading them', async () => {
    const { evidenceStorage } = await import('./evidenceStorage');
    const storage = evidenceStorage();
    await storage.put(source, Buffer.alloc(9), 'application/pdf');
    const read = vi.spyOn(fs, 'createReadStream');
    await expect(storage.exists(source)).rejects.toMatchObject({
      code: 'EVIDENCE_STORAGE_READ_LIMIT',
    });
    expect(read).not.toHaveBeenCalled();
  });
  it('local metadata checks remain bounded when stat stalls', async () => {
    const { evidenceStorage } = await import('./evidenceStorage');
    vi.spyOn(fs.promises, 'stat').mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    const rejected = expect(evidenceStorage().exists(source)).rejects.toMatchObject({
      code: 'EVIDENCE_STORAGE_TIMEOUT',
    });
    await vi.advanceTimersByTimeAsync(500);
    await rejected;
  });
  it('S3 uses HEAD and valid length metadata without reading the object body', async () => {
    const { storage, fetcher } = await s3();
    const response = new Response(chunks(['object body must not be read']), {
      headers: { 'Content-Length': '4' },
    });
    const reader = vi.spyOn(response.body!, 'getReader');
    fetcher.mockResolvedValue(response);
    expect(await storage.exists(source)).toBe(true);
    expect(fetcher.mock.calls[1][1].method).toBe('HEAD');
    expect(reader).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(new Response(null, { headers: { 'Content-Length': '0' } }));
    expect(await storage.exists(source)).toBe(false);
    fetcher.mockResolvedValue(new Response(null, { status: 404 }));
    expect(await storage.exists(destination)).toBe(false);
  });
  it('S3 metadata fails closed for absent, malformed or oversized length', async () => {
    const { storage, fetcher } = await s3();
    for (const length of [null, 'bad', '9007199254740992', '9']) {
      fetcher.mockResolvedValue(
        new Response(null, { headers: length === null ? {} : { 'Content-Length': length } }),
      );
      await expect(storage.exists(source)).rejects.toMatchObject({
        code: length === '9' ? 'EVIDENCE_STORAGE_READ_LIMIT' : 'EVIDENCE_STORAGE_INVALID_RESPONSE',
      });
    }
  });
  it('S3 metadata failures retain safe errors and finite deadlines', async () => {
    const { storage, fetcher } = await s3();
    fetcher.mockResolvedValue(new Response(chunks(['provider secret']), { status: 500 }));
    await expect(storage.exists(source)).rejects.toThrow(
      'Unable to check private evidence object (500).',
    );
    fetcher.mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    const rejected = expect(storage.exists(source)).rejects.toMatchObject({
      code: 'EVIDENCE_STORAGE_TIMEOUT',
    });
    await vi.advanceTimersByTimeAsync(500);
    await rejected;
    expect(fetcher.mock.calls[2][1].signal.aborted).toBe(true);
  });
});

describe('bounded S3 evidence storage', () => {
  it('streams a valid known length without calling arrayBuffer', async () => {
    const { storage, fetcher } = await s3();
    const response = new Response(chunks(['1234', '5678']), { headers: { 'Content-Length': '8' } });
    const allocate = vi.spyOn(response, 'arrayBuffer');
    fetcher.mockResolvedValue(response);
    expect((await storage.get(source))?.toString()).toBe('12345678');
    expect(allocate).not.toHaveBeenCalled();
    expect(fetcher.mock.calls[1][1].signal).toBeInstanceOf(AbortSignal);
  });
  it('rejects an oversized declared length before acquiring the body reader', async () => {
    const { storage, fetcher } = await s3();
    const response = new Response(chunks(['SECRET']), {
      headers: { 'Content-Length': '1000000000' },
    });
    const reader = vi.spyOn(response.body!, 'getReader');
    const cancel = vi.spyOn(response.body!, 'cancel');
    fetcher.mockResolvedValue(response);
    await expect(storage.get(source)).rejects.toMatchObject({
      code: 'EVIDENCE_STORAGE_READ_LIMIT',
    });
    expect(reader).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
  });
  it('bounds unknown-length bodies and cancels before retaining an overflow chunk', async () => {
    const { storage, fetcher } = await s3();
    const response = new Response(chunks(['1234', '5678', '9']));
    const allocate = vi.spyOn(response, 'arrayBuffer');
    fetcher.mockResolvedValue(response);
    await expect(storage.get(source)).rejects.toMatchObject({
      code: 'EVIDENCE_STORAGE_READ_LIMIT',
    });
    expect(allocate).not.toHaveBeenCalled();
  });
  it('rejects malformed or inconsistent declared lengths', async () => {
    for (const length of ['not-a-number', '4']) {
      const { storage, fetcher } = await s3();
      fetcher.mockResolvedValue(
        new Response(chunks(['12345']), { headers: { 'Content-Length': length } }),
      );
      await expect(storage.get(source)).rejects.toMatchObject({
        code: 'EVIDENCE_STORAGE_INVALID_RESPONSE',
      });
    }
  });
  it('cancels opaque error bodies without reading or echoing provider secrets', async () => {
    const { storage, fetcher } = await s3();
    const response = new Response(chunks(['TEST-SECRET PRIVATE SIGNED URL']), { status: 500 });
    const text = vi.spyOn(response, 'text');
    const cancel = vi.spyOn(response.body!, 'cancel');
    fetcher.mockResolvedValue(response);
    await expect(storage.get(source)).rejects.toThrow(
      'Unable to read private evidence object (500).',
    );
    expect(text).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
  });
  it('aborts a stalled HTTP request, with finite deadlines for writes and deletes too', async () => {
    for (const operation of ['get', 'put', 'delete'] as const) {
      const { storage, fetcher } = await s3();
      fetcher.mockImplementation(() => new Promise(() => {}));
      vi.useFakeTimers();
      const pending =
        operation === 'get'
          ? storage.get(source)
          : operation === 'put'
            ? storage.put(source, Buffer.from('123'), 'application/pdf')
            : storage.delete(source);
      const rejected = expect(pending).rejects.toMatchObject({ code: 'EVIDENCE_STORAGE_TIMEOUT' });
      await vi.advanceTimersByTimeAsync(500);
      await rejected;
      expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
      vi.useRealTimers();
    }
  });
  it('keeps the deadline active while a successful response body stalls', async () => {
    const { storage, fetcher } = await s3();
    const cancel = vi.fn();
    fetcher.mockResolvedValue(new Response(new ReadableStream({ cancel })));
    vi.useFakeTimers();
    const rejected = expect(storage.get(source)).rejects.toMatchObject({
      code: 'EVIDENCE_STORAGE_TIMEOUT',
    });
    await vi.advanceTimersByTimeAsync(500);
    await rejected;
    expect(cancel).toHaveBeenCalled();
  });
  it('returns null for missing objects without reading their body', async () => {
    const { storage, fetcher } = await s3();
    const response = new Response(chunks(['not found']), { status: 404 });
    const reader = vi.spyOn(response.body!, 'getReader');
    fetcher.mockResolvedValue(response);
    expect(await storage.get(source)).toBeNull();
    expect(reader).not.toHaveBeenCalled();
  });
});
