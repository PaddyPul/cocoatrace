import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { withCatalogRead } from '../../src/modules/catalog/paging';
import { privateHoldingDetail } from '../../src/modules/catalog/privateResources';
import { createSession } from '../../src/services/authSessionService';

type Actor = {
  id: string;
  org: string;
  token: string;
  farm: string;
  batch: string;
  certificate: string;
  holding: string;
  plot: string;
};
type Resource = 'farm' | 'plotPage' | 'plotSummary' | 'batch' | 'certificate' | 'holding';
const resources: Resource[] = [
  'farm',
  'plotPage',
  'plotSummary',
  'batch',
  'certificate',
  'holding',
];
const ordinary = ['farm.read', 'batch.read', 'certificate.read', 'holding.read'];
let a: Actor, b: Actor, network: Actor, empty: Actor;
async function account(permissions: string[]): Promise<Actor> {
  const tag = crypto.randomUUID(),
    org = (
      await query(
        "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
        ['Private boundary ' + tag],
      )
    ).rows[0].id;
  const id = (
    await query(
      "INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,'Resource boundary fixture') RETURNING id",
      [org, tag + '@integration.test', await bcrypt.hash('SourceBoundary123!', 4)],
    )
  ).rows[0].id;
  if (permissions.length) {
    const role = (
      await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
        'resource-' + tag,
        permissions,
      ])
    ).rows[0].id;
    await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [id, role]);
  }
  const session = await createSession(id);
  return {
    id,
    org,
    token: session.token,
    farm: '',
    batch: '',
    certificate: '',
    holding: '',
    plot: '',
  };
}
async function supply(who: Actor) {
  who.farm = (
    await query(
      "INSERT INTO farms(farmer_organization_id,name,country,region,district) VALUES($1,$2,'GH','Private region','Private district') RETURNING id",
      [who.org, 'Private source ' + who.org],
    )
  ).rows[0].id;
  who.plot = (
    await query(
      "INSERT INTO farm_plots(farm_id,plot_code,area_hectares,crops,gps_lat,gps_lng,geolocation_source) VALUES($1,'Private plot',1,ARRAY['peanut'],9.4123,-0.8123,'supplier_declared') RETURNING id",
      [who.farm],
    )
  ).rows[0].id;
  who.certificate = (
    await query(
      "INSERT INTO organic_certificates(certifier_organization_id,farmer_organization_id,farm_id,standard,crop_scope,valid_from,valid_to,issuing_authority,accreditation_reference) VALUES($1,$1,$2,'EU_ORGANIC',ARRAY['peanut'],'2026-01-01','2028-01-01','Private issuer',$3) RETURNING id",
      [who.org, who.farm, 'PRIVATE-' + who.org],
    )
  ).rows[0].id;
  who.batch = (
    await query(
      "INSERT INTO harvest_batches(farm_id,crop,harvest_date,quantity_kg,current_holder_id,organic_claim_status) VALUES($1,'peanut',CURRENT_DATE,10,$2,'self_declared') RETURNING id",
      [who.farm, who.org],
    )
  ).rows[0].id;
  who.holding = (
    await query(
      'INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,10) RETURNING id',
      [who.batch, who.org],
    )
  ).rows[0].id;
}
function resourceId(resource: Resource, who: Actor) {
  return resource === 'plotPage' || resource === 'plotSummary' ? who.farm : who[resource];
}
function url(resource: Resource, id: string) {
  return resource === 'plotPage'
    ? `/farms/${id}/plots/page`
    : resource === 'plotSummary'
      ? `/farms/${id}/plots/summary`
      : `/${{ farm: 'farms', batch: 'batches', certificate: 'certificates', holding: 'holdings' }[resource]}/${id}`;
}
async function read(endpoint: string, who: Actor) {
  return request(app).get(endpoint).set('Authorization', `Bearer ${who.token}`);
}
beforeAll(async () => {
  a = await account(ordinary);
  b = await account(ordinary);
  network = await account([...ordinary, 'farm.read.all', 'batch.read.all', 'certificate.read.all']);
  empty = await account([]);
  await supply(a);
  await supply(b);
});
afterAll(async () => {
  for (const who of [a, b, network, empty])
    if (who)
      await query(
        "UPDATE sessions SET revoked_at=NOW(),revoked_reason='resource boundary fixture complete' WHERE user_id=$1 AND revoked_at IS NULL",
        [who.id],
      );
  await pool.end();
});
describe.each(['a', 'b'] as const)('%s paired private source boundaries', (key) => {
  it.each(resources)(
    '%s allows the owner and returns identical foreign/absent denials',
    async (resource) => {
      const own = key === 'a' ? a : b,
        foreign = key === 'a' ? b : a;
      const positive = await read(url(resource, resourceId(resource, own)), own);
      expect(positive.status, JSON.stringify(positive.body)).toBe(200);
      expect(positive.headers['cache-control']).toBe('no-store');
      if (resource === 'plotSummary') expect(positive.body.count).toBe(1);
      else
        expect(JSON.stringify(positive.body)).toContain(
          resource === 'plotPage' ? own.plot : resourceId(resource, own),
        );
      const denied = await read(url(resource, resourceId(resource, foreign)), own),
        absent = await read(url(resource, crypto.randomUUID()), own);
      expect(denied.status, JSON.stringify(denied.body)).toBe(404);
      expect(absent.status).toBe(404);
      expect(denied.body).toEqual(absent.body);
      expect(denied.headers['cache-control']).toBe('no-store');
      expect(JSON.stringify(denied.body)).not.toMatch(/Private|9\.4123|0\.8123|PRIVATE-/);
    },
  );
  it.each(['farms', 'batches', 'certificates', 'holdings'])(
    '%s collections, exact foreign search and totals retain ordinary organization scope',
    async (collection) => {
      const own = key === 'a' ? a : b,
        foreign = key === 'a' ? b : a;
      const field = {
        farms: 'farm',
        batches: 'batch',
        certificates: 'certificate',
        holdings: 'holding',
      }[collection] as 'farm' | 'batch' | 'certificate' | 'holding';
      const page = await read(`/${collection}/page`, own);
      expect(page.status, JSON.stringify(page.body)).toBe(200);
      expect(page.body.items.map((row: { id: string }) => row.id)).toEqual([own[field]]);
      const hidden = await read(`/${collection}/page?search=${foreign[field]}`, own);
      expect(hidden.status).toBe(200);
      expect(hidden.body.items).toEqual([]);
      const total = await read(`/${collection}/summary`, own);
      expect(total.status, JSON.stringify(total.body)).toBe(200);
      expect(total.body.count).toBe(1);
      expect(total.headers['cache-control']).toBe('no-store');
    },
  );
});
describe('source authorization remains live and explicit', () => {
  it('ordinary role unions and unrelated offer/shipment permissions never create network scope', async () => {
    const role = (
      await query(
        "INSERT INTO roles(name,permissions) VALUES($1,ARRAY['offer.create','shipment.update','farm.read','batch.read','certificate.read','holding.read']) RETURNING id",
        ['union-' + crypto.randomUUID()],
      )
    ).rows[0].id;
    await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [a.id, role]);
    try {
      for (const resource of resources)
        expect((await read(url(resource, resourceId(resource, b)), a)).status).toBe(404);
    } finally {
      await query('DELETE FROM user_roles WHERE user_id=$1 AND role_id=$2', [a.id, role]);
    }
  });
  it('explicit per-domain network reads work without granting a network holding bypass', async () => {
    for (const resource of [
      'farm',
      'batch',
      'certificate',
      'plotPage',
      'plotSummary',
    ] as Resource[]) {
      const response = await read(url(resource, resourceId(resource, a)), network);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
    }
    expect((await read(url('holding', a.holding), network)).status).toBe(404);
  });
  it.each(resources)(
    '%s rejects malformed identifiers while preserving credential/permission order',
    async (resource) => {
      const endpoint = url(resource, 'not-a-uuid');
      expect((await request(app).get(endpoint)).status).toBe(401);
      expect((await read(endpoint, empty)).status).toBe(403);
      const malformed = await read(endpoint, a);
      expect(malformed.status, JSON.stringify(malformed.body)).toBe(400);
      expect(malformed.headers['cache-control']).toBe('no-store');
    },
  );
  it('role removal changes the next request without replacing the signed session', async () => {
    const roles = (
      await query(
        'SELECT r.id,r.permissions FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=$1',
        [a.id],
      )
    ).rows;
    await query(
      "UPDATE roles SET permissions=array_remove(permissions,'farm.read') WHERE id IN(SELECT role_id FROM user_roles WHERE user_id=$1)",
      [a.id],
    );
    try {
      expect((await read(url('farm', a.farm), a)).status).toBe(403);
    } finally {
      for (const role of roles)
        await query('UPDATE roles SET permissions=$2 WHERE id=$1', [role.id, role.permissions]);
    }
    expect((await read(url('farm', a.farm), a)).status).toBe(200);
  });
  it.each(['user', 'organization'] as const)(
    '%s suspension blocks the next previously authorized read',
    async (scope) => {
      const table = scope === 'user' ? 'users' : 'organizations',
        id = scope === 'user' ? a.id : a.org;
      await query(`UPDATE ${table} SET access_suspended_at=NOW() WHERE id=$1`, [id]);
      try {
        expect((await read(url('farm', a.farm), a)).status).toBe(401);
      } finally {
        await query(`UPDATE ${table} SET access_suspended_at=NULL WHERE id=$1`, [id]);
      }
      expect((await read(url('farm', a.farm), a)).status).toBe(200);
    },
  );
  it('session revocation blocks the revoked credential without reviving it through a new session', async () => {
    const isolated = await createSession(a.id);
    await query(
      "UPDATE sessions SET revoked_at=NOW(),revoked_reason='resource boundary regression' WHERE id=$1",
      [isolated.actor.sessionId],
    );
    expect(
      (await request(app).get(url('farm', a.farm)).set('Authorization', `Bearer ${isolated.token}`))
        .status,
    ).toBe(401);
    expect((await read(url('farm', a.farm), a)).status).toBe(200);
  });
  it('keeps one authorized holding snapshot consistent while later requests see a changed holder', async () => {
    let changed = false;
    const assign = (organization: string) =>
      query(
        `WITH moved AS (
      UPDATE batch_holdings SET holder_organization_id=$2 WHERE id=$1 RETURNING batch_id)
      UPDATE harvest_batches SET current_holder_id=$2 WHERE id IN(SELECT batch_id FROM moved)`,
        [a.holding, organization],
      );
    try {
      const view = await withCatalogRead((execute) =>
        privateHoldingDetail(
          async (sql, params) => {
            const result = await execute(sql, params);
            if (!changed && sql.includes('FROM batch_holdings h')) {
              await assign(b.org);
              changed = true;
            }
            return result;
          },
          { organizationId: a.org, permissions: ordinary },
          a.holding,
        ),
      );
      expect(changed).toBe(true);
      expect(view?.holding.holder_organization_id).toBe(a.org);
      expect(view?.batch?.current_holder_id).toBe(a.org);
      expect((await read(url('holding', a.holding), a)).status).toBe(404);
      expect((await read(url('holding', a.holding), b)).status).toBe(200);
    } finally {
      if (changed) await assign(a.org);
    }
  });
  it('read and denied-read matrix creates no business mutation audit events', async () => {
    expect(
      (
        await query(
          'SELECT COUNT(*)::int AS count FROM audit_events WHERE actor_user_id=ANY($1::uuid[])',
          [[a.id, b.id, network.id, empty.id]],
        )
      ).rows[0].count,
    ).toBe(0);
  });
});
