import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
let owner: string,
  user: string,
  batch: string,
  otherBatch: string,
  holding: string,
  lot: string,
  slug: string,
  otherSlug: string,
  critical: string,
  resolved: string;
let notices: string[] = [];
const read = (parameters: Record<string, string | undefined> = {}, name = slug) =>
  request(app).get(`/public/products/${name}/notices/page`).query(parameters);
beforeAll(async () => {
  owner = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction) VALUES('Public notice owner','exporter','GH') RETURNING id",
    )
  ).rows[0].id;
  user = (
    await query(
      "INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,'unused-test-hash','Notice owner') RETURNING id",
      [owner, crypto.randomUUID() + '@integration.test'],
    )
  ).rows[0].id;
  const batches = (
    await query(
      "INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_country) SELECT 'peanut','2026-01-01',10,$1,'direct_inventory','GH' FROM generate_series(1,2) RETURNING id",
      [owner],
    )
  ).rows;
  batch = batches[0].id;
  otherBatch = batches[1].id;
  holding = (
    await query(
      "INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg,warehouse_location) VALUES($1,$2,10,'Public notice stock') RETURNING id",
      [batch, owner],
    )
  ).rows[0].id;
  lot = (
    await query(
      "INSERT INTO material_lots(lot_code,lot_type,batch_id,product_name,quantity_kg,owner_organization_id) VALUES($1,'source',$2,'peanut',10,$3) RETURNING id",
      ['PN-' + crypto.randomUUID(), batch, owner],
    )
  ).rows[0].id;
  slug = 'notices-' + crypto.randomUUID();
  otherSlug = 'notices-' + crypto.randomUUID();
  await query(
    "INSERT INTO product_profiles(batch_id,slug,display_name,lot_code,visibility) VALUES($1,$3,'Notice profile','NOTICE-ONE','published'),($2,$4,'Other profile','NOTICE-TWO','published')",
    [batch, otherBatch, slug, otherSlug],
  );
  const rows = (
    await query(
      "INSERT INTO recall_notices(reference_code,title,reason,instructions,severity,status,initiated_by_user_id,initiated_by_organization_id) SELECT $1||n,'Public notice '||n,'Public safety investigation','Do not use','advisory','active',$2,$3 FROM generate_series(1,1005) n RETURNING id",
      ['NOTICE-' + crypto.randomUUID() + '-', user, owner],
    )
  ).rows;
  notices = rows.map((r) => r.id).sort();
  critical = notices[1004];
  resolved = notices[1003];
  await query(
    'INSERT INTO recall_affected_batches(recall_id,batch_id) SELECT unnest($1::uuid[]),$2',
    [notices, batch],
  );
  await query(
    "UPDATE recall_notices SET severity='critical',title='Literal %_ critical notice' WHERE id=$1",
    [critical],
  );
  await query("UPDATE recall_notices SET status='resolved',resolved_at=NOW() WHERE id=$1", [
    resolved,
  ]);
  // Critical notice is reachable only through a lot, not through a direct batch edge.
  await query('DELETE FROM recall_affected_batches WHERE recall_id=$1', [critical]);
  await query(
    'INSERT INTO recall_affected_lots(recall_id,lot_id,source_equivalent_kg,recall_quantity_kg) VALUES($1,$2,10,10)',
    [critical, lot],
  );
});
afterAll(async () => {
  try {
    if (notices.length) {
      await query('DELETE FROM recall_recovery_records WHERE recall_id=ANY($1::uuid[])', [notices]);
      await query('DELETE FROM recall_safety_holds WHERE recall_id=ANY($1::uuid[])', [notices]);
      await query('DELETE FROM recall_affected_lots WHERE recall_id=ANY($1::uuid[])', [notices]);
      await query('DELETE FROM recall_affected_batches WHERE recall_id=ANY($1::uuid[])', [notices]);
      await query('DELETE FROM recall_notices WHERE id=ANY($1::uuid[])', [notices]);
    }
    if (lot) await query('DELETE FROM material_lots WHERE id=$1', [lot]);
    if (holding) await query('DELETE FROM batch_holdings WHERE id=$1', [holding]);
    if (batch) {
      await query('DELETE FROM product_profiles WHERE batch_id=ANY($1::uuid[])', [
        [batch, otherBatch],
      ]);
      await query('DELETE FROM harvest_batches WHERE id=ANY($1::uuid[])', [[batch, otherBatch]]);
    }
  } finally {
    await pool.end();
  }
});
describe('published recall notice pages and full safety aggregates', () => {
  it('bounds notices while preserving an off-page lot-only critical warning', async () => {
    const response = await read({ limit: '1' });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].id).not.toBe(critical);
    expect(response.body).toMatchObject({
      count: 1005,
      hasMore: true,
      safety: {
        status: 'critical',
        activeCount: 1004,
        resolvedCount: 1,
        criticalCount: 1,
        inventoryHeld: true,
      },
    });
    expect(response.headers['cache-control']).toBe('no-store');
    const embedded = await request(app).get(`/public/products/${slug}`);
    expect(embedded.status, JSON.stringify(embedded.body)).toBe(200);
    expect(embedded.body.safety).toMatchObject({
      status: 'critical',
      inventoryHeld: true,
      activeCount: 1004,
      resolvedCount: 1,
    });
    expect(embedded.body.safety.activeRecalls.length).toBeLessThanOrEqual(50);
    expect(embedded.body.safety.activeRecalls.map((r: { id: string }) => r.id)).not.toContain(
      critical,
    );
  });
  it('pages IDs without duplicates and keeps totals independent of status and search', async () => {
    const first = await read({ limit: '100', status: 'active' });
    expect(first.status).toBe(200);
    const second = await read({ limit: '100', status: 'active', cursor: first.body.nextCursor });
    expect(second.status).toBe(200);
    expect(
      new Set([...first.body.items, ...second.body.items].map((r: { id: string }) => r.id)).size,
    ).toBe(200);
    const filtered = await read({ limit: '1', status: 'resolved', search: 'no match' });
    expect(filtered.status).toBe(200);
    expect(filtered.body.items).toEqual([]);
    expect(filtered.body.count).toBe(1005);
    expect(filtered.body.safety.status).toBe('critical');
  });
  it('searches literal wildcard characters before limiting and exposes public metadata only', async () => {
    const response = await read({ limit: '1', search: '%_' });
    expect(response.status).toBe(200);
    expect(response.body.items.map((r: { id: string }) => r.id)).toEqual([critical]);
    expect(Object.keys(response.body.items[0]).sort()).toEqual([
      'id',
      'initiated_at',
      'instructions',
      'issued_by',
      'reason',
      'reference_code',
      'resolved_at',
      'severity',
      'status',
      'title',
    ]);
  });
  it('binds cursors to association, filter and search and checks publication on continuation', async () => {
    const first = await read({ limit: '1' });
    for (const p of [{ status: 'active' }, { search: 'changed' }])
      expect((await read({ cursor: first.body.nextCursor, ...p })).status).toBe(400);
    expect((await read({ cursor: first.body.nextCursor }, otherSlug)).status).toBe(400);
    await query("UPDATE product_profiles SET visibility='archived' WHERE slug=$1", [slug]);
    try {
      expect((await read({ cursor: first.body.nextCursor })).status).toBe(404);
    } finally {
      await query("UPDATE product_profiles SET visibility='published' WHERE slug=$1", [slug]);
    }
  });
  it('resolved retained stock never becomes clear even when affected edges are absent', async () => {
    await query(
      "UPDATE recall_notices SET status='resolved',resolved_at=NOW() WHERE id=ANY($1::uuid[])",
      [notices],
    );
    await query(
      "INSERT INTO recall_safety_holds(recall_id,entity_type,entity_id) VALUES($1,'holding',$2)",
      [resolved, holding],
    );
    await query('DELETE FROM recall_affected_batches WHERE recall_id=$1', [resolved]);
    try {
      const response = await read({ status: 'active' });
      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
      expect(response.body).toMatchObject({
        count: 1005,
        safety: { status: 'warning', inventoryHeld: true, activeCount: 0, resolvedCount: 1005 },
      });
      const notice = await read({ status: 'resolved', search: 'Public notice' });
      expect(notice.body.count).toBe(1005);
    } finally {
      await query('DELETE FROM recall_safety_holds WHERE recall_id=$1', [resolved]);
      await query('INSERT INTO recall_affected_batches(recall_id,batch_id) VALUES($1,$2)', [
        resolved,
        batch,
      ]);
      await query(
        "UPDATE recall_notices SET status='active',resolved_at=NULL WHERE id=ANY($1::uuid[]) AND id<>$2",
        [notices, resolved],
      );
    }
  });
  it('deduplicates batch and lot associations and includes the lot-only notice in the journey', async () => {
    const journey = await request(app).get(`/public/products/${slug}/journey/page`).query({ search: '%_' });
    expect(journey.status, JSON.stringify(journey.body)).toBe(200);
    expect(journey.body.items).toHaveLength(1);
    expect(journey.body.items[0].title).toBe('Safety notice: Literal %_ critical notice');
    await query('INSERT INTO recall_affected_batches(recall_id,batch_id) VALUES($1,$2)', [critical, batch]);
    try {
      const response = await read({ search: '%_' });
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.count).toBe(1005);
      expect(response.body.items.map((row: { id: string }) => row.id)).toEqual([critical]);
      expect(response.body.safety.criticalCount).toBe(1);
    } finally {
      await query('DELETE FROM recall_affected_batches WHERE recall_id=$1', [critical]);
    }
  });
  it('keeps disposed stock blocked after hold release but clears resolved stock with no retained material', async () => {
    await query("UPDATE recall_notices SET status='resolved',resolved_at=NOW() WHERE id=ANY($1::uuid[])", [notices]);
    await query("INSERT INTO recall_safety_holds(recall_id,entity_type,entity_id,released_at) VALUES($1,'holding',$2,NOW())", [resolved, holding]);
    await query('DELETE FROM recall_affected_batches WHERE recall_id=$1', [resolved]);
    await query("INSERT INTO recall_recovery_records(recall_id,holding_id,returned_kg,note,recorded_by_user_id) VALUES($1,$2,1,'Returned material remains blocked',$3)", [resolved, holding, user]);
    try {
      const blocked = await read({ status: 'active' });
      expect(blocked.status, JSON.stringify(blocked.body)).toBe(200);
      expect(blocked.body).toMatchObject({ count: 1005, items: [], safety: { status: 'warning', inventoryHeld: true, activeCount: 0 } });
      await query('DELETE FROM recall_recovery_records WHERE recall_id=$1', [resolved]);
      const clear = await read();
      expect(clear.status, JSON.stringify(clear.body)).toBe(200);
      expect(clear.body).toMatchObject({ count: 1004, safety: { status: 'clear', inventoryHeld: false } });
    } finally {
      await query('DELETE FROM recall_recovery_records WHERE recall_id=$1', [resolved]);
      await query('DELETE FROM recall_safety_holds WHERE recall_id=$1', [resolved]);
      await query('INSERT INTO recall_affected_batches(recall_id,batch_id) VALUES($1,$2)', [resolved, batch]);
      await query("UPDATE recall_notices SET status='active',resolved_at=NULL WHERE id=ANY($1::uuid[]) AND id<>$2", [notices, resolved]);
    }
  });
  it('rejects malformed and repeated inputs', async () => {
    for (const p of [
      { limit: '101' },
      { status: 'draft' },
      { search: 'x'.repeat(81) },
      { all: 'true' },
      { cursor: 'bad' },
    ])
      expect((await read(p)).status).toBe(400);
    expect(
      (
        await request(app).get(
          `/public/products/${slug}/notices/page?status=active&status=resolved`,
        )
      ).status,
    ).toBe(400);
  });
});
