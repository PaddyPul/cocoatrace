import { compareOrdinal } from '../utils/ordinal';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env';
import { AppError } from '../errors';

export interface EvidenceStorage {
  readonly provider: 'local' | 's3';
  put(objectKey: string, content: Buffer, contentType: string): Promise<void>;
  get(objectKey: string): Promise<Buffer | null>;
  exists(objectKey: string): Promise<boolean>;
  delete(objectKey: string): Promise<void>;
  move(sourceKey: string, destinationKey: string, contentType: string): Promise<void>;
  healthcheck(): Promise<void>;
}

const readLimitError = () =>
  new AppError(
    'Private evidence object exceeds the configured read limit.',
    503,
    'EVIDENCE_STORAGE_READ_LIMIT',
  );
const timeoutError = () =>
  new AppError('Private evidence storage timed out. Retry later.', 503, 'EVIDENCE_STORAGE_TIMEOUT');
function assertReadSize(bytes: number): void {
  if (bytes > config.evidenceMaxFileBytes) throw readLimitError();
}
async function deadline<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(timeoutError());
    }, config.evidenceStorageTimeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function cancelResponse(response: Response): void {
  void response.body?.cancel().catch(() => undefined);
}
async function boundedResponse(response: Response, signal: AbortSignal): Promise<Buffer> {
  const declared = response.headers.get('content-length');
  if (declared !== null) {
    if (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared))) {
      cancelResponse(response);
      throw new AppError(
        'Private evidence storage returned an invalid object length.',
        503,
        'EVIDENCE_STORAGE_INVALID_RESPONSE',
      );
    }
    if (Number(declared) > config.evidenceMaxFileBytes) {
      cancelResponse(response);
      throw readLimitError();
    }
  }
  if (!response.body) {
    if (declared !== null && Number(declared) !== 0)
      throw new AppError(
        'Private evidence storage returned an inconsistent object length.',
        503,
        'EVIDENCE_STORAGE_INVALID_RESPONSE',
      );
    return Buffer.alloc(0);
  }
  const reader = response.body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  const chunks: Buffer[] = [];
  let bytes = 0;
  try {
    while (true) {
      if (signal.aborted) throw timeoutError();
      const chunk = await reader.read();
      if (signal.aborted) throw timeoutError();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      assertReadSize(bytes);
      chunks.push(Buffer.from(chunk.value));
    }
    if (declared !== null && bytes !== Number(declared))
      throw new AppError(
        'Private evidence storage returned an inconsistent object length.',
        503,
        'EVIDENCE_STORAGE_INVALID_RESPONSE',
      );
    return Buffer.concat(chunks, bytes);
  } finally {
    signal.removeEventListener('abort', cancel);
    cancel();
  }
}

export async function readBoundedEvidenceFile(filename: string): Promise<Buffer> {
  return deadline(async (signal) => {
    const stat = await fs.promises.stat(filename);
    assertReadSize(stat.size);
    if (signal.aborted) throw timeoutError();
    const stream = fs.createReadStream(filename, {
      highWaterMark: Math.min(64 * 1024, config.evidenceMaxFileBytes + 1),
    });
    const cancel = () => stream.destroy(timeoutError());
    signal.addEventListener('abort', cancel, { once: true });
    let bytes = 0;
    const chunks: Buffer[] = [];
    try {
      for await (const raw of stream) {
        if (signal.aborted) throw timeoutError();
        const chunk = raw as Buffer;
        bytes += chunk.length;
        assertReadSize(bytes);
        chunks.push(chunk);
      }
      if (signal.aborted) throw timeoutError();
      return Buffer.concat(chunks, bytes);
    } finally {
      signal.removeEventListener('abort', cancel);
      stream.destroy();
    }
  });
}

function assertObjectKey(objectKey: string): void {
  if (
    !new RegExp(`^(?:quarantine|evidence)/${config.environment}/[0-9a-f-]{36}$`).test(objectKey)
  ) {
    throw new Error('Invalid private evidence object key');
  }
}

