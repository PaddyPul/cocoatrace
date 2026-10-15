import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';

type Actor = { organizationId: string; token: string };
type Supply = { batchId: string; holdingId: string };
let seller: Actor;
let buyer: Actor;
let outsider: Actor;

async function actor(type: 'exporter' | 'importer'): Promise<Actor> {
  const suffix = crypto.randomUUID();
  const organization = await query(
    "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id",
    [`Trading ${suffix}`, type],
  );
  const email = `trade-${suffix}@integration.test`;
  const password = 'TradingRegressionPassword123!';
  const user = await query(
    'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
    [organization.rows[0].id, email, await bcrypt.hash(password, 4), 'Trading Regression'],
  );
  const role = await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
    `trading-${suffix}`,
    [
      'batch.create',
      'holding.read',
      'holding.create',
      'custody.transfer.request',
      'custody.transfer.accept',
      'listing.read',
      'listing.create',
      'offer.create',
      'offer.respond',
      'contract.read',
    ],
  ]);
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [
    user.rows[0].id,
    role.rows[0].id,
  ]);
  const login = await request(app).post('/auth/login').send({ email, password });
  expect(login.status).toBe(200);
  return { organizationId: organization.rows[0].id, token: login.body.accessToken };
}

async function supply(quantity = 1000, allocate = true): Promise<Supply> {
  const batch = await query(
    "INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES('shea nuts',CURRENT_DATE,$1,$2,'direct_inventory','Regression Source','GH') RETURNING id",
    [quantity, seller.organizationId],
  );
  if (!allocate) return { batchId: batch.rows[0].id, holdingId: '' };
  const holding = await query(
    'INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,$3) RETURNING id',
    [batch.rows[0].id, seller.organizationId, quantity],
  );
  return { batchId: batch.rows[0].id, holdingId: holding.rows[0].id };
}

async function listing(s: Supply, quantity = 1000): Promise<string> {
  const result = await query(
    "INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location) VALUES($1,$2,$3,5,'EUR','FOB','Tema','Rotterdam') RETURNING id",
    [seller.organizationId, s.holdingId, quantity],
  );
  return result.rows[0].id;
}

async function offer(listingId: string, quantity = 600, expired = false): Promise<string> {
  const result = await query(
    "INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,$3,5,'EUR',$4) RETURNING id",
    [
      listingId,
      buyer.organizationId,
      quantity,
      new Date(Date.now() + (expired ? -86400000 : 86400000)),
    ],
  );
  return result.rows[0].id;
}

function accept(id: string, principal = seller) {
  return request(app)
    .post(`/offers/${id}/accept`)
    .set('Authorization', `Bearer ${principal.token}`);
}

async function conserved(s: Supply, quantity = 1000) {
  const result = await query(
    "SELECT COALESCE(SUM(quantity_kg) FILTER(WHERE status<>'transferred'),0)::numeric AS total, COUNT(*) FILTER(WHERE quantity_kg<=0)::int AS non_positive FROM batch_holdings WHERE batch_id=$1",
    [s.batchId],
  );
  expect(Number(result.rows[0].total)).toBe(quantity);
  expect(result.rows[0].non_positive).toBe(0);
  const allocations = await query(
    'SELECT h.id,h.quantity_kg,COALESCE(SUM(l.available_quantity_kg) FILTER(WHERE l.active),0) AS listed FROM batch_holdings h LEFT JOIN listings l ON l.holding_id=h.id WHERE h.batch_id=$1 GROUP BY h.id',
    [s.batchId],
  );
  for (const h of allocations.rows)
    expect(Number(h.listed)).toBeLessThanOrEqual(Number(h.quantity_kg));
}

async function contractCounts(s: Supply) {
  const result = await query(
    `SELECT COUNT(DISTINCT c.id)::int AS contracts,COUNT(DISTINCT p.id)::int AS payments,COUNT(DISTINCT sh.id)::int AS shipments,COUNT(DISTINCT f.id)::int AS fees
    FROM sales_contracts c JOIN batch_holdings h ON h.id=c.holding_id LEFT JOIN payment_requests p ON p.contract_id=c.id LEFT JOIN shipments sh ON sh.contract_id=c.id LEFT JOIN platform_fee_invoices f ON f.contract_id=c.id WHERE h.batch_id=$1`,
    [s.batchId],
  );
  return result.rows[0];
}

async function transfer(s: Supply, quantity: number): Promise<string> {
  const result = await query(
    'INSERT INTO custody_transfers(holding_id,from_organization_id,to_organization_id,quantity_kg) VALUES($1,$2,$3,$4) RETURNING id',
    [s.holdingId, seller.organizationId, buyer.organizationId, quantity],
  );
  return result.rows[0].id;
}

