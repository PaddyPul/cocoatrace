import { ValidationError } from '../../errors';
import { hasExplicitPermission, type Actor } from '../../services/resourcePolicy';
import {
  accessibleTraceLotIds,
  loadTraceGraph,
  withTraceRead,
} from '../../services/traceGraphRepository';
import {
  calculateTraceBack,
  calculateTraceForward,
  type TraceLot,
} from '../../services/recallTrace';
import { accessibleSeedIds, readLotSummaries } from './readRepository';
import { TRACE_LIMITS, checkTraceSize } from './limits';
import { parseLotPage, readLotPage } from './lotPage';

export class TraceAccessError extends Error {
  constructor() {
    super('This lot is not connected to your organization’s inventory, custody or trade records');
  }
}
export interface TraceSeed {
  lotId: string;
  quantityKg?: number;
}
function canSeeAll(actor: Actor): boolean {
  return hasExplicitPermission(actor, 'traceability.read.network', 'recall.manage.all');
}
async function requireLotAccess(actor: Actor, lotIds: string[]): Promise<void> {
  if (
    lotIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
  ) {
    throw new ValidationError('Lot identifiers must be UUIDs');
  }
  checkTraceSize(lotIds.length, TRACE_LIMITS.seeds, 'SEEDS_LIMIT');
  const accessible = await accessibleSeedIds(actor.organizationId, canSeeAll(actor), lotIds);
  if (lotIds.some((id) => !accessible.has(id))) throw new TraceAccessError();
}
export async function listTraceLotPage(
  actor: Actor,
  query: Record<string, unknown>,
): Promise<Awaited<ReturnType<typeof readLotPage>>> {
  const seeAll = canSeeAll(actor);
  const input = parseLotPage(query, actor.organizationId, seeAll);
  return withTraceRead((execute) => readLotPage(execute, actor.organizationId, seeAll, input));
}
export async function listTraceLots(actor: Actor): Promise<TraceLot[]> {
  return withTraceRead(async (execute) => {
    const accessible = await accessibleTraceLotIds(actor.organizationId, canSeeAll(actor), execute);
    if (!accessible.size) return [];
    const rows = await readLotSummaries(execute, [...accessible]);
    checkTraceSize(rows.length, TRACE_LIMITS.lots, 'LOTS_LIMIT');
    return rows.map((row) => ({
      id: row.id,
      lotCode: row.lot_code,
      lotType: row.lot_type,
      productName: row.product_name,
      quantityKg: Number(row.quantity_kg),
      batchId: row.batch_id,
      status: row.status,
      producedAt: row.produced_at,
      ownerOrganizationId: row.owner_organization_id,
      ownerName: row.owner_name,
      sourceMode: row.source_mode,
      sourceLabel: row.source_label,
      downstreamLotCount: row.downstream_lot_count,
      distributionCount: row.distribution_count,
    }));
  });
}
export async function readTraceBack(
  actor: Actor,
  seed: TraceSeed,
): Promise<ReturnType<typeof calculateTraceBack>> {
  await requireLotAccess(actor, [seed.lotId]);
  const graph = await loadTraceGraph(undefined, [seed.lotId]);
  return calculateTraceBack(graph, seed);
}
export async function readTraceForward(
  actor: Actor,
  seeds: TraceSeed[],
): Promise<ReturnType<typeof calculateTraceForward>> {
  const ids = seeds.map((seed) => seed.lotId);
  await requireLotAccess(actor, ids);
  const graph = await loadTraceGraph(undefined, ids);
  return calculateTraceForward(graph, seeds);
}
