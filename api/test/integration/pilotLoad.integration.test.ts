import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import {
  buildPilotLoadReport,
  assertPilotLoadReport,
  type LoadTargets,
} from '../../src/testing/pilotLoadReport';
import { pool, query } from '../../src/db';
import { requireDisposableTestDatabase } from '../../src/testing/databaseSafety';
import { createActor, createSupply, type FixtureActor } from './support/fixtures';

type Sample = { durationMs: number; status: number; expectedStatus: number };
type Workload = { name: string; concurrency: number; samples: Sample[]; invariantsPassed: boolean };
const workloads: Workload[] = [];
const reportPath = path.resolve(__dirname, '../../../pilot-load-test-results/summary.json');
const targets = (
  JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../../../docs/performance/capacity-policy.json'),
      'utf8',
    ),
  ) as { loadTargets: LoadTargets }
).loadTargets;
const concurrency = targets.concurrency;
let server: Server | undefined;
let origin: string;
let seller: FixtureActor, buyer: FixtureActor;
let batchId: string, holdingId: string, rootLot: string;
let listings: string[] = [];
let setupComplete = false;
const startedAt = new Date().toISOString();
const candidate = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

beforeAll(async () => {
  requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ status: 'failed', commit: candidate, reason: 'incomplete' }),
  );
  seller = await createActor({
    type: 'exporter',
    permissions: [
      'listing.read',
      'holding.read',
      'offer.respond',
      'batch.read',
      'provenance.export',
    ],
  });
  buyer = await createActor({ type: 'importer', permissions: ['listing.read', 'offer.create'] });
  const supply = await createSupply(seller, { quantityKg: 10000, crop: 'pilot-load-material' });
  batchId = supply.batchId;
  holdingId = supply.holdingId;
  listings = (
    await query(
      `INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location,expires_at)
    SELECT $1,$2,1,2,'EUR','FOB','Ghana','Ghana',NOW()+INTERVAL '7 days' FROM generate_series(1,1005) RETURNING id`,
      [seller.organizationId, holdingId],
    )
  ).rows.map((row: { id: string }) => row.id);
  await query(
    `INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id,claim_description,validation_status,malware_scan_status)
    SELECT $1,$2,'weighing_ticket','Synthetic load proof '||n||'.pdf',repeat('a',64),'batch',$3,'Synthetic metadata fixture; no actual scanned file','validated','clean' FROM generate_series(1,100) n`,
    [seller.userId, seller.organizationId, batchId],
  );
  const prefix = crypto.randomUUID();
  const lots = (
    await query(
      `INSERT INTO material_lots(lot_code,lot_type,product_name,quantity_kg,owner_organization_id,produced_at)
    SELECT $1||'-'||n,'production','Pilot load graph',CASE WHEN n=1 THEN 199 ELSE 1 END,$2,NOW() FROM generate_series(1,200) n RETURNING id,lot_code`,
      [prefix, seller.organizationId],
    )
  ).rows as { id: string; lot_code: string }[];
  lots.sort(
    (a, b) =>
      Number(a.lot_code.slice(prefix.length + 1)) - Number(b.lot_code.slice(prefix.length + 1)),
  );
  rootLot = lots[0].id;
  const event = (
    await query(
      "INSERT INTO transformation_events(event_code,event_type,facility_organization_id,occurred_at) VALUES($1,'process',$2,NOW()) RETURNING id",
      [prefix, seller.organizationId],
    )
  ).rows[0].id as string;
  await query(
    `INSERT INTO lot_genealogy_edges(transformation_event_id,source_lot_id,destination_lot_id,allocated_input_kg)
    SELECT $1,source,destination,1 FROM unnest($2::uuid[],$3::uuid[]) AS edges(source,destination)`,
    [event, lots.slice(1).map(() => rootLot), lots.slice(1).map((lot) => lot.id)],
  );
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server!.once('listening', resolve);
    server!.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Loopback HTTP listener unavailable');
  origin = `http://127.0.0.1:${address.port}`;
  setupComplete = true;
}, 60_000);