beforeAll(async () => {
  seller = await actor('exporter');
  buyer = await actor('importer');
  outsider = await actor('exporter');
});
afterAll(async () => {
  await pool.end();
});

describe('buyer pending offer withdrawal', () => {
  function withdraw(id: string, principal = buyer) {
    return request(app)
      .post(`/offers/${id}/withdraw`)
      .set('Authorization', `Bearer ${principal.token}`);
  }
  it('allows only its buyer, audits once and leaves supply unchanged on replay', async () => {
    const s = await supply();
    const l = await listing(s);
    const id = await offer(l);
    const before = (
      await query('SELECT quantity_kg,status FROM batch_holdings WHERE id=$1', [s.holdingId])
    ).rows[0];
    for (const actor of [seller, outsider]) expect((await withdraw(id, actor)).status).toBe(404);
    expect((await withdraw(crypto.randomUUID())).status).toBe(404);
    const responses = await Promise.all([withdraw(id), withdraw(id)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(responses.every((r) => r.body.status === 'cancelled')).toBe(true);
    expect(
      (
        await query(
          "SELECT COUNT(*)::int n FROM audit_events WHERE action='offer.withdraw' AND entity_id=$1",
          [id],
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (await query('SELECT quantity_kg,status FROM batch_holdings WHERE id=$1', [s.holdingId]))
        .rows[0],
    ).toEqual(before);
    expect((await query('SELECT active FROM listings WHERE id=$1', [l])).rows[0].active).toBe(true);
    expect(await contractCounts(s)).toEqual({ contracts: 0, payments: 0, shipments: 0, fees: 0 });
    expect((await accept(id)).status).toBe(409);
  });
  it('serializes seller acceptance against buyer withdrawal into one terminal outcome', async () => {
    const s = await supply();
    const id = await offer(await listing(s));
    const [accepted, withdrawn] = await Promise.all([accept(id), withdraw(id)]);
    expect([accepted.status, withdrawn.status].sort()).toEqual([200, 409]);
    const state = (await query('SELECT status FROM trade_offers WHERE id=$1', [id])).rows[0].status;
    expect(['accepted', 'cancelled']).toContain(state);
    expect((await contractCounts(s)).contracts).toBe(state === 'accepted' ? 1 : 0);
    await conserved(s);
  });
  it.each(['rejected', 'expired', 'accepted'])('does not withdraw a %s offer', async (status) => {
    const s = await supply();
    const id = await offer(await listing(s));
    await query('UPDATE trade_offers SET status=$1 WHERE id=$2', [status, id]);
    expect((await withdraw(id)).status).toBe(409);
    expect((await query('SELECT status FROM trade_offers WHERE id=$1', [id])).rows[0].status).toBe(
      status,
    );
  });
  it('rolls back the withdrawal if its audit cannot commit', async () => {
    const s = await supply();
    const id = await offer(await listing(s));
    const trigger = 'withdraw_audit_' + crypto.randomUUID().replaceAll('-', '');
    await query(
      `CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='offer.withdraw' AND NEW.entity_id='${id}'::uuid THEN RAISE EXCEPTION 'injected withdrawal audit failure'; END IF; RETURN NEW; END $$`,
    );
    await query(
      `CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ${trigger}()`,
    );
    try {
      expect((await withdraw(id)).status).toBe(500);
      expect(
        (await query('SELECT status FROM trade_offers WHERE id=$1', [id])).rows[0].status,
      ).toBe('pending');
      expect(
        (
          await query(
            "SELECT COUNT(*)::int n FROM audit_events WHERE action='offer.withdraw' AND entity_id=$1",
            [id],
          )
        ).rows[0].n,
      ).toBe(0);
    } finally {
      await query(`DROP TRIGGER ${trigger} ON audit_events`);
      await query(`DROP FUNCTION ${trigger}()`);
    }
  });
  it('requires credentials, create permission and UUID validation', async () => {
    expect((await request(app).post(`/offers/${crypto.randomUUID()}/withdraw`)).status).toBe(401);
    expect((await withdraw('not-a-uuid')).status).toBe(400);
    const noCreate = await actor('importer');
    await query(
      "UPDATE roles SET permissions=ARRAY['contract.read']::text[] WHERE id IN(SELECT ur.role_id FROM user_roles ur JOIN users u ON u.id=ur.user_id WHERE u.organization_id=$1)",
      [noCreate.organizationId],
    );
    expect((await withdraw(crypto.randomUUID(), noCreate)).status).toBe(403);
  });
});
