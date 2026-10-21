import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool, query } from '../../src/db';
import { requireDisposableTestDatabase } from '../../src/testing/databaseSafety';
import { createOrganization } from '../../src/modules/organizationWorkflow/commands';
import { createRequest } from '../../src/modules/sourcing/requestWorkflow';
import { updateOnboarding } from '../../src/modules/workspaceWorkflow/commands';
import {
  registerHarvestBatch,
  registerDirectInventory,
} from '../../src/modules/batchWorkflow/useCases';
import {
  updateBuyerEudrReference,
  updateBuyerComplianceReference,
} from '../../src/modules/agreements/complianceReferences';
import { upsertProfile, publishProfile } from '../../src/modules/publicProducts/administration';
import { createOrganizationSchema, createSourcingRequestSchema } from '../../src/validation';
import {
  createActor,
  createSupply,
  createListing,
  createOffer,
  createContract,
  type FixtureActor,
} from './support/fixtures';

// The fault belongs to this disposable database, and only the nominated actor/action fails.
// No session settings, process environment changes, or mocked pool are involved.
let installed = false;
beforeAll(async () => {
  requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  await query(
    `CREATE TABLE integration_business_audit_faults (actor_user_id uuid NOT NULL, action text NOT NULL, PRIMARY KEY(actor_user_id,action))`,
  );
  installed = true;
  await query(`CREATE FUNCTION integration_reject_business_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM integration_business_audit_faults f WHERE f.actor_user_id=NEW.actor_user_id AND f.action=NEW.action) THEN
        RAISE EXCEPTION 'integration business audit insert rejected';
      END IF;
      RETURN NEW;
    END $$`);
  await query(
    `CREATE TRIGGER integration_business_audit_failure BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION integration_reject_business_audit()`,
  );
});
afterAll(async () => {
  try {
    if (!installed) return;
    requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
    await query('DROP TRIGGER IF EXISTS integration_business_audit_failure ON audit_events');
    await query('DROP FUNCTION IF EXISTS integration_reject_business_audit()');
    await query('DROP TABLE IF EXISTS integration_business_audit_faults');
  } finally {
    await pool.end();
  }
});

