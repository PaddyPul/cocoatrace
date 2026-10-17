import crypto from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { pool } from '../../src/db';
import { publicEvidencePage } from '../../src/modules/catalog/publicEvidence';
import { requireDisposableTestDatabase } from '../../src/testing/databaseSafety';
import {
  evidenceAvailabilityProjection,
  evidenceAvailabilityUsableSql,
  preflightEvidence,
} from '../../src/services/evidenceAvailability';

afterAll(async () => {
  await pool.end();
});

it('withdraws superseded independent public proof while retaining historical metadata and rejecting workflow reuse', async () => {
  requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const organizations = (
      await client.query(
        "INSERT INTO organizations(name,type,jurisdiction) VALUES('Version owner','exporter','GH'),('Version reviewer','certifier','GH') RETURNING id",
      )
    ).rows;
    const owner = organizations[0].id;
    const reviewer = organizations[1].id;
    const users = (
      await client.query(
        "INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$3,'unused','Owner'),($2,$4,'unused','Reviewer') RETURNING id",
        [
          owner,
          reviewer,
          `${crypto.randomUUID()}@integration.test`,
          `${crypto.randomUUID()}@integration.test`,
        ],
      )
    ).rows;
    const batch = (
      await client.query(
        "INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_country) VALUES('peanut',CURRENT_DATE,10,$1,'direct_inventory','GH') RETURNING id",
        [owner],
      )
    ).rows[0].id;
    const slug = `version-${crypto.randomUUID()}`;
    await client.query(
      "INSERT INTO product_profiles(batch_id,slug,display_name,lot_code,visibility) VALUES($1,$2,'Version proof','VERSION','published')",
      [batch, slug],
    );
    const old = (
      await client.query(
        "INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id,review_status,validation_status,malware_scan_status,claim_description) VALUES($1,$2,'other','old.pdf',repeat('a',64),'batch',$3,'approved','validated','clean','Original proof') RETURNING id",
        [users[0].id, owner, batch],
      )
    ).rows[0].id;
    await client.query(
      "INSERT INTO trust_claim_reviews(entity_type,entity_id,claim_key,claim_source,reviewer_user_id,reviewer_organization_id,review_method,reviewed_at) VALUES('evidence',$1,'evidence_review','independent_document_review',$2,$3,'document_review',NOW()-INTERVAL '1 hour')",
      [old, users[1].id, reviewer],
    );
    const execute = client.query.bind(client);
    expect((await publicEvidencePage(execute, slug)).items.map((row) => row.id)).toEqual([old]);
    const replacement = (
      await client.query(
        "INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id,review_status,validation_status,malware_scan_status,claim_description,replaces_evidence_id) VALUES($1,$2,'other','new.pdf',repeat('b',64),'batch',$3,'pending','validated','clean','Replacement proof',$4) RETURNING id",
        [users[0].id, owner, batch, old],
      )
    ).rows[0].id;
    await client.query('UPDATE evidence_items SET superseded_by_evidence_id=$1 WHERE id=$2', [
      replacement,
      old,
    ]);
    const page = await publicEvidencePage(execute, slug);
    expect(page.items).toEqual([]);
    expect(page.count).toBe(0);
    // An ordinary document approval cannot manufacture an independent trust review.
    await client.query("UPDATE evidence_items SET review_status='approved' WHERE id=$1", [
      replacement,
    ]);
    expect((await publicEvidencePage(execute, slug)).items).toEqual([]);
    const historical = (
      await client.query(
        `SELECT ${evidenceAvailabilityProjection('e')} FROM evidence_items e WHERE id=$1`,
        [old],
      )
    ).rows[0];
    expect(historical.review_status).toBe('approved');
    expect(historical.superseded_by_evidence_id).toBe(replacement);
    const eligible = await client.query(
      `SELECT id FROM evidence_items e WHERE e.id=$1 AND ${evidenceAvailabilityUsableSql('e')}`,
      [old],
    );
    expect(eligible.rows).toEqual([]);
    // Superseded rows are rejected before touching the private object provider.
    const availability = await preflightEvidence(async () => [historical]);
    expect(availability.available(historical)).toBe(false);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});