async function measured(
  workload: Workload,
  actor: FixtureActor,
  endpoint: string,
  expectedStatus: number,
  body?: object,
): Promise<Record<string, unknown>> {
  const started = performance.now();
  const response = await fetch(`${origin}${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${actor.token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  }).catch((error) => {
    workload.samples.push({ durationMs: performance.now() - started, status: 0, expectedStatus });
    throw error;
  });
  const data = (await response.json()) as Record<string, unknown>;
  workload.samples.push({
    durationMs: performance.now() - started,
    status: response.status,
    expectedStatus,
  });
  expect(
    response.status,
    `load request status; code=${typeof data.code === 'string' ? data.code : 'none'}`,
  ).toBe(expectedStatus);
  return data;
}
async function run(
  name: string,
  action: (workload: Workload, index: number) => Promise<void>,
  invariant: () => Promise<void>,
) {
  const workload: Workload = { name, concurrency, samples: [], invariantsPassed: false };
  workloads.push(workload);
  let index = 0;
  const workers = await Promise.allSettled(
    Array.from({ length: concurrency }, async () => {
      while (index < 100) {
        const next = index++;
        await action(workload, next);
      }
    }),
  );
  const failure = workers.find(
    (worker): worker is PromiseRejectedResult => worker.status === 'rejected',
  );
  if (failure) throw failure.reason;
  expect(workload.samples).toHaveLength(100);
  await invariant();
  workload.invariantsPassed = true;
}
const offerBody = { quantityKg: 1, offeredPricePerKg: 2, currency: 'EUR' };
async function invariantOffers(expected: number) {
  const counts = (
    await query(
      `SELECT (SELECT COUNT(*)::int FROM trade_offers WHERE buyer_organization_id=$1) AS offers,
    (SELECT COUNT(*)::int FROM audit_events WHERE actor_organization_id=$1 AND action='offer.create') AS audits,
    (SELECT COUNT(*)::int FROM sales_contracts WHERE buyer_organization_id=$1) AS contracts,
    (SELECT quantity_kg::text FROM batch_holdings WHERE id=$2) AS quantity`,
      [buyer.organizationId, holdingId],
    )
  ).rows[0];
  expect(counts).toMatchObject({
    offers: expected,
    audits: expected,
    contracts: 0,
    quantity: '10000.000',
  });
}

describe('bounded native pilot HTTP load and independent invariants', () => {
  it(
    'marketplace',
    async () =>
      run(
        'marketplace',
        async (workload) => {
          const page = await measured(workload, seller, '/listings/page?mine=true&limit=100', 200);
          expect(page.items).toHaveLength(100);
          expect(typeof page.nextCursor).toBe('string');
          expect(
            (page.items as { seller_organization_id: string }[]).every(
              (item) => item.seller_organization_id === seller.organizationId,
            ),
          ).toBe(true);
        },
        async () => {
          expect(
            (
              await query(
                'SELECT COUNT(*)::int AS count FROM listings WHERE seller_organization_id=$1',
                [seller.organizationId],
              )
            ).rows[0].count,
          ).toBe(1005);
        },
      ),
    120_000,
  );
  it(
    'trade-writes',
    async () =>
      run(
        'trade-writes',
        async (workload, index) => {
          const offer = await measured(
            workload,
            buyer,
            `/listings/${listings[index]}/offers`,
            201,
            offerBody,
          );
          expect(offer).toMatchObject({
            listing_id: listings[index],
            buyer_organization_id: buyer.organizationId,
            status: 'pending',
          });
        },
        async () => invariantOffers(100),
      ),
    120_000,
  );
  it(
    'trade-actions',
    async () =>
      run(
        'trade-actions',
        async (workload) => {
          const actions = (await measured(workload, seller, '/trade-actions', 200)) as unknown as {
            kind: string;
            requiresAction: boolean;
            offerId: string;
          }[];
          expect(actions).toHaveLength(100);
          expect(
            actions.every((action) => action.kind === 'offer_decision' && action.requiresAction),
          ).toBe(true);
          expect(new Set(actions.map((action) => action.offerId)).size).toBe(100);
        },
        async () => invariantOffers(100),
      ),
    120_000,
  );
  it(
    'provenance',
    async () =>
      run(
        'provenance',
        async (workload) => {
          const pack = await measured(workload, seller, `/provenance/batches/${batchId}`, 200);
          expect(pack.batchId).toBe(batchId);
          expect(pack.evidenceItems).toHaveLength(100);
          expect(pack.status).toBe('incomplete');
        },
        async () => {
          expect(
            (
              await query(
                "SELECT COUNT(*)::int AS count FROM audit_events WHERE actor_organization_id=$1 AND action='provenance.export'",
                [seller.organizationId],
              )
            ).rows[0].count,
          ).toBe(0);
        },
      ),
    120_000,
  );
  it(
    'trace',
    async () =>
      run(
        'trace',
        async (workload) => {
          const trace = await measured(
            workload,
            seller,
            `/traceability/lots/${rootLot}/trace-forward`,
            200,
          );
          expect(trace.impactedLots).toHaveLength(200);
          expect(trace).toMatchObject({
            totals: { impactedLotCount: 200, leafRecallQuantityKg: 199, recipientCount: 0 },
            exactness: 'declared',
          });
        },
        async () => {
          expect(
            (
              await query(
                'SELECT COUNT(*)::int AS count FROM material_lots WHERE owner_organization_id=$1',
                [seller.organizationId],
              )
            ).rows[0].count,
          ).toBe(200);
        },
      ),
    120_000,
  );
  it(
    'mixed',
    async () =>
      run(
        'mixed',
        async (workload, index) => {
          if (index % 2 === 0) {
            const offer = await measured(
              workload,
              buyer,
              `/listings/${listings[100 + index]}/offers`,
              201,
              offerBody,
            );
            expect(offer.status).toBe('pending');
          } else {
            const page = await measured(
              workload,
              seller,
              '/listings/page?mine=true&limit=100',
              200,
            );
            expect(page.items).toHaveLength(100);
          }
        },
        async () => invariantOffers(150),
      ),
    120_000,
  );
});

afterAll(async () => {
  try {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    const unchanged =
      execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === candidate;
    const report = buildPilotLoadReport(
      {
        commit: candidate,
        startedAt,
        completedAt: new Date().toISOString(),
        hardware: {
          platform: process.platform,
          architecture: process.arch,
          node: process.version,
          cpuCount: os.cpus().length,
          hostMemoryBytes: os.totalmem(),
        },
        volumes: {
          listings: 1005,
          traceLots: 200,
          traceEdges: 199,
          measuredOfferWrites: 150,
          provenanceEvidenceRows: 100,
        },
        workloads,
      },
      targets,
    );
    if (!setupComplete || !unchanged) report.status = 'failed';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    assertPilotLoadReport(report, candidate, targets);
  } finally {
    if (server)
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
    await pool.end();
  }
}, 30_000);
