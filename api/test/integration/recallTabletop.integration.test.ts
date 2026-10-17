import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { requireDisposableTestDatabase } from '../../src/testing/databaseSafety';
import {
  createActor,
  createContract,
  createListing,
  createOffer,
  createSupply,
  type FixtureActor,
  type FixtureSupply,
} from './support/fixtures';

type ScenarioName = 'partial' | 'commingled' | 'distributed';
import { buildDrillReport, type DrillScenario } from '../../src/testing/recallDrill';
const tabletopObservations: DrillScenario[] = [];
const reportPath = path.resolve(__dirname, '../../../recall-drill-test-results/summary.json');
let startedAt = new Date();
beforeAll(() => {
  guard();
  startedAt = new Date();
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ status: 'failed', scope: 'synthetic-disposable-native', scenarios: [] }),
  );
});
const permissions = ['recall.manage', 'batch.read', 'holding.read', 'listing.read'];
const terms = { quantityKg: 2, pricePerKg: 5, currency: 'EUR' as const, incoterm: 'FOB' as const };
function guard() {
  requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
}
async function actor() {
  return createActor({ type: 'exporter', permissions });
}
async function stock(owner: FixtureActor, quantityKg: number) {
  const supply = await createSupply(owner, { quantityKg, crop: 'tabletop peanut' });
  const lotId = (
    await query(
      `INSERT INTO material_lots(lot_code,lot_type,batch_id,product_name,quantity_kg,owner_organization_id)
    VALUES($1,'source',$2,'tabletop peanut',$3,$4) RETURNING id`,
      [`DRILL-${crypto.randomUUID()}`, supply.batchId, quantityKg, owner.organizationId],
    )
  ).rows[0].id as string;
  return { ...supply, lotId };
}
async function listing(owner: FixtureActor, supply: FixtureSupply) {
  return createListing(owner, supply, {
    ...terms,
    quantityKg: Math.min(2, supply.quantityKg),
    origin: 'Tema tabletop warehouse',
    destination: 'Accra tabletop warehouse',
  });
}
async function snapshot(batchIds: string[], lotIds: string[]) {
  return {
    holdings: (
      await query(
        'SELECT id,batch_id,holder_organization_id,quantity_kg,status FROM batch_holdings WHERE batch_id=ANY($1::uuid[]) ORDER BY id',
        [batchIds],
      )
    ).rows,
    lots: (
      await query(
        'SELECT id,quantity_kg,owner_organization_id,status FROM material_lots WHERE id=ANY($1::uuid[]) ORDER BY id',
        [lotIds],
      )
    ).rows,
    distributions: (
      await query(
        'SELECT id,lot_id,recipient_organization_id,quantity_kg FROM lot_distributions WHERE lot_id=ANY($1::uuid[]) ORDER BY id',
        [lotIds],
      )
    ).rows,
  };
}
async function activateAndCheck(input: {
  name: ScenarioName;
  queuedRecipients?: string[];
  expectedUnresolvedContacts?: number;
  unaffectedLot?: string;
  fullOutputLot?: string;
  manager: FixtureActor;
  outsider: FixtureActor;
  seed: string;
  batches: string[];
  lots: string[];
  holdings: string[];
  listings: string[];
  recipients: string[];
  expectedGrams: number;
  retainedGrams: number;
  distributedGrams: number;
}) {
  const started = performance.now();
  const result: DrillScenario = {
    name: input.name,
    elapsedMs: 0,
    expectedRecipients: input.recipients.length,
    identifiedRecipients: 0,
    missingRecipients: input.recipients.length,
    unexpectedRecipients: 0,
    unresolvedRecipients: input.recipients.length,
    unresolvedContactRecipients: 0,
    graphComplete: false,
    expectedQuantityGrams: input.expectedGrams,
    accountedQuantityGrams: 0,
    retainedQuantityGrams: 0,
    status: 'failed',
  };
  tabletopObservations.push(result);
  try {
    const before = await snapshot(input.batches, input.lots);
    const response = await request(app)
      .post('/recalls')
      .set('Authorization', `Bearer ${input.manager.token}`)
      .send({
        referenceCode: `TABLETOP-${crypto.randomUUID()}`,
        title: 'Synthetic peanut recall tabletop',
        reason: 'Synthetic exercise only; test recipient identification and containment',
        instructions: 'Synthetic exercise: isolate recorded stock',
        severity: 'critical',
        lots: [{ lotId: input.seed }],
      });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    result.graphComplete = response.body.analysis?.status === 'complete';
    expect(result.graphComplete).toBe(true);
    const recallId = response.body.id as string;
    const participants = (
      await query(
        'SELECT organization_id,acknowledged_at,contact_status FROM recall_participants WHERE recall_id=$1 ORDER BY organization_id',
        [recallId],
      )
    ).rows;
    const actualIds = participants.map((row: { organization_id: string }) => row.organization_id);
    result.identifiedRecipients = actualIds.length;
    result.missingRecipients = input.recipients.filter((id) => !actualIds.includes(id)).length;
    result.unexpectedRecipients = actualIds.filter((id) => !input.recipients.includes(id)).length;
    result.unresolvedRecipients = participants.filter((row) => row.acknowledged_at === null).length;
    result.unresolvedContactRecipients = participants.filter((row) =>
      ['escalated', 'unreachable'].includes(row.contact_status),
    ).length;
    expect(result.unresolvedContactRecipients).toBe(input.expectedUnresolvedContacts ?? 0);
    expect(result.unresolvedRecipients).toBe(input.recipients.length - 1);
    expect(actualIds).toEqual([...input.recipients].sort());
    expect(actualIds).not.toContain(input.outsider.organizationId);
    const holds = (
      await query(
        'SELECT entity_type,entity_id,released_at FROM recall_safety_holds WHERE recall_id=$1',
        [recallId],
      )
    ).rows;
    expect(
      holds
        .filter((row) => row.entity_type === 'lot')
        .map((row) => row.entity_id)
        .sort(),
    ).toEqual([...input.lots].sort());
    expect(
      holds
        .filter((row) => row.entity_type === 'holding')
        .map((row) => row.entity_id)
        .sort(),
    ).toEqual([...input.holdings].sort());
    expect(holds.every((row) => row.released_at === null)).toBe(true);
    const withdrawn = (
      await query('SELECT id,active FROM listings WHERE id=ANY($1::uuid[])', [input.listings])
    ).rows;
    expect(withdrawn).toHaveLength(input.listings.length);
    expect(withdrawn.every((row) => row.active === false)).toBe(true);
    expect(await snapshot(input.batches, input.lots)).toEqual(before);
    // Source lots consumed into a blend are not counted twice. Current stock plus dispatched
    // distributions is the independently declared physical partition, in integer grams.
    const held = (
      await query(
        "SELECT quantity_kg FROM batch_holdings WHERE id=ANY($1::uuid[]) AND status<>'transferred'",
        [input.holdings],
      )
    ).rows;
    result.retainedQuantityGrams = held.reduce(
      (sum, row) => sum + Math.round(Number(row.quantity_kg) * 1000),
      0,
    );
    const distributions = (
      await query('SELECT quantity_kg FROM lot_distributions WHERE lot_id=ANY($1::uuid[])', [
        input.lots,
      ])
    ).rows;
    const distributedGrams = distributions.reduce(
      (sum, row) => sum + Math.round(Number(row.quantity_kg) * 1000),
      0,
    );
    expect(distributedGrams).toBe(input.distributedGrams);
    result.accountedQuantityGrams = result.retainedQuantityGrams + distributedGrams;
    expect(result.retainedQuantityGrams).toBe(input.retainedGrams);
    expect(result.accountedQuantityGrams).toBe(input.expectedGrams);
    const queued = (
      await query(
        'SELECT u.organization_id,q.status FROM recall_email_outbox q JOIN users u ON u.id=q.recipient_user_id WHERE q.recall_id=$1',
        [recallId],
      )
    ).rows;
    expect([...new Set(queued.map((row) => row.organization_id))].sort()).toEqual(
      [...(input.queuedRecipients ?? input.recipients)].sort(),
    );
    expect(queued.every((row) => row.status === 'queued')).toBe(true);
    // No worker is invoked: queue membership does not claim successful email delivery.
    expect(
      (
        await request(app)
          .get(`/recalls/${recallId}/response`)
          .set('Authorization', `Bearer ${input.outsider.token}`)
      ).status,
    ).toBe(404);
    if (input.unaffectedLot)
      expect(
        (await query('SELECT 1 FROM recall_safety_holds WHERE entity_id=$1', [input.unaffectedLot]))
          .rows,
      ).toEqual([]);
    if (input.fullOutputLot)
      expect(
        Number(
          (
            await query(
              'SELECT recall_quantity_kg FROM recall_affected_lots WHERE recall_id=$1 AND lot_id=$2',
              [recallId, input.fullOutputLot],
            )
          ).rows[0].recall_quantity_kg,
        ),
      ).toBe(10);
    result.status = 'passed';
    return recallId;
  } finally {
    result.elapsedMs = Math.round(performance.now() - started);
  }
}