const identity = (a: FixtureActor) => ({
  id: a.userId,
  organizationId: a.organizationId,
  permissions: [] as string[],
});
const actor = () => createActor({ type: 'exporter', permissions: [] });
async function auditCount(a: FixtureActor, action: string) {
  return Number(
    (
      await query('SELECT count(*) FROM audit_events WHERE actor_user_id=$1 AND action=$2', [
        a.userId,
        action,
      ])
    ).rows[0].count,
  );
}
async function rejectThenCommit<T>(
  a: FixtureActor,
  action: string,
  mutate: () => Promise<T>,
  unchanged: () => Promise<void>,
): Promise<T> {
  const before = await auditCount(a, action);
  await query('INSERT INTO integration_business_audit_faults VALUES($1,$2)', [a.userId, action]);
  try {
    await expect(mutate()).rejects.toThrow('integration business audit insert rejected');
    await unchanged();
    expect(await auditCount(a, action)).toBe(before);
  } finally {
    await query(
      'DELETE FROM integration_business_audit_faults WHERE actor_user_id=$1 AND action=$2',
      [a.userId, action],
    );
  }
  const result = await mutate();
  expect(await auditCount(a, action)).toBe(before + 1);
  return result;
}
async function count(sql: string, values: unknown[]) {
  return Number((await query(sql, values)).rows[0].count);
}
async function contractFixture() {
  const seller = await actor();
  const buyer = await createActor({ type: 'importer', permissions: [] });
  const supply = await createSupply(seller, { quantityKg: 10, crop: 'cocoa' });
  const terms = {
    quantityKg: 4,
    pricePerKg: 5,
    currency: 'USD' as const,
    incoterm: 'FOB' as const,
  };
  const listing = await createListing(seller, supply, {
    ...terms,
    origin: 'Accra',
    destination: 'Amsterdam',
  });
  const offer = await createOffer(buyer, listing, terms);
  const id = await createContract(seller, buyer, supply, listing, offer, terms);
  return {
    buyer,
    id,
    authenticated: {
      ...identity(buyer),
      sessionId: crypto.randomUUID(),
      email: buyer.email,
      name: 'Buyer',
      roles: [],
      permissions: [],
      orgName: 'Buyer',
      orgType: 'importer',
    },
  };
}
describe('business changes and critical audits share a native PostgreSQL transaction', () => {
  it('rolls back organization creation and then commits one organization and audit', async () => {
    const a = await actor();
    const name = `Atomic organization ${crypto.randomUUID()}`;
    const result = await rejectThenCommit(
      a,
      'organization.create',
      () =>
        createOrganization(
          identity(a),
          createOrganizationSchema.parse({ name, type: 'exporter', jurisdiction: 'GH' }),
        ),
      async () => {
        expect(await count('SELECT count(*) FROM organizations WHERE name=$1', [name])).toBe(0);
      },
    );
    expect(
      (await query('SELECT name FROM organizations WHERE id=$1', [result.id])).rows[0].name,
    ).toBe(name);
  });
  it('rolls back sourcing creation and preserves the requested fields on success', async () => {
    const a = await actor();
    const title = `Atomic sourcing ${crypto.randomUUID()}`;
    const input = createSourcingRequestSchema.parse({
      title,
      commodity: 'cocoa',
      quantityKg: 12,
      deliveryLocation: 'Amsterdam',
      status: 'open',
    });
    const result = await rejectThenCommit(
      a,
      'sourcing_request.create',
      () => createRequest(identity(a), input),
      async () => {
        expect(
          await count('SELECT count(*) FROM sourcing_requests WHERE buyer_organization_id=$1', [
            a.organizationId,
          ]),
        ).toBe(0);
      },
    );
    expect(result).toMatchObject({ title, status: 'open', delivery_location: 'Amsterdam' });
  });
  it('restores existing onboarding progress when completion audit fails', async () => {
    const a = await actor();
    await updateOnboarding(identity(a), {
      status: 'in_progress',
      currentStep: 1,
      primaryGoal: 'Sell cocoa',
      pilotMode: false,
    });
    const result = await rejectThenCommit(
      a,
      'onboarding.complete',
      () =>
        updateOnboarding(identity(a), {
          status: 'completed',
          currentStep: 4,
          primaryGoal: 'Buy cocoa',
          pilotMode: true,
        }),
      async () => {
        expect(
          (
            await query(
              'SELECT status,current_step,primary_goal,pilot_mode,completed_at FROM user_onboarding WHERE user_id=$1',
              [a.userId],
            )
          ).rows[0],
        ).toEqual({
          status: 'in_progress',
          current_step: 1,
          primary_goal: 'Sell cocoa',
          pilot_mode: false,
          completed_at: null,
        });
      },
    );
    expect(result.status).toBe('completed');
    expect(result.completed_at).not.toBeNull();
  });
  it.each(['harvest', 'direct'] as const)(
    'rolls back %s batch, material lot and holding together',
    async (kind) => {
      const a = await actor();
      const farm =
        kind === 'harvest'
          ? ((
              await query(
                "INSERT INTO farms(farmer_organization_id,name,country,region,district) VALUES($1,$2,'GH','Ashanti','Kumasi') RETURNING id",
                [a.organizationId, `Atomic farm ${crypto.randomUUID()}`],
              )
            ).rows[0].id as string)
          : '';
      const mutate = () =>
        kind === 'harvest'
          ? registerHarvestBatch(identity(a), {
              farmId: farm,
              plotIds: [],
              crop: 'cocoa',
              harvestDate: '2026-01-01',
              quantityKg: 7,
            })
          : registerDirectInventory(identity(a), {
              commodity: 'cocoa',
              quantityKg: 7,
              inventoryDate: '2026-01-01',
              sourceName: 'Native source',
              sourceCountry: 'GH',
              sourceRegion: 'Ashanti',
              warehouseLocation: 'Kumasi',
            });
      const result = await rejectThenCommit(
        a,
        kind === 'harvest' ? 'batch.create' : 'inventory.create_direct',
        mutate,
        async () => {
          expect(
            await count('SELECT count(*) FROM harvest_batches WHERE current_holder_id=$1', [
              a.organizationId,
            ]),
          ).toBe(0);
          expect(
            await count('SELECT count(*) FROM material_lots WHERE owner_organization_id=$1', [
              a.organizationId,
            ]),
          ).toBe(0);
          expect(
            await count('SELECT count(*) FROM batch_holdings WHERE holder_organization_id=$1', [
              a.organizationId,
            ]),
          ).toBe(0);
        },
      );
      expect(await count('SELECT count(*) FROM material_lots WHERE batch_id=$1', [result.id])).toBe(
        1,
      );
      expect(
        await count(
          'SELECT count(*) FROM batch_holdings WHERE id=$1 AND batch_id=$2 AND quantity_kg=7',
          [result.holding_id, result.id],
        ),
      ).toBe(1);
    },
  );
  it.each(['eudr', 'compliance'] as const)(
    'restores contract %s references when its audit fails',
    async (kind) => {
      const { buyer, id, authenticated } = await contractFixture();
      await query(
        "UPDATE sales_contracts SET eudr_due_diligence_reference='OLD-EUDR',compliance_scheme='OLD',compliance_reference='OLD-REF' WHERE id=$1",
        [id],
      );
      const reference = `NEW-${crypto.randomUUID()}`;
      const result = await rejectThenCommit(
        buyer,
        `contract.${kind}.update`,
        () =>
          kind === 'eudr'
            ? updateBuyerEudrReference(authenticated, id, reference)
            : updateBuyerComplianceReference(authenticated, id, 'EUDR', reference),
        async () => {
          expect(
            (
              await query(
                'SELECT eudr_due_diligence_reference,compliance_scheme,compliance_reference FROM sales_contracts WHERE id=$1',
                [id],
              )
            ).rows[0],
          ).toEqual({
            eudr_due_diligence_reference: 'OLD-EUDR',
            compliance_scheme: 'OLD',
            compliance_reference: 'OLD-REF',
          });
        },
      );
      expect(result?.eudr_due_diligence_reference).toBe(reference);
      if (kind === 'compliance') expect(result?.compliance_reference).toBe(reference);
    },
  );
  it('restores an existing public product profile on failed upsert audit', async () => {
    const a = await actor();
    const supply = await createSupply(a, { quantityKg: 5, crop: 'cocoa' });
    const payload = {
      batchId: supply.batchId,
      slug: `atomic-${crypto.randomUUID()}`,
      displayName: 'Original cocoa',
      lotCode: `LOT-${crypto.randomUUID()}`,
    };
    const original = await upsertProfile(identity(a), payload);
    const result = await rejectThenCommit(
      a,
      'product_profile.upsert',
      () =>
        upsertProfile(identity(a), {
          ...payload,
          displayName: 'Updated cocoa',
          description: 'Updated description',
        }),
      async () => {
        expect(
          (
            await query('SELECT display_name,description FROM product_profiles WHERE id=$1', [
              original.id,
            ])
          ).rows[0],
        ).toEqual({ display_name: 'Original cocoa', description: '' });
      },
    );
    expect(result.display_name).toBe('Updated cocoa');
  });
  it('keeps a product profile unpublished when publication audit fails', async () => {
    const a = await actor();
    const supply = await createSupply(a, { quantityKg: 5, crop: 'cocoa' });
    const profile = await upsertProfile(identity(a), {
      batchId: supply.batchId,
      slug: `atomic-${crypto.randomUUID()}`,
      displayName: 'Cocoa',
      lotCode: `LOT-${crypto.randomUUID()}`,
    });
    const result = await rejectThenCommit(
      a,
      'product_profile.publish',
      () => publishProfile(identity(a), profile.id),
      async () => {
        expect(
          (
            await query('SELECT visibility,published_at FROM product_profiles WHERE id=$1', [
              profile.id,
            ])
          ).rows[0],
        ).toEqual({ visibility: profile.visibility, published_at: null });
      },
    );
    expect(result.visibility).toBe('published');
    expect(result.published_at).not.toBeNull();
  });
});
