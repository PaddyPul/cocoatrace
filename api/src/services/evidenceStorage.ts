import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env';

export interface EvidenceStorage {
  readonly provider: 'local' | 's3';
  put(objectKey: string, content: Buffer, contentType: string): Promise<void>;
  get(objectKey: string): Promise<Buffer | null>;
  delete(objectKey: string): Promise<void>;
  move(sourceKey: string, destinationKey: string, contentType: string): Promise<void>;
  healthcheck(): Promise<void>;
}

function assertObjectKey(objectKey: string): void {
  if (!new RegExp(`^(?:quarantine|evidence)/${config.environment}/[0-9a-f-]{36}$`).test(objectKey)) {
    throw new Error('Invalid private evidence object key');
  }
}

class LocalEvidenceStorage implements EvidenceStorage {
  readonly provider = 'local' as const;
  private readonly root = path.resolve(config.evidenceStorageLocalRoot, config.environment);
  private resolve(objectKey: string): string {
    assertObjectKey(objectKey);
    const resolved = path.resolve(this.root, objectKey);
    if (!resolved.startsWith(this.root + path.sep)) throw new Error('Evidence object escaped the private storage root');
    return resolved;
  }
  async put(objectKey: string, content: Buffer): Promise<void> {
    const destination = this.resolve(objectKey);
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    await fs.promises.writeFile(destination, content, { flag: 'wx', mode: 0o600 });
  }
  async get(objectKey: string): Promise<Buffer | null> {
    try { return await fs.promises.readFile(this.resolve(objectKey)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  async delete(objectKey: string): Promise<void> {
    await fs.promises.unlink(this.resolve(objectKey)).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
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

function sha256(value: string | Buffer): string { return crypto.createHash('sha256').update(value).digest('hex'); }
function hmac(key: Buffer | string, value: string): Buffer { return crypto.createHmac('sha256', key).update(value).digest(); }
function encodePath(value: string): string {
  return value.split('/').map((segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');
}

class S3EvidenceStorage implements EvidenceStorage {
  readonly provider = 's3' as const;
  private readonly endpoint = new URL(config.evidenceStorageEndpoint!);
  private readonly bucket = config.evidenceStorageBucket!;
  private readonly accessKey = config.evidenceStorageAccessKey!;
  private readonly secretKey = config.evidenceStorageSecretKey!;
  private bucketReady?: Promise<void>;
  private async request(method: string, objectKey?: string, content = Buffer.alloc(0), contentType?: string): Promise<Response> {
    if (objectKey) assertObjectKey(objectKey);
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256(content);
    const basePath = this.endpoint.pathname.replace(/\/$/, '');
    const resourcePath = objectKey ? `/${this.bucket}/${encodePath(objectKey)}` : `/${this.bucket}`;
    const canonicalUri = `${basePath}${resourcePath}` || '/';
    const headers: Record<string, string> = { host: this.endpoint.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
    if (method === 'PUT' && objectKey && config.evidenceStorageSse) headers['x-amz-server-side-encryption'] = config.evidenceStorageSse;
    const names = Object.keys(headers).sort();
    const canonicalHeaders = names.map((name) => `${name}:${headers[name].trim()}\n`).join('');
    const signedHeaders = names.join(';');
    const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const scope = `${dateStamp}/${config.evidenceStorageRegion}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${this.secretKey}`, dateStamp), config.evidenceStorageRegion), 's3'), 'aws4_request');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return fetch(new URL(canonicalUri, this.endpoint), {
      method,
      headers: { ...headers, Authorization: authorization, ...(contentType ? { 'Content-Type': contentType } : {}) },
      body: method === 'PUT' ? content : undefined,
    });
  }
  private ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      const method = config.evidenceStorageAutoCreateBucket ? 'PUT' : 'HEAD';
      this.bucketReady = this.request(method).then(async (response) => {
        if (!response.ok && !(method === 'PUT' && response.status === 409)) throw new Error(`Private evidence bucket is unavailable (${response.status}): ${await response.text()}`);
      });
    }
    return this.bucketReady;
  }
  async put(key: string, content: Buffer, type: string): Promise<void> {
    await this.ensureBucket(); const response = await this.request('PUT', key, Buffer.from(content), type);
    if (!response.ok) throw new Error(`Unable to write private evidence object (${response.status}): ${await response.text()}`);
  }
  async get(key: string): Promise<Buffer | null> {
    await this.ensureBucket(); const response = await this.request('GET', key);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Unable to read private evidence object (${response.status}): ${await response.text()}`);
    return Buffer.from(await response.arrayBuffer());
  }
  async delete(key: string): Promise<void> {
    await this.ensureBucket(); const response = await this.request('DELETE', key);
    if (!response.ok && response.status !== 404) throw new Error(`Unable to delete private evidence object (${response.status})`);
  }
  async move(source: string, destination: string, type: string): Promise<void> {
    const content = await this.get(source); if (!content) throw new Error('Quarantined evidence object is missing');
    await this.put(destination, content, type); await this.delete(source);
  }
  async healthcheck(): Promise<void> { await this.ensureBucket(); }
}

let storage: EvidenceStorage | undefined;
export function evidenceStorage(): EvidenceStorage {
  storage ||= config.evidenceStorageDriver === 's3' ? new S3EvidenceStorage() : new LocalEvidenceStorage();
  return storage;
}
export function resetEvidenceStorageForTests(): void { storage = undefined; }