class LocalEvidenceStorage implements EvidenceStorage {
  readonly provider = 'local' as const;
  private readonly root = path.resolve(config.evidenceStorageLocalRoot, config.environment);
  private resolve(objectKey: string): string {
    assertObjectKey(objectKey);
    const resolved = path.resolve(this.root, objectKey);
    if (!resolved.startsWith(this.root + path.sep))
      throw new Error('Evidence object escaped the private storage root');
    return resolved;
  }
  async put(objectKey: string, content: Buffer): Promise<void> {
    const destination = this.resolve(objectKey);
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    await fs.promises.writeFile(destination, content, { flag: 'wx', mode: 0o600 });
  }
  async get(objectKey: string): Promise<Buffer | null> {
    const filename = this.resolve(objectKey);
    try {
      return await readBoundedEvidenceFile(filename);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
  async exists(objectKey: string): Promise<boolean> {
    const filename = this.resolve(objectKey);
    try {
      return await deadline(async (signal) => {
        const stat = await fs.promises.stat(filename);
        if (signal.aborted) throw timeoutError();
        if (!stat.isFile()) return false;
        assertReadSize(stat.size);
        return stat.size > 0;
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }
  async delete(objectKey: string): Promise<void> {
    await fs.promises.unlink(this.resolve(objectKey)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  async move(sourceKey: string, destinationKey: string): Promise<void> {
    const destination = this.resolve(destinationKey);
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    await fs.promises.rename(this.resolve(sourceKey), destination);
  }
  async healthcheck(): Promise<void> {
    await fs.promises.mkdir(this.root, { recursive: true });
    await fs.promises.access(this.root, fs.constants.R_OK | fs.constants.W_OK);
  }
}

// Normal upload buffers are ArrayBuffer-backed: send a view without duplicating
// file bytes. A rare SharedArrayBuffer-backed caller is copied for BodyInit compatibility.
function requestBody(content: Buffer): Uint8Array<ArrayBuffer> {
  return content.buffer instanceof ArrayBuffer
    ? new Uint8Array(content.buffer, content.byteOffset, content.byteLength)
    : new Uint8Array(content);
}

function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function hmac(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac('sha256', key).update(value).digest();
}
function encodePath(value: string): string {
  return value
    .split('/')
    .map((segment) =>
      encodeURIComponent(segment).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/');
}

class S3EvidenceStorage implements EvidenceStorage {
  readonly provider = 's3' as const;
  private readonly endpoint = new URL(config.evidenceStorageEndpoint!);
  private readonly bucket = config.evidenceStorageBucket!;
  private readonly accessKey = config.evidenceStorageAccessKey!;
  private readonly secretKey = config.evidenceStorageSecretKey!;
  private bucketReady?: Promise<void>;
  private async request(
    method: string,
    objectKey?: string,
    content: Buffer = Buffer.alloc(0),
    contentType?: string,
  ): Promise<{ ok: boolean; status: number; content?: Buffer; size?: number }> {
    if (objectKey) assertObjectKey(objectKey);
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256(content);
    const basePath = this.endpoint.pathname.replace(/\/$/, '');
    const resourcePath = objectKey ? `/${this.bucket}/${encodePath(objectKey)}` : `/${this.bucket}`;
    const canonicalUri = `${basePath}${resourcePath}` || '/';
    const headers: Record<string, string> = {
      host: this.endpoint.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    if (method === 'PUT' && objectKey && config.evidenceStorageSse)
      headers['x-amz-server-side-encryption'] = config.evidenceStorageSse;
    const names = Object.keys(headers).sort(compareOrdinal);
    const canonicalHeaders = names.map((name) => `${name}:${headers[name].trim()}\n`).join('');
    const signedHeaders = names.join(';');
    const canonicalRequest = [
      method,
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const scope = `${dateStamp}/${config.evidenceStorageRegion}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${this.secretKey}`, dateStamp), config.evidenceStorageRegion), 's3'),
      'aws4_request',
    );
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return deadline(async (signal) => {
      try {
        const response = await fetch(new URL(canonicalUri, this.endpoint), {
          method,
          signal,
          headers: {
            ...headers,
            Authorization: authorization,
            ...(contentType ? { 'Content-Type': contentType } : {}),
          },
          body: method === 'PUT' ? requestBody(content) : undefined,
        });
        const result = { ok: response.ok, status: response.status };
        if (method === 'HEAD' && objectKey && response.ok) {
          const declared = response.headers.get('content-length');
          cancelResponse(response);
          if (
            declared === null ||
            !/^\d+$/.test(declared) ||
            !Number.isSafeInteger(Number(declared))
          )
            throw new AppError(
              'Private evidence storage returned an invalid object length.',
              503,
              'EVIDENCE_STORAGE_INVALID_RESPONSE',
            );
          const size = Number(declared);
          assertReadSize(size);
          return { ...result, size };
        }
        if (method === 'GET' && response.ok)
          return { ...result, content: await boundedResponse(response, signal) };
        // Provider bodies can contain credentials, URLs or arbitrary large XML.
        // Operation/status are enough to report failure without reading them.
        cancelResponse(response);
        return result;
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (signal.aborted) throw timeoutError();
        throw new AppError(
          'Private evidence storage request failed. Retry later.',
          503,
          'EVIDENCE_STORAGE_UNAVAILABLE',
        );
      }
    });
  }

  private ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      const method = config.evidenceStorageAutoCreateBucket ? 'PUT' : 'HEAD';
      this.bucketReady = this.request(method)
        .then((response) => {
          if (!response.ok && !(method === 'PUT' && response.status === 409))
            throw new AppError(
              `Private evidence bucket is unavailable (${response.status}).`,
              503,
              'EVIDENCE_STORAGE_UNAVAILABLE',
            );
        })
        .catch((error) => {
          this.bucketReady = undefined;
          throw error;
        });
    }
    return this.bucketReady;
  }
  async put(key: string, content: Buffer, type: string): Promise<void> {
    await this.ensureBucket();
    const response = await this.request('PUT', key, content, type);
    if (!response.ok)
      throw new AppError(
        `Unable to write private evidence object (${response.status}).`,
        503,
        'EVIDENCE_STORAGE_UNAVAILABLE',
      );
  }
  async get(key: string): Promise<Buffer | null> {
    await this.ensureBucket();
    const response = await this.request('GET', key);
    if (response.status === 404) return null;
    if (!response.ok)
      throw new AppError(
        `Unable to read private evidence object (${response.status}).`,
        503,
        'EVIDENCE_STORAGE_UNAVAILABLE',
      );
    return response.content!;
  }
  async exists(key: string): Promise<boolean> {
    await this.ensureBucket();
    const response = await this.request('HEAD', key);
    if (response.status === 404) return false;
    if (!response.ok)
      throw new AppError(
        `Unable to check private evidence object (${response.status}).`,
        503,
        'EVIDENCE_STORAGE_UNAVAILABLE',
      );
    return response.size! > 0;
  }
  async delete(key: string): Promise<void> {
    await this.ensureBucket();
    const response = await this.request('DELETE', key);
    if (!response.ok && response.status !== 404)
      throw new AppError(
        `Unable to delete private evidence object (${response.status}).`,
        503,
        'EVIDENCE_STORAGE_UNAVAILABLE',
      );
  }
  async move(source: string, destination: string, type: string): Promise<void> {
    const content = await this.get(source);
    if (!content) throw new Error('Quarantined evidence object is missing');
    await this.put(destination, content, type);
    await this.delete(source);
  }
  async healthcheck(): Promise<void> {
    await this.ensureBucket();
  }
}

let storage: EvidenceStorage | undefined;
export function evidenceStorage(): EvidenceStorage {
  storage ||=
    config.evidenceStorageDriver === 's3' ? new S3EvidenceStorage() : new LocalEvidenceStorage();
  return storage;
}
export function resetEvidenceStorageForTests(): void {
  storage = undefined;
}
