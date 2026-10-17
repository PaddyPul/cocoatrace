import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { requireDisposableTestDatabase } from '../../src/testing/databaseSafety';
import {
  createActor,
  createSupply,
  createListing,
  createOffer,
  createContract,
  createShipment,
} from './support/fixtures';
beforeAll(async () => {
  requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  await query('TRUNCATE auth_rate_limits');
});
afterAll(async () => {
  await pool.end();
});
it('creates independent authenticated tenants with explicit current permissions and linked physical trade records', async () => {
  const seller = await createActor({
    type: 'exporter',
    permissions: ['holding.read', 'contract.read', 'shipment.read'],
  });
  const buyer = await createActor({ type: 'importer', permissions: ['contract.read'] });
  expect(seller.organizationId).not.toBe(buyer.organizationId);
  expect(seller.roleId).not.toBe(buyer.roleId);
  for (const actor of [seller, buyer]) {
    const me = await request(app).get('/me').set('Authorization', `Bearer ${actor.token}`);
    expect(me.status, JSON.stringify(me.body)).toBe(200);
  }
  const stock = await createSupply(seller, { quantityKg: 120, crop: 'peanut' });
  const terms = { quantityKg: 80, pricePerKg: 7, currency: 'GHS', incoterm: 'DAP' } as const;
  const listing = await createListing(seller, stock, {
    ...terms,
    origin: 'Tamale',
    destination: 'Accra',
  });
  const offer = await createOffer(buyer, listing, terms);
  const contract = await createContract(seller, buyer, stock, listing, offer, terms);
  const shipment = await createShipment(contract, {
    coordinatorOrganizationId: seller.organizationId,
  });
  const linked = await query(
    `SELECT hb.source_mode, bh.quantity_kg::text AS physical_quantity, l.origin_location,l.destination_location,l.currency,l.incoterm,c.buyer_organization_id,sh.transport_coordinator_organization_id FROM shipments sh JOIN sales_contracts c ON c.id=sh.contract_id JOIN listings l ON l.id=c.listing_id JOIN batch_holdings bh ON bh.id=l.holding_id JOIN harvest_batches hb ON hb.id=bh.batch_id WHERE sh.id=$1`,
    [shipment],
  );
  expect(linked.rows[0]).toMatchObject({
    source_mode: 'direct_inventory',
    origin_location: 'Tamale',
    destination_location: 'Accra',
    currency: 'GHS',
    incoterm: 'DAP',
    buyer_organization_id: buyer.organizationId,
    transport_coordinator_organization_id: seller.organizationId,
  });
  expect(Number(linked.rows[0].physical_quantity)).toBe(120);
  // A valid fixture session must still obey live role reduction, rather than forging claims.
  await query('UPDATE roles SET permissions=ARRAY[]::text[] WHERE id=$1', [seller.roleId]);
  expect(
    (await request(app).get('/holdings/page').set('Authorization', `Bearer ${seller.token}`))
      .status,
  ).toBe(403);
});
it('refuses all fixture writes outside an explicitly disposable database', async () => {
  const oldTest = process.env.TEST_DATABASE_URL;
  const oldDatabase = process.env.DATABASE_URL;
  process.env.TEST_DATABASE_URL = 'postgresql://localhost/bettertrade_production';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  try {
    await expect(createActor({ type: 'exporter', permissions: [] })).rejects.toThrow('Refusing');
    // The guard runs before actor/supply dereferencing and before any SQL write.
    const actor = {
      organizationId: '',
      userId: '',
      roleId: '',
      email: '',
      password: '',
      token: '',
    };
    const stock = { batchId: '', holdingId: '', quantityKg: 1 };
    const terms = { quantityKg: 1, pricePerKg: 1, currency: 'EUR', incoterm: 'FOB' } as const;
    await expect(createSupply(actor, { quantityKg: 1 })).rejects.toThrow('Refusing');
    await expect(
      createListing(actor, stock, { ...terms, origin: 'Tema', destination: 'Accra' }),
    ).rejects.toThrow('Refusing');
    await expect(createOffer(actor, '', terms)).rejects.toThrow('Refusing');
    await expect(createContract(actor, actor, stock, '', '', terms)).rejects.toThrow('Refusing');
    await expect(createShipment('')).rejects.toThrow('Refusing');
  } finally {
    if (oldTest === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = oldTest;
    if (oldDatabase === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldDatabase;
  }
});
