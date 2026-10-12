import crypto from 'node:crypto';
import { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getClient, pool } from '../../src/db';
let client: PoolClient;
let organizationId: string;
const key = () => `quarantine/test/${crypto.randomUUID()}`;
beforeAll(async () => {
  client = await getClient();
  await client.query('BEGIN');
  organizationId = (
    await client.query(
      "INSERT INTO organizations(name,type,jurisdiction) VALUES($1,'exporter','GH') RETURNING id",
      ['Cleanup schema ' + crypto.randomUUID()],
    )
  ).rows[0].id;
});
afterAll(async () => {
  try {
    if (client) await client.query('ROLLBACK');
  } finally {
    client?.release();
    await pool.end();
  }
});
async function insert() {
  return client.query(
    "INSERT INTO evidence_object_cleanup(object_key,organization_id,bytes,storage_provider,reason) VALUES($1,$2,12,'local','upload_quarantine') RETURNING *",
    [key(), organizationId],
  );
}
async function invalid(sql: string, values: unknown[], code = '23514') {
  await client.query('SAVEPOINT invalid_cleanup');
  try {
    await expect(client.query(sql, values)).rejects.toMatchObject({ code });
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT invalid_cleanup');
  }
}
describe('durable evidence cleanup ledger schema', () => {
  it('owns object identity and quota bytes before writes, with held defaults and operational-only reasons', async () => {
    const row = (await insert()).rows[0];
    expect(row).toMatchObject({
      organization_id: organizationId,
      bytes: '12',
      state: 'held',
      attempts: 0,
      lease_token: null,
      lease_expires_at: null,
      deleted_at: null,
      last_error_code: null,
    });
    expect(row.next_attempt_at).toBeInstanceOf(Date);
    await invalid(
      "INSERT INTO evidence_object_cleanup(object_key,organization_id,bytes,storage_provider,reason) VALUES($1,$2,12,'local','upload_final')",
      [row.object_key, organizationId],
      '23505',
    );
  });
  it('rejects unowned references, unsafe object paths, negative accounting and unbounded error text', async () => {
    for (const [column, value, code] of [
      ['bytes', -1, '23514'],
      ['attempts', -1, '23514'],
      ['state', 'unknown', '23514'],
      ['storage_provider', 'foreign', '23514'],
      ['reason', 'https://signed.example/secret', '23514'],
      ['last_error_code', 'provider secret with spaces', '23514'],
      ['organization_id', crypto.randomUUID(), '23503'],
      ['upload_intent_id', crypto.randomUUID(), '23503'],
      ['evidence_id', crypto.randomUUID(), '23503'],
    ] as const) {
      const columns = ['object_key', 'organization_id', 'bytes', 'storage_provider', 'reason'];
      const values: unknown[] = [key(), organizationId, 12, 'local', 'upload_quarantine'];
      const index = columns.indexOf(column);
      if (index >= 0) values[index] = value;
      else {
        columns.push(column);
        values.push(value);
      }
      await invalid(
        `INSERT INTO evidence_object_cleanup(${columns.join(',')}) VALUES(${values.map((_, i) => '$' + (i + 1)).join(',')})`,
        values,
        code,
      );
    }
    for (const objectKey of [
      '../escape',
      'quarantine/test/not-a-uuid',
      'evidence/test/' + crypto.randomUUID() + '/extra',
    ])
      await invalid(
        "INSERT INTO evidence_object_cleanup(object_key,organization_id,bytes,storage_provider,reason) VALUES($1,$2,12,'local','upload_quarantine')",
        [objectKey, organizationId],
      );
  });
  it('requires a full processing lease and clearing it before retry or finalization', async () => {
    const row = (await insert()).rows[0];
    await invalid("UPDATE evidence_object_cleanup SET state='processing' WHERE id=$1", [row.id]);
    await client.query(
      "UPDATE evidence_object_cleanup SET state='processing',lease_token=$2,lease_expires_at=NOW()+INTERVAL '1 minute',attempts=attempts+1 WHERE id=$1",
      [row.id, crypto.randomUUID()],
    );
    await invalid("UPDATE evidence_object_cleanup SET state='pending' WHERE id=$1", [row.id]);
    await client.query(
      "UPDATE evidence_object_cleanup SET state='pending',lease_token=NULL,lease_expires_at=NULL,last_error_code='EVIDENCE_STORAGE_UNAVAILABLE' WHERE id=$1",
      [row.id],
    );
    expect(
      (
        await client.query('SELECT state,attempts FROM evidence_object_cleanup WHERE id=$1', [
          row.id,
        ])
      ).rows[0],
    ).toEqual({ state: 'pending', attempts: 1 });
  });
  it('records deletion only for completed cleanup and retains bytes for dead or retained jobs', async () => {
    const row = (await insert()).rows[0];
    await invalid("UPDATE evidence_object_cleanup SET state='done' WHERE id=$1", [row.id]);
    await invalid('UPDATE evidence_object_cleanup SET deleted_at=NOW() WHERE id=$1', [row.id]);
    await client.query(
      "UPDATE evidence_object_cleanup SET state='dead',last_error_code='EVIDENCE_STORAGE_UNAVAILABLE' WHERE id=$1",
      [row.id],
    );
    expect(
      (
        await client.query('SELECT bytes,deleted_at FROM evidence_object_cleanup WHERE id=$1', [
          row.id,
        ])
      ).rows[0],
    ).toEqual({ bytes: '12', deleted_at: null });
    await client.query("UPDATE evidence_object_cleanup SET state='retained' WHERE id=$1", [row.id]);
    await client.query(
      "UPDATE evidence_object_cleanup SET state='done',deleted_at=NOW() WHERE id=$1",
      [row.id],
    );
    expect(
      (await client.query('SELECT deleted_at FROM evidence_object_cleanup WHERE id=$1', [row.id]))
        .rows[0].deleted_at,
    ).toBeInstanceOf(Date);
  });
});
