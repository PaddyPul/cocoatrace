import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';

type Tenant = {
  email: string;
  password: string;
  organizationId: string;
  token: string;
  farmId: string;
};

const tenantA: Tenant = {
  email: 'tenant-a@integration.test', password: 'TenantAPassword123!',
  organizationId: '', token: '', farmId: '',
};

const tenantB: Tenant = {
  email: 'tenant-b@integration.test', password: 'TenantBPassword123!',
  organizationId: '', token: '', farmId: '',
};

async function createTenant(tenant: Tenant, name: string): Promise<void> {
  const organization = await query(
    `INSERT INTO organizations (name, type, jurisdiction, verification_status)
     VALUES ($1, 'farmer', 'GH', 'pending') RETURNING id`,
    [name],
  );
  tenant.organizationId = organization.rows[0].id;

  const passwordHash = await bcrypt.hash(tenant.password, 4);
  const user = await query(
    `INSERT INTO users (organization_id, email, password_hash, name)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [tenant.organizationId, tenant.email, passwordHash, `${name} User`],
  );
  const role = await query(
    `INSERT INTO roles (name, permissions)
     VALUES ($1, ARRAY['farm.read', 'farm.create'])
     ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions
     RETURNING id`,
    [`integration-farmer-${tenant.email}`],
  );
  await query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [user.rows[0].id, role.rows[0].id]);

  const login = await request(app).post('/auth/login').send({ email: tenant.email, password: tenant.password });
  expect(login.status).toBe(200);
  tenant.token = login.body.accessToken;
}

async function createFarm(tenant: Tenant, name: string): Promise<string> {
  const response = await request(app)
    .post('/farms')
    .set('Authorization', `Bearer ${tenant.token}`)
    .send({ name, country: 'GH', region: 'Northern', district: 'Tamale' });

  expect(response.status).toBe(201);
  return response.body.id;
}

beforeAll(async () => {
  await createTenant(tenantA, 'Independent Tenant A');
  await createTenant(tenantB, 'Independent Tenant B');
  tenantA.farmId = await createFarm(tenantA, 'Tenant A Farm');
  tenantB.farmId = await createFarm(tenantB, 'Tenant B Farm');
});

afterAll(async () => {
  await pool.end();
});

describe('real PostgreSQL multi-tenant API boundary', () => {
  it.each([
    [tenantA, 'Tenant A Farm', 'Tenant B Farm'],
    [tenantB, 'Tenant B Farm', 'Tenant A Farm'],
  ])('only lists farms owned by the authenticated organization', async (tenant, ownFarm, otherFarm) => {
    const response = await request(app).get('/farms').set('Authorization', `Bearer ${tenant.token}`);
    expect(response.status).toBe(200);
    expect(response.body.map((farm: { name: string }) => farm.name)).toContain(ownFarm);
    expect(response.body.map((farm: { name: string }) => farm.name)).not.toContain(otherFarm);
  });

  it.each([[tenantA, tenantB], [tenantB, tenantA]])(
    'denies direct access to another organization\'s farm',
    async (actor, otherTenant) => {
      const response = await request(app)
        .get(`/farms/${otherTenant.farmId}`)
        .set('Authorization', `Bearer ${actor.token}`);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Access denied' });
    },
  );

  it('persists organization attribution and audit records in PostgreSQL', async () => {
    const farms = await query(
      'SELECT name, farmer_organization_id FROM farms WHERE id = ANY($1::uuid[]) ORDER BY name',
      [[tenantA.farmId, tenantB.farmId]],
    );
    expect(farms.rows).toEqual([
      { name: 'Tenant A Farm', farmer_organization_id: tenantA.organizationId },
      { name: 'Tenant B Farm', farmer_organization_id: tenantB.organizationId },
    ]);

    const audits = await query(
      `SELECT actor_organization_id, entity_id FROM audit_events
       WHERE action = 'farm.create' AND entity_id = ANY($1::uuid[])`,
      [[tenantA.farmId, tenantB.farmId]],
    );
    expect(audits.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ actor_organization_id: tenantA.organizationId, entity_id: tenantA.farmId }),
      expect.objectContaining({ actor_organization_id: tenantB.organizationId, entity_id: tenantB.farmId }),
    ]));
  });
});
