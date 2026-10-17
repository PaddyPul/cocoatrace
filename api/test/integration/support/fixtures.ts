import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import app from '../../../src/app';
import { query } from '../../../src/db';
import { requireDisposableTestDatabase } from '../../../src/testing/databaseSafety';

/** Native fixtures create real sessions and explicit roles; they never depend on demo seeds. */
export type FixtureActor = {
  organizationId: string;
  userId: string;
  roleId: string;
  email: string;
  password: string;
  token: string;
};
export type FixtureSupply = { batchId: string; holdingId: string; quantityKg: number };
export type CommercialTerms = {
  quantityKg: number;
  pricePerKg: number;
  currency: 'EUR' | 'USD' | 'GHS' | 'GBP' | 'JPY';
  incoterm: 'EXW' | 'FCA' | 'FAS' | 'FOB' | 'CFR' | 'CIF' | 'CPT' | 'CIP' | 'DAP' | 'DPU' | 'DDP';
};
function guard() {
  requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
}
function positive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Fixture ${name} must be positive`);
}
export async function createActor(options: {
  type: 'exporter' | 'importer';
  permissions: readonly string[];
}): Promise<FixtureActor> {
  guard();
  const suffix = crypto.randomUUID();
  const organizationId = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id",
      [`Native fixture ${suffix}`, options.type],
    )
  ).rows[0].id as string;
  const email = `fixture-${suffix}@integration.test`;
  const password = `Fixture-${suffix}-Password123!`;
  const userId = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [organizationId, email, await bcrypt.hash(password, 4), 'Native fixture actor'],
    )
  ).rows[0].id as string;
  const roleId = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      `fixture-${suffix}`,
      [...options.permissions],
    ])
  ).rows[0].id as string;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [userId, roleId]);
  const login = await request(app).post('/auth/login').send({ email, password });
  if (login.status !== 200 || typeof login.body.accessToken !== 'string') {
    throw new Error(
      `Fixture sign-in requires HTTP 200 and a session token; received HTTP ${login.status}`,
    );
  }
  return { organizationId, userId, roleId, email, password, token: login.body.accessToken };
}
export async function createSupply(
  seller: FixtureActor,
  options: {
    quantityKg: number;
    crop?: string;
  },
): Promise<FixtureSupply> {
  guard();
  positive(options.quantityKg, 'supply quantity');
  const batchId = (
    await query(
      "INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES($1,CURRENT_DATE,$2,$3,'direct_inventory','Native fixture source','GH') RETURNING id",
      [options.crop ?? 'shea nuts', options.quantityKg, seller.organizationId],
    )
  ).rows[0].id as string;
  const holdingId = (
    await query(
      'INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,$3) RETURNING id',
      [batchId, seller.organizationId, options.quantityKg],
    )
  ).rows[0].id as string;
  return { batchId, holdingId, quantityKg: options.quantityKg };
}
export async function createListing(
  seller: FixtureActor,
  supply: FixtureSupply,
  options: CommercialTerms & {
    origin: string;
    destination: string;
    expiresAt?: Date;
  },
): Promise<string> {
  guard();
  positive(options.quantityKg, 'listing quantity');
  positive(options.pricePerKg, 'listing price');
  if (
    options.quantityKg > supply.quantityKg ||
    !options.origin.trim() ||
    !options.destination.trim()
  ) {
    throw new Error('Fixture listing requires available stock and explicit origin/destination');
  }
  return (
    await query(
      'INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [
        seller.organizationId,
        supply.holdingId,
        options.quantityKg,
        options.pricePerKg,
        options.currency,
        options.incoterm,
        options.origin,
        options.destination,
        options.expiresAt ?? new Date(Date.now() + 86400000),
      ],
    )
  ).rows[0].id as string;
}
export async function createOffer(
  buyer: FixtureActor,
  listingId: string,
  options: Pick<CommercialTerms, 'quantityKg' | 'pricePerKg' | 'currency'> & { validUntil?: Date },
): Promise<string> {
  guard();
  positive(options.quantityKg, 'offer quantity');
  positive(options.pricePerKg, 'offer price');
  return (
    await query(
      'INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [
        listingId,
        buyer.organizationId,
        options.quantityKg,
        options.pricePerKg,
        options.currency,
        options.validUntil ?? new Date(Date.now() + 86400000),
      ],
    )
  ).rows[0].id as string;
}
export async function createContract(
  seller: FixtureActor,
  buyer: FixtureActor,
  supply: FixtureSupply,
  listingId: string,
  offerId: string,
  options: CommercialTerms,
): Promise<string> {
  guard();
  positive(options.quantityKg, 'contract quantity');
  positive(options.pricePerKg, 'contract price');
  if (options.quantityKg > supply.quantityKg)
    throw new Error('Fixture contract exceeds physical stock');
  return (
    await query(
      'INSERT INTO sales_contracts(listing_id,offer_id,seller_organization_id,buyer_organization_id,holding_id,quantity_kg,price_per_kg,currency,incoterm) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [
        listingId,
        offerId,
        seller.organizationId,
        buyer.organizationId,
        supply.holdingId,
        options.quantityKg,
        options.pricePerKg,
        options.currency,
        options.incoterm,
      ],
    )
  ).rows[0].id as string;
}
export async function createShipment(
  contractId: string,
  options: {
    coordinatorOrganizationId?: string;
    milestone?:
      | 'planning'
      | 'booked'
      | 'cargo_ready'
      | 'loaded'
      | 'departed'
      | 'arrived'
      | 'customs_cleared'
      | 'unloaded'
      | 'delivered';
    exception?: { reason: string };
  } = {},
): Promise<string> {
  guard();
  if (options.exception && !options.exception.reason.trim())
    throw new Error('Fixture dispatch exception needs a reason');
  return (
    await query(
      'INSERT INTO shipments(contract_id,transport_coordinator_organization_id,current_milestone,dispatch_exception,dispatch_exception_reason,dispatch_exception_recorded_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [
        contractId,
        options.coordinatorOrganizationId ?? null,
        options.milestone ?? 'planning',
        Boolean(options.exception),
        options.exception?.reason ?? null,
        options.exception ? new Date() : null,
      ],
    )
  ).rows[0].id as string;
}
