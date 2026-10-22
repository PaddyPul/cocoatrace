import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { config } from '../../src/config/env';
import { evidenceStorage } from '../../src/services/evidenceStorage';
import { createActor, createSupply, type FixtureActor } from './support/fixtures';
let owner: FixtureActor, other: FixtureActor, foreign: FixtureActor, farm: string, batch: string;
const keys: string[] = [];
const evidenceIds: string[] = [];
const recalls: string[] = [];
const bytes = Buffer.from('%PDF-1.7\nTimed evidence fixture');
const headers = (actor: FixtureActor) => ({ Authorization: `Bearer ${actor.token}` });
beforeAll(async () => {
  owner = await createActor({
    type: 'exporter',
    permissions: ['evidence.upload', 'evidence.read', 'certificate.read', 'recall.manage'],
  });
  other = await createActor({
    type: 'importer',
    permissions: ['evidence.read', 'certificate.read'],
  });
  foreign = await createActor({
    type: 'importer',
    permissions: ['evidence.read', 'certificate.read'],
  });
  farm = String(
    (
      await query(
        "INSERT INTO farms(farmer_organization_id,name,country,region,district) VALUES($1,'Timed fixture','GH','Northern','Tamale') RETURNING id",
        [owner.organizationId],
      )
    ).rows[0].id,
  );
  batch = (await createSupply(owner, { quantityKg: 100, crop: 'cocoa' })).batchId;
  await query(
    "INSERT INTO material_lots(lot_code,lot_type,batch_id,product_name,quantity_kg,owner_organization_id) VALUES($1,'source',$2,'Cocoa fixture',100,$3)",
    [`timed-${crypto.randomUUID()}`, batch, owner.organizationId],
  );
});
afterEach(async () => {
  vi.restoreAllMocks();
  await query('DELETE FROM evidence_object_cleanup WHERE organization_id=$1', [
    owner.organizationId,
  ]);
  await query('DELETE FROM evidence_upload_intents WHERE uploader_organization_id=$1', [
    owner.organizationId,
  ]);
  if (recalls.length)
    await query("UPDATE recall_notices SET status='resolved' WHERE id=ANY($1::uuid[])", [
      recalls.splice(0),
    ]);
  if (evidenceIds.length)
    await query('DELETE FROM evidence_items WHERE id=ANY($1::uuid[])', [evidenceIds.splice(0)]);
  await query('DELETE FROM organic_certificates WHERE certifier_organization_id=$1', [
    owner.organizationId,
  ]);
  for (const key of keys.splice(0)) await evidenceStorage().delete(key);
});
afterAll(() => pool.end());
async function proof(expiresAt: string | null = null) {
  const key = `evidence/${config.environment}/${crypto.randomUUID()}`;
  keys.push(key);
  await evidenceStorage().put(key, bytes, 'application/pdf');
  const id = String(
    (
      await query(
        `INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,file_size_bytes,mime_type,sha256_hash,storage_key,storage_provider,validation_status,malware_scan_status,review_status,linked_entity_type,linked_entity_id,claim_description,document_expires_at)
 VALUES($1,$2,'other','timed.pdf',$3,'application/pdf','sha256:timed',$4,$5,'validated','clean','submitted','farm',$6,'Timed fixture',$7) RETURNING id`,
        [
          owner.userId,
          owner.organizationId,
          bytes.length,
          key,
          evidenceStorage().provider,
          farm,
          expiresAt,
        ],
      )
    ).rows[0].id,
  );
  evidenceIds.push(id);
  return id;
}
async function link(id: string, actor = owner) {
  return request(app).post(`/evidence/${id}/download-links`).set(headers(actor)).send({});
}
async function feed(actor = owner) {
  const response = await request(app).get('/notifications/page?limit=100').set(headers(actor));
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body;
}
async function recall(hours = 12) {
  const response = await request(app)
    .post('/recalls')
    .set(headers(owner))
    .send({
      referenceCode: `timed-${crypto.randomUUID()}`,
      title: 'Timed recall',
      reason: 'Fixture safety issue',
      instructions: 'Hold stock and acknowledge',
      severity: 'warning',
      batchIds: [batch],
      acknowledgementDeadlineHours: hours,
    });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  const id = String(response.body.id);
  recalls.push(id);
  await query(
    'INSERT INTO recall_participants(recall_id,organization_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [id, other.organizationId],
  );
  return id;
}
it('issues private session-bound links, preserves attachment headers and denies foreign or anonymous requests', async () => {
  const id = await proof();
  const issued = await link(id);
  expect(issued.status).toBe(201);
  expect(issued.body.lifetimeSeconds).toBe(60);
  const got = await request(app).get(issued.body.downloadUrl).set(headers(owner));
  expect(got.status).toBe(200);
  expect(got.headers['content-disposition']).toContain('attachment;');
  expect(got.headers['cache-control']).toBe('no-store');
  expect((await request(app).get(issued.body.downloadUrl)).status).toBe(401);
  expect((await request(app).get(issued.body.downloadUrl).set(headers(foreign))).status).toBe(403);
  expect((await link(id, foreign)).status).toBe(403);
});
it('rejects expired and tampered links before any byte release', async () => {
  const id = await proof();
  const issued = await link(id);
  const now = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 61000);
  expect((await request(app).get(issued.body.downloadUrl).set(headers(owner))).status).toBe(410);
  clock.mockRestore();
  const tampered = issued.body.downloadUrl.replace(
    /signature=[a-f0-9]+/,
    'signature=' + '0'.repeat(64),
  );
  expect((await request(app).get(tampered).set(headers(owner))).status).toBe(403);
});
it('reauthorizes scan state and live permissions at link redemption', async () => {
  const id = await proof();
  const issued = await link(id);
  await query("UPDATE evidence_items SET malware_scan_status='infected' WHERE id=$1", [id]);
  expect((await request(app).get(issued.body.downloadUrl).set(headers(owner))).status).toBe(423);
  await query("UPDATE evidence_items SET malware_scan_status='clean' WHERE id=$1", [id]);
  await query(
    "UPDATE roles SET permissions=array_remove(permissions,'evidence.read') WHERE id=$1",
    [owner.roleId],
  );
  try {
    expect((await request(app).get(issued.body.downloadUrl).set(headers(owner))).status).toBe(403);
  } finally {
    await query(
      "UPDATE roles SET permissions=array_append(permissions,'evidence.read') WHERE id=$1",
      [owner.roleId],
    );
  }
});
it('invalidates links after session revocation without granting a replacement session their authority', async () => {
  const id = await proof();
  const issued = await link(id);
  await query('UPDATE sessions SET revoked_at=NOW() WHERE user_id=$1', [owner.userId]);
  expect((await request(app).get(issued.body.downloadUrl).set(headers(owner))).status).toBe(401);
  const login = await request(app)
    .post('/auth/login')
    .send({ email: owner.email, password: owner.password });
  expect(login.status).toBe(200);
  owner.token = login.body.accessToken;
  expect((await request(app).get(issued.body.downloadUrl).set(headers(owner))).status).toBe(403);
  expect((await link(id)).status).toBe(201);
});
it('rechecks expiry after a slow provider read and withholds attachment bytes', async () => {
  const id = await proof();
  const issued = await link(id);
  const now = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
  vi.spyOn(evidenceStorage(), 'get').mockImplementation(async () => {
    clock.mockReturnValue(now + 61000);
    return bytes;
  });
  const response = await request(app).get(issued.body.downloadUrl).set(headers(owner));
  expect(response.status).toBe(410);
  expect(response.headers['content-disposition']).toBeUndefined();
});
it('withholds bytes when the source becomes infected while the provider read is pending', async () => {
  const id = await proof();
  const issued = await link(id);
  vi.spyOn(evidenceStorage(), 'get').mockImplementation(async () => {
    await query("UPDATE evidence_items SET malware_scan_status='infected' WHERE id=$1", [id]);
    return bytes;
  });
  const response = await request(app).get(issued.body.downloadUrl).set(headers(owner));
  expect(response.status).toBe(423);
  expect(response.headers['content-disposition']).toBeUndefined();
});
it('persists uploader-recorded expiry through upload and shows private renewal reminders', async () => {
  const expiresAt = new Date(Date.now() + 86400000).toISOString();
  const upload = await request(app).post('/evidence/upload-intents').set(headers(owner)).send({
    type: 'other',
    fileName: 'renew.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: bytes.length,
    linkedEntityType: 'farm',
    linkedEntityId: farm,
    claimDescription: 'Renewal fixture',
    documentExpiresAt: expiresAt,
  });
  expect(upload.status, JSON.stringify(upload.body)).toBe(201);
  const complete = await request(app)
    .put(upload.body.uploadUrl)
    .set('Content-Type', 'application/pdf')
    .send(bytes);
  expect(complete.status, JSON.stringify(complete.body)).toBe(201);
  const id = complete.body.id;
  evidenceIds.push(id);
  const stored = (
    await query('SELECT document_expires_at,storage_key FROM evidence_items WHERE id=$1', [id])
  ).rows[0];
  keys.push(stored.storage_key);
  expect(new Date(stored.document_expires_at).toISOString()).toBe(expiresAt);
  const notices = await feed();
  expect(
    notices.items.some((n: { actionPath: string }) => n.actionPath === `/evidence?search=${id}`),
  ).toBe(true);
  expect(
    (await feed(foreign)).items.some(
      (n: { actionPath: string }) => n.actionPath === `/evidence?search=${id}`,
    ),
  ).toBe(false);
});
it('excludes unknown, distant and superseded expiry while preserving expired-document reminders', async () => {
  const unknown = await proof();
  const distant = await proof(new Date(Date.now() + 40 * 86400000).toISOString());
  const expired = await proof(new Date(Date.now() - 86400000).toISOString());
  const soon = await proof(new Date(Date.now() + 86400000).toISOString());
  await query('UPDATE evidence_items SET superseded_by_evidence_id=$2 WHERE id=$1', [
    soon,
    expired,
  ]);
  const notices = (await feed()).items;
  for (const id of [unknown, distant, soon])
    expect(
      notices.some((n: { actionPath: string }) => n.actionPath === `/evidence?search=${id}`),
    ).toBe(false);
  expect(
    notices.find((n: { actionPath: string }) => n.actionPath === `/evidence?search=${expired}`)
      ?.title,
  ).toBe('Document expired');
});
it('uses UTC certificate validity, suppresses revoked records, and reopens unread renewal when expiry changes', async () => {
  const id = String(
    (
      await query(
        `INSERT INTO organic_certificates(certifier_organization_id,farmer_organization_id,farm_id,valid_from,valid_to,issuing_authority,accreditation_reference) VALUES($1,$2,$3,CURRENT_DATE-1,CURRENT_DATE+10,'Fixture','Fixture') RETURNING id`,
        [owner.organizationId, other.organizationId, farm],
      )
    ).rows[0].id,
  );
  const initial = (await feed()).items.find(
    (n: { actionPath: string }) => n.actionPath === `/certs?search=${id}`,
  );
  expect(initial).toBeTruthy();
  expect(
    (
      await request(app)
        .post(`/notifications/${initial.fingerprint}/read`)
        .set(headers(owner))
        .send({ read: true })
    ).status,
  ).toBe(200);
  await query('UPDATE organic_certificates SET valid_to=CURRENT_DATE-1 WHERE id=$1', [id]);
  const expired = (await feed()).items.find(
    (n: { actionPath: string }) => n.actionPath === `/certs?search=${id}`,
  );
  expect(expired.title).toBe('Certificate expired');
  expect(expired.read).toBe(false);
  expect(expired.fingerprint).not.toBe(initial.fingerprint);
  await query("UPDATE organic_certificates SET status='revoked' WHERE id=$1", [id]);
  expect(
    (await feed()).items.some(
      (n: { actionPath: string }) => n.actionPath === `/certs?search=${id}`,
    ),
  ).toBe(false);
});
it('snapshots recall deadlines, automatically exposes overdue participant/manager tasks and clears them only on acknowledgement', async () => {
  const id = await recall();
  const recorded = (
    await query('SELECT acknowledgement_due_at,initiated_at FROM recall_notices WHERE id=$1', [id])
  ).rows[0];
  expect(
    new Date(recorded.acknowledgement_due_at).getTime() - new Date(recorded.initiated_at).getTime(),
  ).toBe(12 * 3600000);
  await query(
    "UPDATE recall_notices SET acknowledgement_due_at=NOW()-INTERVAL '1 minute' WHERE id=$1",
    [id],
  );
  const participant = (await feed(other)).items.find(
    (n: { actionPath: string }) => n.actionPath === `/recalls?recallId=${id}`,
  );
  expect(participant.title).toBe('Recall acknowledgement overdue');
  expect(
    (await feed(owner)).items.some(
      (n: { actionPath: string }) => n.actionPath === `/recalls?recallId=${id}`,
    ),
  ).toBe(true);
  expect(
    (await feed(foreign)).items.some(
      (n: { actionPath: string }) => n.actionPath === `/recalls?recallId=${id}`,
    ),
  ).toBe(false);
  await request(app)
    .post(`/notifications/${participant.fingerprint}/read`)
    .set(headers(other))
    .send({ read: true });
  expect(
    (
      await query(
        'SELECT acknowledged_at FROM recall_participants WHERE recall_id=$1 AND organization_id=$2',
        [id, other.organizationId],
      )
    ).rows[0].acknowledged_at,
  ).toBeNull();
  const holds = Number(
    (await query('SELECT count(*) FROM recall_safety_holds WHERE recall_id=$1', [id])).rows[0]
      .count,
  );
  expect(
    (
      await request(app)
        .post(`/recalls/${id}/acknowledge`)
        .set(headers(other))
        .send({ note: 'Reviewed and received' })
    ).status,
  ).toBe(200);
  expect(
    (await feed(other)).items.some(
      (n: { actionPath: string }) => n.actionPath === `/recalls?recallId=${id}`,
    ),
  ).toBe(false);
  expect(
    Number(
      (await query('SELECT count(*) FROM recall_safety_holds WHERE recall_id=$1', [id])).rows[0]
        .count,
    ),
  ).toBe(holds);
});
it('rejects invalid acknowledgement deadlines without activating a recall', async () => {
  const response = await request(app)
    .post('/recalls')
    .set(headers(owner))
    .send({
      referenceCode: 'invalid-deadline',
      title: 'Invalid fixture',
      reason: 'Fixture issue',
      instructions: 'Hold stock',
      severity: 'warning',
      batchIds: [batch],
      acknowledgementDeadlineHours: 0,
    });
  expect(response.status).toBe(400);
});
