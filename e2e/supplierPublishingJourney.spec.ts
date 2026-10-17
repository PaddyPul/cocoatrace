import crypto from 'node:crypto';
import { Pool } from 'pg';
import { type Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { createWorkspace } from './support/identity';
import { emptyPdfFixture } from './support/pdfFixture';
import { requireDisposableTestDatabase } from '../api/src/testing/databaseSafety';

async function attachHarvestProof(page: Page, batchId: string) {
  await page.goto(`/evidence/contribute?entityType=batch&entityId=${batchId}`);
  await expect(page.getByLabel('Evidence record', { exact: true })).toHaveValue(batchId);
  await page.getByLabel('Document purpose', { exact: true }).selectOption('weighing_ticket');
  await page
    .getByLabel('Evidence explanation', { exact: true })
    .fill('Measured physical inventory recorded for this browser journey.');
  await page.getByLabel('Evidence file', { exact: true }).setInputFiles({
    name: 'harvest-weight.pdf',
    mimeType: 'application/pdf',
    buffer: emptyPdfFixture(),
  });
  await page.getByRole('button', { name: 'Attach evidence', exact: true }).click();
  await expect(page.getByText(/Evidence attached to/)).toBeVisible();
  const response = await page.request.get(`/api/evidence?entityType=batch&entityId=${batchId}`);
  expect(response.status()).toBe(200);
  expect(
    (await response.json()).some(
      (row: { linked_entity_id: string; type: string }) =>
        row.linked_entity_id === batchId && row.type === 'weighing_ticket',
    ),
  ).toBe(true);
}

async function publish(page: Page, holdingId: string, quantity: string) {
  await page.goto(`/supply/new?holding=${holdingId}`);
  await expect(page.getByLabel('Offer quantity (kg)', { exact: true })).toHaveValue(
    new RegExp(`^${quantity}(?:\\.0+)?$`),
  );
  await page.getByLabel('Price per kg', { exact: true }).fill('4.25');
  await page.getByLabel('Supply currency', { exact: true }).selectOption('USD');
  await page.getByRole('combobox', { name: /^Incoterm/ }).selectOption('FOB');
  await page.getByLabel('Destination', { exact: true }).fill('Tema');
  const saved = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/listings' && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Publish supply', exact: true }).click();
  const response = await saved;
  expect(response.status()).toBe(201);
  const listing = await response.json();
  await expect(page).toHaveURL(new RegExp(`/listing/${listing.id}$`));
  await page.reload();
  const persisted = await page.request.get(`/api/listings/${listing.id}`);
  expect(persisted.status()).toBe(200);
  const record = await persisted.json();
  expect(record.holding_id).toBe(holdingId);
  expect(Number(record.available_quantity_kg)).toBe(Number(quantity));
  expect(Number(record.price_per_kg)).toBe(4.25);
  expect(record.currency).toBe('USD');
  expect(record.incoterm).toBe('FOB');
  return record;
}

// Setup-only assurance record: the customer creates all physical source records,
// evidence and listing through real UI. This does NOT test certifier onboarding,
// accreditation, certificate issuance or attestation authorization workflows.
async function independentOrganicReview(batchId: string, farmId: string) {
  const connectionString = requireDisposableTestDatabase(
    process.env.COCOATRACE_BROWSER_DATABASE_URL,
  );
  const url = new URL(connectionString);
  if (
    url.pathname !== '/cocoatrace_browser_test' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname)
  )
    throw new Error('Organic review fixture requires the dedicated local browser database');
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const batch = await client.query(
      'SELECT b.crop,f.farmer_organization_id FROM harvest_batches b JOIN farms f ON f.id=b.farm_id WHERE b.id=$1 AND f.id=$2',
      [batchId, farmId],
    );
    expect(batch.rows).toHaveLength(1);
    const reviewerName = `Independent browser certifier ${crypto.randomUUID()}`;
    const certifier = (
      await client.query(
        "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'certifier','GH','verified') RETURNING id",
        [reviewerName],
      )
    ).rows[0].id;
    const reviewer = (
      await client.query(
        'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
        [
          certifier,
          `${crypto.randomUUID()}@browser.test`,
          'fixture-no-login',
          'Independent reviewer',
        ],
      )
    ).rows[0].id;
    const certificate = (
      await client.query(
        "INSERT INTO organic_certificates(certifier_organization_id,farmer_organization_id,farm_id,standard,crop_scope,valid_from,valid_to,issuing_authority,accreditation_reference) VALUES($1,$2,$3,'EU_ORGANIC',$4,CURRENT_DATE-1,CURRENT_DATE+30,'Browser fixture authority','BROWSER-ORGANIC') RETURNING id",
        [certifier, batch.rows[0].farmer_organization_id, farmId, [batch.rows[0].crop]],
      )
    ).rows[0].id;
    const attestation = (
      await client.query(
        "INSERT INTO batch_attestations(batch_id,certificate_id,certifier_user_id,certifier_organization_id,provenance_hash) VALUES($1,$2,$3,$4,'browser-review-fixture') RETURNING id",
        [batchId, certificate, reviewer, certifier],
      )
    ).rows[0].id;
    await client.query('UPDATE harvest_batches SET attestation_id=$1 WHERE id=$2', [
      attestation,
      batchId,
    ]);
    await client.query('COMMIT');
    return reviewerName;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

