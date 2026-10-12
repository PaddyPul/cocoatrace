import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import http from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import app from '../../src/app';
import { config } from '../../src/config/env';
import { pool, query } from '../../src/db';
import { evidenceStorage } from '../../src/services/evidenceStorage';
import { evidenceConcurrency } from '../../src/modules/security/evidenceConcurrency';

type Actor = { org: string; user: string; farm: string; token: string };
let owner: Actor;
const intents: string[] = [];
const evidenceIds: string[] = [];
const content = Buffer.from('%PDF-1.7\nTransfer budget fixture');
async function intent() {
  const response = await request(app)
    .post('/evidence/upload-intents')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({
      type: 'other',
      fileName: 'transfer.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: content.length,
      linkedEntityType: 'farm',
      linkedEntityId: owner.farm,
      claimDescription: 'Transfer resource boundary fixture',
    });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  intents.push(response.body.intentId);
  return response.body as { intentId: string; uploadUrl: string };
}
async function pending(id: string) {
  expect(
    (await query('SELECT status FROM evidence_upload_intents WHERE id=$1', [id])).rows[0].status,
  ).toBe('pending');
}
async function evidenceRecord(key: string) {
  const id = (
    await query(
      `INSERT INTO evidence_items
    (uploader_user_id,uploader_organization_id,type,file_name,file_size_bytes,mime_type,sha256_hash,storage_key,storage_provider,validation_status,malware_scan_status,linked_entity_type,linked_entity_id,claim_description)
    VALUES($1,$2,'other','transfer.pdf',$3,'application/pdf','sha256:transfer-budget',$4,$5,'validated','clean','farm',$6,'Transfer budget fixture') RETURNING id`,
      [owner.user, owner.org, content.length, key, evidenceStorage().provider, owner.farm],
    )
  ).rows[0].id;
  evidenceIds.push(id);
  return String(id);
}
function assertTenantReleased() {
  const releases: (() => void)[] = [];
  try {
    releases.push(evidenceConcurrency.acquire(owner.org));
    releases.push(evidenceConcurrency.acquire(owner.org));
  } finally {
    releases.forEach((release) => release());
  }
}
beforeAll(async () => {
  const tag = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Transfer budgets ' + tag],
    )
  ).rows[0].id;
  const email = `transfer-budgets-${tag}@integration.test`;
  const user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, email, await bcrypt.hash('TransferBudgets123!', 4), 'Transfer tester'],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      'transfer-budgets-' + tag,
      ['evidence.upload', 'evidence.read'],
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const farm = (
    await query(
      "INSERT INTO farms(farmer_organization_id,name,country,region,district) VALUES($1,'Transfer farm','GH','Northern','Tamale') RETURNING id",
      [org],
    )
  ).rows[0].id;
  const login = await request(app)
    .post('/auth/login')
    .send({ email, password: 'TransferBudgets123!' });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  owner = { org, user, farm, token: login.body.accessToken };
});
afterAll(async () => {
  try {
    if (intents.length)
      await query('DELETE FROM evidence_upload_intents WHERE id=ANY($1::uuid[])', [intents]);
    if (evidenceIds.length)
      await query('DELETE FROM evidence_items WHERE id=ANY($1::uuid[])', [evidenceIds]);
  } finally {
    await pool.end();
  }
});
describe('signed evidence content admission and finite transfer budgets', () => {
  it('rejects invalid signatures before the raw-body size parser and leaves trusted intent untouched', async () => {
    const upload = await intent();
    const invalid = upload.uploadUrl.replace(/signature=[0-9a-f]+/, 'signature=' + '0'.repeat(64));
    const response = await request(app)
      .put(invalid)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.alloc(config.evidenceMaxFileBytes + 1));
    expect(response.status, JSON.stringify(response.body)).toBe(403);
    await pending(upload.intentId);
    assertTenantReleased();
  });
  it('does not let a spoofed JSON content type bypass signed admission through the application JSON parser', async () => {
    const upload = await intent();
    const invalid = upload.uploadUrl.replace(/signature=[0-9a-f]+/, 'signature=' + '0'.repeat(64));
    const response = await request(app)
      .put(invalid)
      .set('Content-Type', 'application/json')
      .send(
        JSON.stringify({
          payload: 'x'.repeat(Math.max(config.evidenceMaxFileBytes + 1, 128 * 1024)),
        }),
      );
    expect(response.status, JSON.stringify(response.body)).toBe(403);
    await pending(upload.intentId);
    assertTenantReleased();
  });
  it('rejects absent and correctly signed expired intents before parsing untrusted body bytes', async () => {
    const missing = `/evidence/upload-intents/${crypto.randomUUID()}/content?expires=${Math.floor(Date.now() / 1000) + 60}&signature=${'0'.repeat(64)}`;
    const absent = await request(app)
      .put(missing)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.alloc(config.evidenceMaxFileBytes + 1));
    expect(absent.status, JSON.stringify(absent.body)).toBe(404);
    const upload = await intent();
    const expires = Math.floor(Date.now() / 1000) - 60;
    const row = (
      await query(
        'UPDATE evidence_upload_intents SET expires_at=to_timestamp($2) WHERE id=$1 RETURNING quarantine_object_key',
        [upload.intentId, expires],
      )
    ).rows[0];
    const signature = crypto
      .createHmac('sha256', config.evidenceUploadSigningSecret)
      .update(`${upload.intentId}.${row.quarantine_object_key}.${expires}`)
      .digest('hex');
    const expired = await request(app)
      .put(
        `/evidence/upload-intents/${upload.intentId}/content?expires=${expires}&signature=${signature}`,
      )
      .set('Content-Type', 'application/pdf')
      .send(Buffer.alloc(config.evidenceMaxFileBytes + 1));
    expect(expired.status, JSON.stringify(expired.body)).toBe(410);
    expect(expired.body.code).toBe('UPLOAD_INTENT_EXPIRED');
    await pending(upload.intentId);
    assertTenantReleased();
  });
  it('enforces tenant admission before body parsing without changing a pending upload', async () => {
    const upload = await intent();
    const first = evidenceConcurrency.acquire(owner.org),
      second = evidenceConcurrency.acquire(owner.org);
    try {
      const response = await request(app)
        .put(upload.uploadUrl)
        .set('Content-Type', 'application/pdf')
        .send(Buffer.alloc(config.evidenceMaxFileBytes + 1));
      expect(response.status, JSON.stringify(response.body)).toBe(503);
      await pending(upload.intentId);
    } finally {
      first();
      second();
    }
    assertTenantReleased();
  });
  it('enforces the shared global budget across different tenants before parsing', async () => {
    const upload = await intent();
    const releases: (() => void)[] = [];
    try {
      for (let n = 0; n < 4; n++) releases.push(evidenceConcurrency.acquire(crypto.randomUUID()));
      const response = await request(app)
        .put(upload.uploadUrl)
        .set('Content-Type', 'application/pdf')
        .send(Buffer.alloc(config.evidenceMaxFileBytes + 1));
      expect(response.status, JSON.stringify(response.body)).toBe(503);
      await pending(upload.intentId);
    } finally {
      releases.forEach((release) => release());
    }
    assertTenantReleased();
  });
  it('releases admission after an oversized body parser error and leaves the signed intent reusable', async () => {
    const upload = await intent();
    const response = await request(app)
      .put(upload.uploadUrl)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.alloc(config.evidenceMaxFileBytes + 1));
    expect(response.status, JSON.stringify(response.body)).toBe(413);
    await pending(upload.intentId);
    assertTenantReleased();
  });
  it('releases admission after authoritative controller validation rejects a mismatched body', async () => {
    const upload = await intent();
    const response = await request(app)
      .put(upload.uploadUrl)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-1.7\nwrong size'));
    expect(response.status, JSON.stringify(response.body)).toBe(400);
    expect(
      (await query('SELECT status FROM evidence_upload_intents WHERE id=$1', [upload.intentId]))
        .rows[0].status,
    ).toBe('rejected');
    assertTenantReleased();
  });
  it('shares tenant admission between stalled authorized downloads and signed uploads and releases on response completion', async () => {
    const key = `evidence/${config.environment}/${crypto.randomUUID()}`;
    const id = await evidenceRecord(key);
    const upload = await intent();
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let finish!: (value: Buffer) => void;
    const stalled = new Promise<Buffer>((resolve) => {
      finish = resolve;
    });
    const spy = vi.spyOn(evidenceStorage(), 'get').mockImplementation(async () => {
      entered();
      return stalled;
    });
    const download = request(app)
      .get(`/evidence/${id}/download`)
      .set('Authorization', `Bearer ${owner.token}`)
      .then((response) => response);
    let reserved: (() => void) | undefined;
    try {
      await started;
      reserved = evidenceConcurrency.acquire(owner.org);
      const denied = await request(app)
        .put(upload.uploadUrl)
        .set('Content-Type', 'application/pdf')
        .send(content);
      expect(denied.status, JSON.stringify(denied.body)).toBe(503);
      expect(denied.body.code).toBe('EVIDENCE_TRANSFER_BUSY');
      await pending(upload.intentId);
      reserved();
      reserved = undefined;
      finish(content);
      expect((await download).status).toBe(200);
      assertTenantReleased();
    } finally {
      reserved?.();
      finish(content);
      await download;
      spy.mockRestore();
    }
  });
  it('does not free a disconnected download slot until its underlying storage read settles', async () => {
    const id = await evidenceRecord(`evidence/${config.environment}/${crypto.randomUUID()}`);
    const upload = await intent();
    let entered!: () => void, finish!: (value: Buffer) => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const stalled = new Promise<Buffer>((resolve) => {
      finish = resolve;
    });
    const spy = vi.spyOn(evidenceStorage(), 'get').mockImplementation(async () => {
      entered();
      return stalled;
    });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const client = http.get({
      host: '127.0.0.1',
      port: (server.address() as AddressInfo).port,
      path: `/evidence/${id}/download`,
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    client.on('error', () => undefined);
    let reserved: (() => void) | undefined;
    try {
      await started;
      const closed = new Promise<void>((resolve) => client.once('close', resolve));
      client.destroy();
      await closed;
      reserved = evidenceConcurrency.acquire(owner.org);
      const denied = await request(app)
        .put(upload.uploadUrl)
        .set('Content-Type', 'application/pdf')
        .send(content);
      expect(denied.status, JSON.stringify(denied.body)).toBe(503);
      expect(denied.body.code).toBe('EVIDENCE_TRANSFER_BUSY');
      await pending(upload.intentId);
      reserved();
      reserved = undefined;
    } finally {
      reserved?.();
      finish(content);
      client.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      spy.mockRestore();
    }
    await expect.poll(() => evidenceConcurrency.snapshot().activeTransfers).toBe(0);
    assertTenantReleased();
  });
  it('refuses oversized stored object bytes before returning an authorized download and releases capacity', async () => {
    const storage = evidenceStorage();
    const key = `evidence/${config.environment}/${crypto.randomUUID()}`;
    // Provider corruption can exceed the declared database size. The real
    // adapter must enforce its own byte boundary independently of metadata.
    await storage.put(key, Buffer.alloc(config.evidenceMaxFileBytes + 1), 'application/pdf');
    const id = await evidenceRecord(key);
    try {
      const response = await request(app)
        .get(`/evidence/${id}/download`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(response.status, JSON.stringify(response.body)).toBe(503);
      expect(response.body.code).toBe('EVIDENCE_STORAGE_READ_LIMIT');
      expect(response.headers['content-disposition']).toBeUndefined();
      assertTenantReleased();
    } finally {
      await storage.delete(key);
    }
  });
});
