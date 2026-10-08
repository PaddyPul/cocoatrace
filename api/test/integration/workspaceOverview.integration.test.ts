import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
type Actor = { org: string; token: string; user: string };
type Stock = {
  farms: string[];
  batches: string[];
  holdings: string[];
  listings: string[];
  offers: string[];
  contracts: string[];
  shipments: string[];
};
let seller: Actor, buyer: Actor, outsider: Actor;
const stocks: Stock[] = [];
let own: Stock, foreign: Stock;
async function actor(): Promise<Actor> {
  const unique = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      [`Selection ${unique}`],
    )
  ).rows[0].id;
  const email = `selection-${unique}@integration.test`;
  const user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, email, await bcrypt.hash('EvidenceSelection123!', 4), 'Selection test'],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      `selection-${unique}`,
      [
        'batch.read',
        'farm.read',
        'shipment.read',
        'contract.read',
        'listing.read',
        'offer.respond',
        'payment.read',
        'evidence.read',
      ],
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const signed = await request(app)
    .post('/auth/login')
    .send({ email, password: 'EvidenceSelection123!' });
  expect(signed.status).toBe(200);
  return { org, user, token: signed.body.accessToken };
}
async function stock(owner: Actor, count: number): Promise<Stock> {
  const result: Stock = {
    farms: [],
    batches: [],
    holdings: [],
    listings: [],
    offers: [],
    contracts: [],
    shipments: [],
  };
  stocks.push(result);
  result.farms = (
    await query(
      "INSERT INTO farms(farmer_organization_id,name,country,region,district) SELECT $1,'Evidence source '||n,'GH','Northern','Tamale' FROM generate_series(1,$2::int) n RETURNING id",
      [owner.org, count],
    )
  ).rows.map((row) => row.id);
  result.batches = (
    await query(
      "INSERT INTO harvest_batches(farm_id,crop,harvest_date,quantity_kg,current_holder_id) SELECT id,'shea',CURRENT_DATE,1,$1 FROM farms WHERE id=ANY($2::uuid[]) RETURNING id",
      [owner.org, result.farms],
    )
  ).rows.map((row) => row.id);
  result.holdings = (
    await query(
      "INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg,status) SELECT id,$1,1,'committed' FROM harvest_batches WHERE id=ANY($2::uuid[]) RETURNING id",
      [owner.org, result.batches],
    )
  ).rows.map((row) => row.id);
  result.listings = (
    await query(
      "INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location,active) SELECT $1,id,0,5,'EUR','FOB','Tema','Accra',false FROM batch_holdings WHERE id=ANY($2::uuid[]) RETURNING id",
      [owner.org, result.holdings],
    )
  ).rows.map((row) => row.id);
  result.offers = (
    await query(
      "INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until,status) SELECT id,$1,1,5,'EUR',NOW()+INTERVAL '1 day','accepted' FROM listings WHERE id=ANY($2::uuid[]) RETURNING id",
      [buyer.org, result.listings],
    )
  ).rows.map((row) => row.id);
  result.contracts = (
    await query(
      "INSERT INTO sales_contracts(listing_id,offer_id,seller_organization_id,buyer_organization_id,holding_id,quantity_kg,price_per_kg,currency,incoterm) SELECT l.id,o.id,l.seller_organization_id,o.buyer_organization_id,l.holding_id,1,5,'EUR','FOB' FROM trade_offers o JOIN listings l ON l.id=o.listing_id WHERE o.id=ANY($1::uuid[]) RETURNING id",
      [result.offers],
    )
  ).rows.map((row) => row.id);
  result.shipments = (
    await query(
      "INSERT INTO shipments(contract_id,transport_coordinator_organization_id,logistics_organization_id,booking_reference) SELECT id,$1,$2,'SELECTION-'||id FROM sales_contracts WHERE id=ANY($3::uuid[]) RETURNING id",
      [buyer.org, outsider.org, result.contracts],
    )
  ).rows.map((row) => row.id);
  return result;
}
const get = (path: string, parameters: Record<string, string> = {}, who = seller) =>
  request(app).get(path).query(parameters).set('Authorization', `Bearer ${who.token}`);
beforeAll(async () => {
  seller = await actor();
  buyer = await actor();
  outsider = await actor();
  own = await stock(seller, 1005);
  foreign = await stock(outsider, 1);
});
afterAll(async () => {
  await query(
    'DELETE FROM recall_safety_holds WHERE recall_id IN (SELECT id FROM recall_notices WHERE initiated_by_organization_id=ANY($1::uuid[]))',
    [[seller.org, outsider.org]],
  );
  await query('DELETE FROM recall_notices WHERE initiated_by_organization_id=ANY($1::uuid[])', [
    [seller.org, outsider.org],
  ]);
  for (const row of stocks) {
    await query('DELETE FROM evidence_items WHERE uploader_organization_id=$1', [
      row === own ? seller.org : outsider.org,
    ]);
    await query('DELETE FROM product_profiles WHERE batch_id=ANY($1::uuid[])', [row.batches]);
    await query('DELETE FROM material_lots WHERE batch_id=ANY($1::uuid[])', [row.batches]);
    await query('DELETE FROM shipments WHERE id=ANY($1::uuid[])', [row.shipments]);
    await query('DELETE FROM payment_requests WHERE contract_id=ANY($1::uuid[])', [row.contracts]);
    await query('DELETE FROM sales_contracts WHERE id=ANY($1::uuid[])', [row.contracts]);
    await query('DELETE FROM trade_offers WHERE id=ANY($1::uuid[])', [row.offers]);
    await query('DELETE FROM listings WHERE id=ANY($1::uuid[])', [row.listings]);
    await query('DELETE FROM batch_holdings WHERE id=ANY($1::uuid[])', [row.holdings]);
    await query('DELETE FROM harvest_batches WHERE id=ANY($1::uuid[])', [row.batches]);
    await query('DELETE FROM farms WHERE id=ANY($1::uuid[])', [row.farms]);
  }
  await pool.end();
});

