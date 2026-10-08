import { paymentPage } from '../../src/modules/catalog/payments';
import { withCatalogRead } from '../../src/modules/catalog/paging';
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
      ['payment.read', 'payment.request', 'payment.confirm'],
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
  for (const row of stocks) {
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
  for (const row of stocks)
    await query(
      `INSERT INTO payment_requests(contract_id,requested_by_organization_id,amount_total,currency,status,payment_reference_external)
 SELECT id,seller_organization_id,5,'EUR','payment_due','PAY-'||id FROM sales_contracts WHERE id=ANY($1::uuid[])`,
      [row.contracts],
    );
});
describe('payment pages and complete counts', () => {
  it('pages 1,005 workflows, searches off-page and binds cursors to parties and filters', async () => {
    const first = await get('/payment-requests/page', { limit: '100', direction: 'sales' });
    expect(first.status, first.body.code).toBe(200);
    expect(first.body.items).toHaveLength(100);
    const next = await get('/payment-requests/page', {
      limit: '100',
      direction: 'sales',
      cursor: first.body.nextCursor,
    });
    expect(next.status, next.body.code).toBe(200);
    const ids = [...first.body.items, ...next.body.items].map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(200);
    expect(ids).toEqual([...ids].sort());
    await withCatalogRead(async (execute) => {
      const page = await paymentPage(
        async (sql, parameters) => {
          const explained = await execute(
            `EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${sql}`,
            parameters,
          );
          const plan = (explained.rows[0]['QUERY PLAN'] as { Plan: Record<string, unknown> }[])[0]
            .Plan;
          expect(plan['Node Type']).toBe('Limit');
          expect(Number(plan['Actual Rows'])).toBeLessThanOrEqual(101);
          return execute(sql, parameters);
        },
        seller.org,
        { limit: '100' },
      );
      expect(page.items).toHaveLength(100);
    });
    const later = (
      await query(
        'SELECT id,contract_id FROM payment_requests WHERE contract_id=ANY($1::uuid[]) AND NOT(id=ANY($2::uuid[])) LIMIT 1',
        [own.contracts, ids],
      )
    ).rows[0];
    const found = await get('/payment-requests/page', { search: later.id });
    expect(found.status, found.body.code).toBe(200);
    expect(found.body.items.map((r: { id: string }) => r.id)).toEqual([later.id]);
    expect(
      (await get('/payment-requests/page', { search: later.id, direction: 'purchases' }, buyer))
        .body.items[0].id,
    ).toBe(later.id);
    expect(
      (await get('/payment-requests/page', { search: later.id }, outsider)).body.items,
    ).toEqual([]);
    expect((await get('/payment-requests/page', { direction: 'purchases' })).body.items).toEqual(
      [],
    );
    expect((await get('/payment-requests/page', { search: '%' })).body.items).toEqual([]);
    await query(
      "UPDATE payment_requests SET currency='JPY',currency_minor_units=0,payment_reference_external='LITERAL_%_PAY' WHERE id=$1",
      [later.id],
    );
    const literal = await get('/payment-requests/page', { search: '_%_', currency: 'JPY' });
    expect(literal.status, literal.body.code).toBe(200);
    expect(literal.body.items.map((r: { id: string }) => r.id)).toEqual([later.id]);
    expect(
      (await get('/payment-requests/page', { search: later.id, currency: 'USD' })).body.items,
    ).toEqual([]);
    for (const changed of [
      { direction: 'purchases' },
      { direction: 'sales', currency: 'JPY' },
      { direction: 'sales', status: 'open' },
      { direction: 'sales', search: 'changed' },
    ] as Record<string, string>[])
      expect(
        (await get('/payment-requests/page', { ...changed, cursor: first.body.nextCursor })).status,
      ).toBe(400);
    expect(
      (
        await get(
          '/payment-requests/page',
          { direction: 'sales', cursor: first.body.nextCursor },
          buyer,
        )
      ).status,
    ).toBe(400);
    const legacy = await get('/payment-requests');
    expect(legacy.status).toBe(422);
    expect(legacy.body.code).toBe('CATALOG_READ_LIMIT');
  });
  it('counts all workflows independently from page/filter and never adds unlike currencies', async () => {
    await query("UPDATE payment_requests SET status='settled' WHERE contract_id=$1", [
      own.contracts[0],
    ]);
    await query("UPDATE sales_contracts SET status='cancelled' WHERE id=$1", [own.contracts[1]]);
    await query("UPDATE sales_contracts SET status='settled' WHERE id=$1", [own.contracts[2]]);
    const totals = await get('/payment-requests/summary');
    expect(totals.status, totals.body.code).toBe(200);
    expect(totals.body).toEqual({
      count: 1005,
      open_count: 1002,
      settled_count: 1,
      cancelled_count: 1,
    });
    expect((await get('/payment-requests/page', { status: 'settled' })).body.items).toHaveLength(1);
    expect(
      (await get('/payment-requests/page', { status: 'open', search: own.contracts[1] })).body
        .items,
    ).toEqual([]);
    expect((await get('/payment-requests/summary', {}, outsider)).body.count).toBe(1);
  });
  it('keeps details private and does not allow a wrong-party payment submission', async () => {
    const id = (
      await query('SELECT id FROM payment_requests WHERE contract_id=$1', [own.contracts[4]])
    ).rows[0].id;
    expect((await get('/payment-requests/' + id, {}, seller)).status).toBe(200);
    expect((await get('/payment-requests/' + id, {}, buyer)).status).toBe(200);
    expect((await get('/payment-requests/' + id, {}, outsider)).status).toBe(403);
    const write = await request(app)
      .post('/payment-requests/' + id + '/pay')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ transactionReference: 'WRONG-PARTY' });
    expect(write.status, write.body.code).toBe(404);
    expect(
      (
        await query('SELECT status,payment_reference_external FROM payment_requests WHERE id=$1', [
          id,
        ])
      ).rows[0],
    ).toMatchObject({
      status: 'payment_due',
      payment_reference_external: 'PAY-' + own.contracts[4],
    });
  });
  it('validates inputs and denies unrelated read-all and missing permissions', async () => {
    for (const invalid of [
      { limit: '101' },
      { direction: 'foreign' },
      { status: 'invalid' },
      { currency: '12' },
      { search: 'x'.repeat(81) },
    ] as Record<string, string>[])
      expect((await get('/payment-requests/page', invalid)).status).toBe(400);
    expect((await request(app).get('/payment-requests/page')).status).toBe(401);
    await query(
      "UPDATE roles r SET permissions=ARRAY['payment.read','payment.read.all']::text[] FROM user_roles ur WHERE ur.role_id=r.id AND ur.user_id=$1",
      [outsider.user],
    );
    expect(
      (await get('/payment-requests/page', { search: own.contracts[0] }, outsider)).body.items,
    ).toEqual([]);
    await query(
      'UPDATE roles r SET permissions=ARRAY[]::text[] FROM user_roles ur WHERE ur.role_id=r.id AND ur.user_id=$1',
      [outsider.user],
    );
    expect((await get('/payment-requests/page', {}, outsider)).status).toBe(403);
    expect((await get('/payment-requests/summary', {}, outsider)).status).toBe(403);
  });
});