describe('synthetic recall tabletop: recipient identification and physical containment', () => {
  it('partial custody identifies both holders without changing their 6kg/4kg partition', async () => {
    guard();
    const manager = await actor(),
      holder = await actor(),
      outsider = await actor();
    const source = await stock(manager, 10);
    await query('UPDATE batch_holdings SET quantity_kg=6 WHERE id=$1', [source.holdingId]);
    const secondHolding = (
      await query(
        'INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,4) RETURNING id',
        [source.batchId, holder.organizationId],
      )
    ).rows[0].id as string;
    const listingId = await listing(manager, source);
    await activateAndCheck({
      name: 'partial',
      manager,
      outsider,
      seed: source.lotId,
      batches: [source.batchId],
      lots: [source.lotId],
      holdings: [source.holdingId, secondHolding],
      listings: [listingId],
      recipients: [manager.organizationId, holder.organizationId],
      expectedGrams: 10000,
      retainedGrams: 10000,
      distributedGrams: 0,
    });
  }, 30_000);

  it('commingled genealogy holds the full 10kg output from a 4kg suspect input', async () => {
    guard();
    const manager = await actor(),
      processor = await actor(),
      outsider = await actor();
    const suspect = await stock(manager, 4),
      cleanInput = await stock(processor, 6),
      output = await stock(processor, 10);
    await query("UPDATE batch_holdings SET status='transferred' WHERE id=ANY($1::uuid[])", [
      [suspect.holdingId, cleanInput.holdingId],
    ]);
    await query("UPDATE material_lots SET status='consumed' WHERE id=ANY($1::uuid[])", [
      [suspect.lotId, cleanInput.lotId],
    ]);
    await query("UPDATE material_lots SET lot_type='production' WHERE id=$1", [output.lotId]);
    const event = (
      await query(
        "INSERT INTO transformation_events(event_code,event_type,facility_organization_id,occurred_at) VALUES($1,'blend',$2,NOW()) RETURNING id",
        [`DRILL-${crypto.randomUUID()}`, processor.organizationId],
      )
    ).rows[0].id as string;
    await query(
      'INSERT INTO lot_genealogy_edges(transformation_event_id,source_lot_id,destination_lot_id,allocated_input_kg) VALUES($1,$2,$4,4),($1,$3,$4,6)',
      [event, suspect.lotId, cleanInput.lotId, output.lotId],
    );
    const listingId = await listing(processor, output);
    await activateAndCheck({
      name: 'commingled',
      unaffectedLot: cleanInput.lotId,
      fullOutputLot: output.lotId,
      manager,
      outsider,
      seed: suspect.lotId,
      batches: [suspect.batchId, output.batchId],
      lots: [suspect.lotId, output.lotId],
      holdings: [suspect.holdingId, output.holdingId],
      listings: [listingId],
      recipients: [manager.organizationId, processor.organizationId],
      expectedGrams: 10000,
      retainedGrams: 10000,
      distributedGrams: 0,
    });
  }, 30_000);

  it('distributed material identifies owner, holder, contract buyer and recorded distribution recipient', async () => {
    guard();
    const manager = await actor(),
      holder = await actor(),
      buyer = await actor(),
      recipient = await actor(),
      outsider = await actor();
    const source = await stock(manager, 10);
    await query('UPDATE batch_holdings SET holder_organization_id=$1,quantity_kg=6 WHERE id=$2', [
      holder.organizationId,
      source.holdingId,
    ]);
    const listingId = await listing(holder, source);
    const offerId = await createOffer(buyer, listingId, terms);
    await query("UPDATE trade_offers SET status='accepted' WHERE id=$1", [offerId]);
    await createContract(holder, buyer, source, listingId, offerId, terms);
    await query(
      'INSERT INTO lot_distributions(lot_id,recipient_organization_id,quantity_kg,distribution_reference,dispatched_at) VALUES($1,$2,4,$3,NOW())',
      [source.lotId, recipient.organizationId, `DRILL-${crypto.randomUUID()}`],
    );
    // A registered recipient without an active contact must remain in the recall,
    // with explicit operator escalation rather than a false queued-delivery claim.
    await query('UPDATE users SET active=FALSE WHERE id=$1', [recipient.userId]);
    await activateAndCheck({
      name: 'distributed',
      queuedRecipients: [manager.organizationId, holder.organizationId, buyer.organizationId],
      expectedUnresolvedContacts: 1,
      manager,
      outsider,
      seed: source.lotId,
      batches: [source.batchId],
      lots: [source.lotId],
      holdings: [source.holdingId],
      listings: [listingId],
      recipients: [
        manager.organizationId,
        holder.organizationId,
        buyer.organizationId,
        recipient.organizationId,
      ],
      expectedGrams: 10000,
      retainedGrams: 6000,
      distributedGrams: 4000,
    });
  }, 30_000);
});
afterAll(async () => {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: path.resolve(__dirname, '../../..'),
      encoding: 'utf8',
    }).trim();
    const report = buildDrillReport(commit, startedAt, new Date(), tabletopObservations);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  } finally {
    await pool.end();
  }
});