beforeAll(async () => {
  for (const row of stocks) {
    const owner = row === own ? seller : outsider;
    await query(
      `INSERT INTO product_profiles(batch_id,slug,display_name,lot_code,visibility) SELECT id,'overview-'||id,'Overview product','OV-'||id,'published' FROM harvest_batches WHERE id=ANY($1::uuid[])`,
      [row.batches],
    );
    await query(
      `INSERT INTO material_lots(lot_code,lot_type,batch_id,product_name,quantity_kg,owner_organization_id) SELECT 'OV-'||id,'source',id,'shea',1,$1 FROM harvest_batches WHERE id=ANY($2::uuid[])`,
      [owner.org, row.batches],
    );
    await query(
      `INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id,review_status) SELECT $1,$2,'source_proof','source.pdf',repeat('a',64),'batch',id,'pending' FROM harvest_batches WHERE id=ANY($3::uuid[])`,
      [owner.user, owner.org, row.batches],
    );
    await query(
      `UPDATE harvest_batches SET organic_claim_status='attested' WHERE id=ANY($1::uuid[])`,
      [row.batches],
    );
  }
});
describe('full workspace aggregate access and large histories', () => {
  it('counts 1,005 records without first-page truncation or legacy attestation claims', async () => {
    const response = await get('/workspace/overview');
    expect(response.status, response.body.code).toBe(200);
    expect(response.body.batches).toEqual({ count: 1005, reviewed_count: 0 });
    expect(response.body.products).toEqual({ count: 1005, published_count: 1005, held_count: 0 });
    expect(response.body.lots.count).toBe(1005);
    expect(Number(response.body.lots.source_kg)).toBe(1005);
    expect(response.body.evidence).toEqual({ count: 1005 });
    expect(response.body.shipments.count).toBe(1005);
    expect(response.body.contracts.count).toBe(1005);
    expect(response.body).not.toHaveProperty('rows');
    expect(JSON.stringify(response.body)).not.toContain('source.pdf');
    const other = await get('/workspace/overview', {}, outsider);
    expect(other.status, other.body.code).toBe(200);
    expect(other.body.batches.count).toBe(1);
    expect(other.body.evidence.count).toBe(1);
    expect(other.body.contracts.count).toBe(1);
  });
  it('does not lose product safety holds when the notice is resolved', async () => {
    const recall = (
      await query(
        `INSERT INTO recall_notices(reference_code,title,reason,instructions,severity,status,initiated_by_user_id,initiated_by_organization_id) VALUES($1,'Overview safety','Test only','Hold stock','warning','resolved',$2,$3) RETURNING id`,
        ['OV-' + crypto.randomUUID(), seller.user, seller.org],
      )
    ).rows[0].id;
    await query(
      `INSERT INTO recall_safety_holds(recall_id,entity_type,entity_id) VALUES($1,'holding',$2)`,
      [recall, own.holdings[0]],
    );
    const totals = await get('/workspace/overview');
    expect(totals.status, totals.body.code).toBe(200);
    expect(totals.body.products.held_count).toBe(1);
    expect(totals.body.recalls.active_count).toBe(0);
  });
  it('returns only relationship-scoped recall counts and null for resources without read permissions', async () => {
    await query(
      "UPDATE roles r SET permissions=ARRAY['batch.create','shipment.update','evidence.upload','analytics.read.network']::text[] FROM user_roles ur WHERE ur.role_id=r.id AND ur.user_id=$1",
      [outsider.user],
    );
    const totals = await get('/workspace/overview', {}, outsider);
    expect(totals.status, totals.body.code).toBe(200);
    expect(totals.body.batches).toBeNull();
    expect(totals.body.lots).toBeNull();
    expect(totals.body.evidence).toBeNull();
    expect(totals.body.contracts).toBeNull();
    expect(totals.body.shipments).toBeNull();
    expect(totals.body.recalls).toEqual({ count: 0, active_count: 0 });
    expect((await get('/workspace/overview', { limit: '50' })).status).toBe(400);
    expect((await request(app).get('/workspace/overview')).status).toBe(401);
  });
  it('computes readiness reviewed counts without hydrating all trust rows', async () => {
    const result = await get('/readiness');
    expect(result.status, result.body.code).toBe(200);
    expect(result.body.facts.batchesTotal).toBe(1005);
    expect(result.body.facts.batchesAttested).toBe(0);
  });
});
