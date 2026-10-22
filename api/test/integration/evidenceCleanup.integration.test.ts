import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  scanPendingEvidence,
  EVIDENCE_MAINTENANCE_ACTOR,
} from '../../src/modules/evidenceMaintenance/scanPending';
import app from '../../src/app';
import * as auditWriter from '../../src/services/auditWriter';
import { config } from '../../src/config/env';
import { getClient, pool, query } from '../../src/db';
import { registerObject } from '../../src/modules/evidenceCleanup/repository';
import { cleanupObjectNow, runCleanupBatch } from '../../src/modules/evidenceCleanup/worker';
import { evidenceStorage } from '../../src/services/evidenceStorage';
let organizationId: string, userId: string, farmId: string, token: string;
const keys: string[] = [],
  intents: string[] = [],
  evidenceIds: string[] = [];
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const content = Buffer.from('%PDF-1.7\nCleanup fixture');
async function createIntent(size = content.length) {
  return request(app)
    .post('/evidence/upload-intents')
    .set('Authorization', `Bearer ${token}`)
    .send({
      type: 'other',
      fileName: 'cleanup.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: size,
      linkedEntityType: 'farm',
      linkedEntityId: farmId,
      claimDescription: 'Cleanup regression fixture',
    });
}
async function admitted(size = content.length) {
  const result = await createIntent(size);
  expect(result.status, JSON.stringify(result.body)).toBe(201);
  intents.push(result.body.intentId);
  const row = (
    await query('SELECT quarantine_object_key FROM evidence_upload_intents WHERE id=$1', [
      result.body.intentId,
    ])
  ).rows[0];
  keys.push(row.quarantine_object_key);
  return { ...result.body, key: String(row.quarantine_object_key) } as {
    intentId: string;
    uploadUrl: string;
    key: string;
  };
}
async function ledger(key: string) {
  return (await query('SELECT * FROM evidence_object_cleanup WHERE object_key=$1', [key])).rows[0];
}
async function job(
  reason = 'upload_rejected',
  key = `quarantine/${config.environment}/${crypto.randomUUID()}`,
  write = true,
) {
  keys.push(key);
  if (write) await evidenceStorage().put(key, content, 'application/pdf');
  const client = await getClient();
  try {
    await registerObject(client, {
      objectKey: key,
      organizationId,
      bytes: content.length,
      storageProvider: evidenceStorage().provider,
      reason: 'upload_quarantine',
    });
  } finally {
    client.release();
  }
  await query(
    "UPDATE evidence_object_cleanup SET state='pending',reason=$2,next_attempt_at=TIMESTAMPTZ '1800-01-01',created_at=TIMESTAMPTZ '1800-01-01' WHERE object_key=$1",
    [key, reason],
  );
  return key;
}
async function proof(key: string, status = 'clean') {
  const id = (
    await query(
      `INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,file_size_bytes,mime_type,sha256_hash,storage_key,storage_provider,validation_status,malware_scan_status,linked_entity_type,linked_entity_id,claim_description) VALUES($1,$2,'other','cleanup.pdf',$3,'application/pdf','sha256:cleanup',$4,$5,'validated',$6,'farm',$7,'Cleanup proof fixture') RETURNING id`,
      [userId, organizationId, content.length, key, evidenceStorage().provider, status, farmId],
    )
  ).rows[0].id;
  evidenceIds.push(id);
  return String(id);
}
beforeAll(async () => {
  const tag = crypto.randomUUID();
  organizationId = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Cleanup fixture ' + tag],
    )
  ).rows[0].id;
  const email = `cleanup-${tag}@integration.test`;
  userId = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [organizationId, email, await bcrypt.hash('CleanupFixture123!', 4), 'Cleanup fixture'],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      'cleanup-' + tag,
      ['evidence.upload', 'evidence.read'],
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [userId, role]);
  farmId = (
    await query(
      "INSERT INTO farms(farmer_organization_id,name,country,region,district) VALUES($1,'Cleanup farm','GH','Northern','Tamale') RETURNING id",
      [organizationId],
    )
  ).rows[0].id;
  const login = await request(app)
    .post('/auth/login')
    .send({ email, password: 'CleanupFixture123!' });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  token = login.body.accessToken;
});
afterEach(async () => {
  vi.restoreAllMocks();
  await query('DROP TRIGGER IF EXISTS integration_evidence_lifecycle_failure ON audit_events');
  await query('DROP FUNCTION IF EXISTS integration_reject_evidence_lifecycle_audit()');
  const ownKeys = keys.splice(0);
  try {
    await query('DELETE FROM evidence_object_cleanup WHERE organization_id=$1', [organizationId]);
    if (intents.length)
      await query('DELETE FROM evidence_upload_intents WHERE id=ANY($1::uuid[])', [
        intents.splice(0),
      ]);
    if (evidenceIds.length)
      await query('DELETE FROM evidence_items WHERE id=ANY($1::uuid[])', [evidenceIds.splice(0)]);
  } finally {
    for (const key of ownKeys)
      if (key.includes(`/${config.environment}/`)) await evidenceStorage().delete(key);
  }
});
afterAll(() => pool.end());
describe('durable private evidence cleanup and conservative tenant quota', () => {
  it('registers quarantine ownership once with the intent and rejects conflicting registrations', async () => {
    const upload = await admitted();
    const initial = await ledger(upload.key);
    expect(initial).toMatchObject({
      organization_id: organizationId,
      upload_intent_id: upload.intentId,
      state: 'held',
      reason: 'upload_quarantine',
    });
    const client = await getClient();
    try {
      const input = {
        objectKey: upload.key,
        organizationId,
        bytes: content.length,
        storageProvider: evidenceStorage().provider,
        uploadIntentId: upload.intentId,
        reason: 'upload_quarantine' as const,
      };
      await registerObject(client, input);
      await registerObject(client, input);
      await expect(
        registerObject(client, { ...input, bytes: content.length + 1 }),
      ).rejects.toMatchObject({ statusCode: 409 });
    } finally {
      client.release();
    }
    expect(
      (
        await query(
          'SELECT COUNT(*)::int AS count FROM evidence_object_cleanup WHERE object_key=$1',
          [upload.key],
        )
      ).rows[0].count,
    ).toBe(1);
  });
  it('retains quota after a rejected upload deletion fails and frees it only after durable retry succeeds', async () => {
    const size = Math.min(
      config.evidenceMaxFileBytes,
      Math.floor(config.evidenceOrganizationQuotaBytes * 0.8),
    );
    const upload = await admitted(size);
    const deletion = vi
      .spyOn(evidenceStorage(), 'delete')
      .mockRejectedValue(new Error('provider secrets must not be stored'));
    try {
      const response = await request(app)
        .put(upload.uploadUrl)
        .set('Content-Type', 'application/pdf')
        .send(Buffer.alloc(size, 65));
      expect(response.status, JSON.stringify(response.body)).toBe(400);
      const failed = await ledger(upload.key);
      expect(failed.state).toBe('pending');
      expect(failed.attempts).toBeGreaterThanOrEqual(1);
      expect(failed.last_error_code).toBe('ERROR');
      expect(JSON.stringify(failed)).not.toContain('provider secrets');
      const excess = config.evidenceOrganizationQuotaBytes - size + 1;
      const blocked = await createIntent(excess);
      expect(blocked.status, JSON.stringify(blocked.body)).toBe(413);
      expect(blocked.body.code).toBe('EVIDENCE_QUOTA_EXCEEDED');
    } finally {
      deletion.mockRestore();
    }
    expect(await evidenceStorage().get(upload.key)).not.toBeNull();
    await query('UPDATE evidence_object_cleanup SET next_attempt_at=NOW() WHERE object_key=$1', [
      upload.key,
    ]);
    expect(await cleanupObjectNow(upload.key, { logger })).toBe(true);
    expect((await ledger(upload.key)).state).toBe('done');
    expect(await evidenceStorage().get(upload.key)).toBeNull();
    await admitted(config.evidenceOrganizationQuotaBytes - size + 1);
  });
  it('retains completed final evidence while recording quarantine deletion and never queues retained proof', async () => {
    const upload = await admitted();
    const response = await request(app)
      .put(upload.uploadUrl)
      .set('Content-Type', 'application/pdf')
      .send(content);
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    evidenceIds.push(response.body.id);
    const final = (
      await query('SELECT storage_key FROM evidence_items WHERE id=$1', [response.body.id])
    ).rows[0].storage_key;
    keys.push(final);
    expect((await ledger(final)).state).toBe('retained');
    expect((await ledger(upload.key)).state).toBe('done');
    expect(await cleanupObjectNow(final, { logger })).toBe(false);
    expect(await evidenceStorage().get(final)).toEqual(content);
  });
  it('concurrent bounded workers claim each pending object exactly once', async () => {
    const firstKey = await job(),
      secondKey = await job();
    let entered!: () => void, finish!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const stalled = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const seen: string[] = [];
    const storage = evidenceStorage();
    const deletion = vi.fn(async (key: string) => {
      seen.push(key);
      if (seen.length === 1) {
        entered();
        await stalled;
      }
      await storage.delete(key);
    });
    const first = runCleanupBatch({
      batchSize: 1,
      storage: { provider: storage.provider, delete: deletion },
      logger,
    });
    try {
      await started;
      const second = await runCleanupBatch({
        batchSize: 1,
        storage: { provider: storage.provider, delete: deletion },
        logger,
      });
      expect(second.deleted).toBe(1);
      finish();
      expect((await first).deleted).toBe(1);
      expect(seen.sort()).toEqual([firstKey, secondKey].sort());
      expect(new Set(seen).size).toBe(2);
    } finally {
      finish();
      await first;
    }
  });
  it('a stale lease token cannot acknowledge a newer cleanup claim', async () => {
    const key = await job();
    const newerToken = crypto.randomUUID();
    const storage = evidenceStorage();
    const deletion = vi.fn(async () => {
      await query(
        "UPDATE evidence_object_cleanup SET lease_token=$2 WHERE object_key=$1 AND state='processing'",
        [key, newerToken],
      );
    });
    const result = await runCleanupBatch({
      batchSize: 1,
      storage: { provider: storage.provider, delete: deletion },
      logger,
    });
    expect(result.lostClaims).toBe(1);
    expect(result.deleted).toBe(0);
    expect(await ledger(key)).toMatchObject({
      state: 'processing',
      lease_token: newerToken,
      deleted_at: null,
    });
  });
  it('refuses another environment key and refuses deletion of current live scan-clean evidence', async () => {
    const foreign = `quarantine/${config.environment === 'production' ? 'test' : 'production'}/${crypto.randomUUID()}`;
    await job('upload_rejected', foreign, false);
    const storage = evidenceStorage(),
      deletion = vi.fn(async () => undefined);
    expect(
      await cleanupObjectNow(foreign, {
        storage: { provider: storage.provider, delete: deletion },
        logger,
      }),
    ).toBe(false);
    expect(await ledger(foreign)).toMatchObject({
      state: 'dead',
      last_error_code: 'INVALID_OBJECT_KEY',
    });
    const key = await job();
    await proof(key);
    expect(
      await cleanupObjectNow(key, {
        storage: { provider: storage.provider, delete: deletion },
        logger,
      }),
    ).toBe(false);
    expect(await ledger(key)).toMatchObject({
      state: 'dead',
      last_error_code: 'LIVE_EVIDENCE_REFERENCE',
    });
    expect(deletion).not.toHaveBeenCalled();
    expect(await storage.get(key)).toEqual(content);
  });
  it('infection cleanup preserves the infected security decision even when provider deletion fails', async () => {
    const key = await job('malware_infected');
    const id = await proof(key, 'infected');
    const storage = evidenceStorage();
    expect(
      await cleanupObjectNow(key, {
        storage: {
          provider: storage.provider,
          delete: vi.fn(async () => {
            throw new Error('Deletion failed');
          }),
        },
        logger,
      }),
    ).toBe(false);
    expect(
      (await query('SELECT malware_scan_status FROM evidence_items WHERE id=$1', [id])).rows[0]
        .malware_scan_status,
    ).toBe('infected');
    expect((await ledger(key)).state).toBe('pending');
    expect(await storage.get(key)).not.toBeNull();
  });
  it('deduplicates a live evidence object and its outstanding cleanup ownership without freeing its bytes', async () => {
    const key = await job();
    const id = await proof(key);
    const size = Math.min(
      config.evidenceMaxFileBytes,
      Math.floor(config.evidenceOrganizationQuotaBytes * 0.8),
    );
    await query('UPDATE evidence_items SET file_size_bytes=$2 WHERE id=$1', [id, size]);
    await query(
      "UPDATE evidence_object_cleanup SET bytes=$2,state='dead',last_error_code='LIVE_EVIDENCE_REFERENCE' WHERE object_key=$1",
      [key, size],
    );
    await admitted(config.evidenceOrganizationQuotaBytes - size);
    const blocked = await createIntent(1);
    expect(blocked.status, JSON.stringify(blocked.body)).toBe(413);
    expect(blocked.body.code).toBe('EVIDENCE_QUOTA_EXCEEDED');
  });
  it('reclaims expired leases and records exhausted provider failures as charged dead obligations', async () => {
    const key = await job();
    const oldToken = crypto.randomUUID();
    await query(
      "UPDATE evidence_object_cleanup SET state='processing',attempts=7,lease_token=$2,lease_expires_at=NOW()-INTERVAL '1 second' WHERE object_key=$1",
      [key, oldToken],
    );
    const storage = evidenceStorage();
    const result = await runCleanupBatch({
      batchSize: 1,
      storage: {
        provider: storage.provider,
        delete: vi.fn(async () => {
          throw new Error('Final provider failure');
        }),
      },
      logger,
    });
    expect(result.dead).toBe(1);
    expect(await ledger(key)).toMatchObject({
      state: 'dead',
      attempts: 8,
      lease_token: null,
      lease_expires_at: null,
      last_error_code: 'ERROR',
      deleted_at: null,
    });
    expect(await storage.get(key)).toEqual(content);
  });
  it('legacy intent reservations remain charged until an operator proves historical provider ownership', async () => {
    const size = Math.min(
      config.evidenceMaxFileBytes,
      Math.floor(config.evidenceOrganizationQuotaBytes * 0.8),
    );
    const id = crypto.randomUUID(),
      key = `quarantine/${config.environment}/${crypto.randomUUID()}`;
    intents.push(id);
    keys.push(key);
    await query(
      `INSERT INTO evidence_upload_intents(id,uploader_user_id,uploader_organization_id,evidence_type,original_file_name,claimed_mime_type,declared_size_bytes,linked_entity_type,linked_entity_id,claim_description,quarantine_object_key,status,expires_at) VALUES($1,$2,$3,'other','legacy.pdf','application/pdf',$4,'farm',$5,'Historical provider unknown',$6,'expired',NOW()-INTERVAL '1 day')`,
      [id, userId, organizationId, size, farmId, key],
    );
    expect(await cleanupObjectNow(key, { logger })).toBe(false);
    expect(await ledger(key)).toBeUndefined();
    const blocked = await createIntent(config.evidenceOrganizationQuotaBytes - size + 1);
    expect(blocked.status, JSON.stringify(blocked.body)).toBe(413);
    expect(blocked.body.code).toBe('EVIDENCE_QUOTA_EXCEEDED');
  });
  it('rolls evidence completion back when its critical audit fails', async () => {
    const upload = await admitted();
    const auditFailure = vi
      .spyOn(auditWriter, 'recordAudit')
      .mockRejectedValueOnce(new Error('Critical audit unavailable'));
    try {
      const result = await request(app)
        .put(upload.uploadUrl)
        .set('Content-Type', 'application/pdf')
        .send(content);
      expect(result.status).toBe(500);
      const intent = (
        await query('SELECT status,evidence_item_id FROM evidence_upload_intents WHERE id=$1', [
          upload.intentId,
        ])
      ).rows[0];
      expect(intent).toMatchObject({ status: 'rejected', evidence_item_id: null });
      expect(
        (
          await query(
            "SELECT count(*)::int AS count FROM evidence_object_cleanup WHERE upload_intent_id=$1 AND state='retained'",
            [upload.intentId],
          )
        ).rows[0].count,
      ).toBe(0);
    } finally {
      auditFailure.mockRestore();
    }
  });
  it('retains committed clean evidence and its audit when retries return the same record', async () => {
    const upload = await admitted();
    {
      const result = await request(app)
        .put(upload.uploadUrl)
        .set('Content-Type', 'application/pdf')
        .send(content);
      expect(result.status, JSON.stringify(result.body)).toBe(201);
      const saved = (
        await query(
          'SELECT i.status,i.evidence_item_id,e.storage_key FROM evidence_upload_intents i JOIN evidence_items e ON e.id=i.evidence_item_id WHERE i.id=$1',
          [upload.intentId],
        )
      ).rows[0];
      expect(saved.status).toBe('completed');
      evidenceIds.push(saved.evidence_item_id);
      keys.push(saved.storage_key);
      expect((await ledger(saved.storage_key)).state).toBe('retained');
      expect(await evidenceStorage().get(saved.storage_key)).toEqual(content);
      const retry = await request(app)
        .put(upload.uploadUrl)
        .set('Content-Type', 'application/pdf')
        .send(content);
      expect(retry.status, JSON.stringify(retry.body)).toBe(201);
      expect(retry.body.id).toBe(saved.evidence_item_id);
      expect(
        (
          await query(
            "SELECT count(*)::int AS count FROM audit_events WHERE entity_id=$1 AND action='evidence.upload.complete'",
            [saved.evidence_item_id],
          )
        ).rows[0].count,
      ).toBe(1);
    }
  });
});