test('conventional supplier creates physical inventory, attaches proof and publishes a persisted offer without invented farm or organic claims', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await createWorkspace(page, browser, 'supplier');
  await page.goto('/supply/new');
  await page.getByRole('button', { name: 'Create inventory', exact: true }).click();
  await page.getByLabel('Commodity or material', { exact: true }).fill('peanut');
  await page.getByLabel('Quantity (kg)', { exact: true }).fill('25');
  await page.getByLabel('Country of origin (ISO code)', { exact: true }).fill('GH');
  await page.getByLabel('Warehouse location', { exact: true }).fill('Tamale warehouse');
  const created = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/inventory/direct' && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create inventory', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const inventory = await response.json();
  await attachHarvestProof(page, inventory.id);
  const listing = await publish(page, inventory.holding_id, '25');
  expect(listing.trust.organic.status).toBe('not_claimed');
  expect(listing.farm_id || null).toBeNull();
  expect(await (await page.request.get('/api/farms')).json()).toEqual([]);
  const claim = page
    .getByRole('region', { name: 'Claim evidence and review', exact: true })
    .locator('summary')
    .filter({ hasText: /^Organic/ });
  await expect(claim).toContainText('Not claimed');
});

test('source supplier creates farm, plot and harvest, attaches proof, and publishes with independently attributed organic review fixture', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await createWorkspace(page, browser, 'supplier');
  await page.goto('/supply/new');
  await page.getByRole('button', { name: 'Register source', exact: true }).click();
  await page.getByRole('button', { name: '+ Create Farm', exact: true }).first().click();
  await page.getByPlaceholder('Farm name *', { exact: true }).fill('Publishing source farm');
  await page.getByPlaceholder('Region *', { exact: true }).fill('Northern');
  await page.getByPlaceholder('District *', { exact: true }).fill('Tamale');
  const createdFarm = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/farms' && r.request().method() === 'POST',
  );
  await page.locator('.modal').getByRole('button', { name: 'Create Farm', exact: true }).click();
  const farmResponse = await createdFarm;
  expect(farmResponse.status()).toBe(201);
  const farm = await farmResponse.json();
  await page.getByRole('button', { name: '+ Add Plot', exact: true }).click();
  await page.getByPlaceholder('Plot code * (e.g. PLOT-A-01)', { exact: true }).fill('PUBLISH-1');
  await page.getByPlaceholder('Area (hectares) *', { exact: true }).fill('2');
  await page.getByPlaceholder('GPS Lat', { exact: true }).fill('9.4');
  await page.getByPlaceholder('GPS Lng', { exact: true }).fill('-0.8');
  await page.locator('.modal').getByRole('button', { name: 'Add Plot', exact: true }).click();
  await expect(page.getByText('Source ready', { exact: true })).toBeVisible();
  expect(await (await page.request.get('/api/batches')).json()).toEqual([]);
  await page.goto('/batches');
  await page.getByRole('button', { name: '+ Create Batch', exact: true }).first().click();
  await page.getByLabel('Select source farm', { exact: true }).selectOption(farm.id);
  await page.locator('.modal input[type=date]').fill(new Date().toISOString().slice(0, 10));
  await page.getByPlaceholder('Quantity (kg) *', { exact: true }).fill('100');
  const createdBatch = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/batches' && r.request().method() === 'POST',
  );
  await page.locator('.modal').getByRole('button', { name: 'Create Batch', exact: true }).click();
  const batchResponse = await createdBatch;
  expect(batchResponse.status()).toBe(201);
  const batch = await batchResponse.json();
  expect(batch.farm_id).toBe(farm.id);
  const before = await page.request.get(`/api/batches/${batch.id}`);
  expect(before.status()).toBe(200);
  expect((await before.json()).batch.trust.organic.status).not.toBe('reviewed');
  await attachHarvestProof(page, batch.id);
  const reviewerName = await independentOrganicReview(batch.id, farm.id);
  expect(batch.holding_id).toBeTruthy();
  const listing = await publish(page, batch.holding_id, '100');
  expect(listing.trust.organic.status).toBe('reviewed');
  expect(listing.trust.organic.reviewerName).toBe(reviewerName);
  const claims = page.getByRole('region', { name: 'Claim evidence and review', exact: true });
  await claims
    .locator('summary')
    .filter({ hasText: /^Organic/ })
    .click();
  await expect(claims).toContainText(reviewerName);
  await expect(claims).toContainText('BROWSER-ORGANIC');
});