async function rejectLifecycleAudit(action: string) {
  // Identifiers are fixed; values are restricted to the test-owned UUID and known actions.
  if (!/^evidence\.[a-z_.]+$/.test(action)) throw new Error('Invalid test action');
  await query(`CREATE FUNCTION integration_reject_evidence_lifecycle_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.actor_organization_id='${organizationId}'::uuid AND NEW.action='${action}' THEN
        RAISE EXCEPTION 'Injected lifecycle audit failure';
      END IF;
      RETURN NEW;
    END $$`);
  await query(`CREATE TRIGGER integration_evidence_lifecycle_failure BEFORE INSERT ON audit_events
    FOR EACH ROW EXECUTE FUNCTION integration_reject_evidence_lifecycle_audit()`);
}
async function lifecycleEvents(entityId: string, action: string) {
  return (
    await query(
      'SELECT actor_user_id,actor_organization_id,metadata FROM audit_events WHERE entity_id=$1 AND action=$2',
      [entityId, action],
    )
  ).rows;
}
describe('audited private evidence lifecycle', () => {
  it('records release readiness without filenames or object keys and refuses bytes when its audit fails', async () => {
    const key = `evidence/${config.environment}/${crypto.randomUUID()}`;
    keys.push(key);
    await evidenceStorage().put(key, content, 'application/pdf');
    const id = await proof(key);
    const response = await request(app)
      .get(`/evidence/${id}/download`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const events = await lifecycleEvents(id, 'evidence.download.release_ready');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actor_user_id: userId,
      actor_organization_id: organizationId,
      metadata: { bytes: content.length, outcome: 'release_ready' },
    });
    expect(JSON.stringify(events)).not.toContain(key);
    expect(JSON.stringify(events)).not.toContain('cleanup.pdf');
    await rejectLifecycleAudit('evidence.download.release_ready');
    const failed = await request(app)
      .get(`/evidence/${id}/download`)
      .set('Authorization', `Bearer ${token}`);
    expect(failed.status).toBe(500);
    expect(failed.headers['content-disposition']).toBeUndefined();
    expect(await lifecycleEvents(id, 'evidence.download.release_ready')).toHaveLength(1);
    await query("UPDATE evidence_items SET malware_scan_status='infected' WHERE id=$1", [id]);
    expect(
      (await request(app).get(`/evidence/${id}/download`).set('Authorization', `Bearer ${token}`))
        .status,
    ).toBe(423);
    expect(await lifecycleEvents(id, 'evidence.download.release_ready')).toHaveLength(1);
  });
  it('commits maintenance decisions with system attribution and does not repeat already clean decisions', async () => {
    const key = `evidence/${config.environment}/${crypto.randomUUID()}`;
    keys.push(key);
    const id = await proof(key, 'legacy_unscanned');
    const options = {
      scanner: {
        healthcheck: vi.fn(async () => undefined),
        scan: vi.fn(async () => ({ status: 'clean' as const, engine: 'fixture' })),
      },
      storage: {
        provider: evidenceStorage().provider,
        get: vi.fn(async () => content),
        delete: vi.fn(),
      },
      logger,
    };
    await scanPendingEvidence(options);
    const events = await lifecycleEvents(id, 'evidence.maintenance.clean');
    expect(events).toHaveLength(1);
    expect(events[0].actor_user_id).toBe(EVIDENCE_MAINTENANCE_ACTOR);
    expect(events[0].actor_organization_id).toBe(organizationId);
    await scanPendingEvidence(options);
    expect(await lifecycleEvents(id, 'evidence.maintenance.clean')).toHaveLength(1);
  });
  it('rolls a clean maintenance decision back if its audit fails and records the fail-closed outcome', async () => {
    const key = `evidence/${config.environment}/${crypto.randomUUID()}`;
    keys.push(key);
    const id = await proof(key, 'legacy_unscanned');
    await rejectLifecycleAudit('evidence.maintenance.clean');
    await scanPendingEvidence({
      scanner: {
        healthcheck: vi.fn(async () => undefined),
        scan: vi.fn(async () => ({ status: 'clean' as const, engine: 'fixture' })),
      },
      storage: { get: vi.fn(async () => content), delete: vi.fn() },
      logger,
    });
    expect(
      (await query('SELECT malware_scan_status FROM evidence_items WHERE id=$1', [id])).rows[0]
        .malware_scan_status,
    ).toBe('scan_failed');
    expect(await lifecycleEvents(id, 'evidence.maintenance.clean')).toHaveLength(0);
    expect(await lifecycleEvents(id, 'evidence.maintenance.scan_failed')).toHaveLength(1);
  });
  it('does not queue infected bytes for deletion when the infected-decision audit rolls back', async () => {
    const key = `evidence/${config.environment}/${crypto.randomUUID()}`;
    keys.push(key);
    const id = await proof(key, 'legacy_unscanned');
    await rejectLifecycleAudit('evidence.maintenance.infected');
    const remove = vi.fn();
    await scanPendingEvidence({
      scanner: {
        healthcheck: vi.fn(async () => undefined),
        scan: vi.fn(async () => ({
          status: 'infected' as const,
          engine: 'fixture',
          signature: 'private-signature',
        })),
      },
      storage: {
        provider: evidenceStorage().provider,
        get: vi.fn(async () => content),
        delete: remove,
      },
      logger,
    });
    expect(
      (await query('SELECT malware_scan_status FROM evidence_items WHERE id=$1', [id])).rows[0]
        .malware_scan_status,
    ).toBe('scan_failed');
    expect(await lifecycleEvents(id, 'evidence.maintenance.infected')).toHaveLength(0);
    expect(await ledger(key)).toBeUndefined();
    expect(remove).not.toHaveBeenCalled();
  });
  it('stops maintenance if the fail-closed state and its audit cannot commit together', async () => {
    const key = `evidence/${config.environment}/${crypto.randomUUID()}`;
    keys.push(key);
    const id = await proof(key, 'legacy_unscanned');
    await rejectLifecycleAudit('evidence.maintenance.scan_failed');
    await expect(
      scanPendingEvidence({
        scanner: {
          healthcheck: vi.fn(async () => undefined),
          scan: vi.fn(async () => {
            throw new Error('private scanner failure');
          }),
        },
        storage: { get: vi.fn(async () => content), delete: vi.fn() },
        logger,
      }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_SCAN_STATE_PERSIST_FAILED' });
    expect(
      (await query('SELECT malware_scan_status FROM evidence_items WHERE id=$1', [id])).rows[0]
        .malware_scan_status,
    ).toBe('legacy_unscanned');
    expect(await lifecycleEvents(id, 'evidence.maintenance.scan_failed')).toHaveLength(0);
  });
  it('rolls abandoned-upload terminalization and cleanup scheduling back when their audit fails', async () => {
    const upload = await admitted();
    await query(
      "UPDATE evidence_upload_intents SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",
      [upload.intentId],
    );
    await rejectLifecycleAudit('evidence.upload.abandoned');
    await expect(runCleanupBatch({ logger })).rejects.toThrow();
    expect(
      (await query('SELECT status FROM evidence_upload_intents WHERE id=$1', [upload.intentId]))
        .rows[0].status,
    ).toBe('pending');
    expect((await ledger(upload.key)).state).toBe('held');
    await query('DROP TRIGGER integration_evidence_lifecycle_failure ON audit_events');
    await runCleanupBatch({ logger });
    expect(
      (await query('SELECT status FROM evidence_upload_intents WHERE id=$1', [upload.intentId]))
        .rows[0].status,
    ).toBe('expired');
    expect(await lifecycleEvents(upload.intentId, 'evidence.upload.abandoned')).toHaveLength(1);
    await runCleanupBatch({ logger });
    expect(await lifecycleEvents(upload.intentId, 'evidence.upload.abandoned')).toHaveLength(1);
  });
  it('retains cleanup ownership after provider deletion if its completion audit fails, then recovers once', async () => {
    const key = await job();
    const before = await ledger(key);
    await rejectLifecycleAudit('evidence.cleanup.deleted');
    await expect(cleanupObjectNow(key, { logger })).rejects.toThrow();
    expect((await ledger(key)).state).toBe('processing');
    expect(await evidenceStorage().get(key)).toBeNull();
    expect(await lifecycleEvents(before.id, 'evidence.cleanup.deleted')).toHaveLength(0);
    await query('DROP TRIGGER integration_evidence_lifecycle_failure ON audit_events');
    await query(
      "UPDATE evidence_object_cleanup SET lease_expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",
      [before.id],
    );
    await runCleanupBatch({ logger });
    expect((await ledger(key)).state).toBe('done');
    expect(await lifecycleEvents(before.id, 'evidence.cleanup.deleted')).toHaveLength(1);
    expect(await cleanupObjectNow(key, { logger })).toBe(false);
    expect(await lifecycleEvents(before.id, 'evidence.cleanup.deleted')).toHaveLength(1);
  });
});
