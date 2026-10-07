import { Request, Response } from 'express';
import { calculateTraceBack, calculateTraceForward } from '../services/recallTrace';
import { accessibleTraceLotIds, loadTraceGraph, withTraceRead } from '../services/traceGraphRepository';
import { activeBatchRecallSql } from '../modules/recall/safety';
import { ValidationError } from '../errors';
import { query } from '../db';
import { TRACE_LIMITS, checkTraceSize } from '../modules/trace/limits';
import { hasExplicitPermission } from '../services/resourcePolicy';
import { parseLotPage, readLotPage } from '../modules/trace/lotPage';

export async function listLotPage(req: Request, res: Response): Promise<void> {
  const seeAll = canSeeAll(req);
  const input = parseLotPage(req.query, req.user!.organizationId, seeAll);
  const page = await withTraceRead(execute => readLotPage(execute, req.user!.organizationId, seeAll, input));
  res.json(page);
}

function canSeeAll(req: Request): boolean {
  return hasExplicitPermission(req.user!, 'traceability.read.network', 'recall.manage.all');
}

async function requireLotAccess(req: Request, res: Response, lotIds: string[]): Promise<boolean> {
  if (lotIds.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) throw new ValidationError('Lot identifiers must be UUIDs');
  checkTraceSize(lotIds.length, TRACE_LIMITS.seeds, 'SEEDS_LIMIT');
  const accessible = await accessibleTraceLotIds(req.user!.organizationId, canSeeAll(req), query, lotIds);
  if (lotIds.some((id) => !accessible.has(id))) {
    res.status(403).json({ error: 'This lot is not connected to your organization’s inventory, custody or trade records' });
    return false;
  }
  return true;
}

export async function listLots(req: Request, res: Response): Promise<void> {
  const lots = await withTraceRead(async execute => {
  const accessible = await accessibleTraceLotIds(req.user!.organizationId, canSeeAll(req), execute);
  if (!accessible.size) return [];
  // List only permitted lot summaries, not the network's edges/distributions.
  const result = await execute(`SELECT ml.id,ml.lot_code,ml.lot_type,ml.product_name,ml.quantity_kg,
    ml.batch_id,CASE WHEN ${activeBatchRecallSql('ml.batch_id')} OR EXISTS (SELECT 1 FROM recall_safety_holds h JOIN recall_notices r ON r.id=h.recall_id WHERE h.entity_type='lot' AND h.entity_id=ml.id AND r.status='active') THEN 'held' ELSE ml.status END AS status,ml.produced_at,ml.owner_organization_id,o.name AS owner_name,
    b.source_mode,COALESCE(f.name,b.source_name,b.source_region,b.source_country) AS source_label,
    (SELECT COUNT(*)::int FROM lot_genealogy_edges e WHERE e.source_lot_id=ml.id) AS downstream_lot_count,
    (SELECT COUNT(*)::int FROM lot_distributions d WHERE d.lot_id=ml.id) AS distribution_count
    FROM material_lots ml JOIN organizations o ON o.id=ml.owner_organization_id
    LEFT JOIN harvest_batches b ON b.id=ml.batch_id LEFT JOIN farms f ON f.id=b.farm_id
    WHERE ml.id=ANY($1::uuid[]) ORDER BY ml.produced_at,ml.lot_code LIMIT $2`, [[...accessible], TRACE_LIMITS.lots + 1]);
  checkTraceSize(result.rows.length, TRACE_LIMITS.lots, 'LOTS_LIMIT');
  return result.rows.map(row => ({ id: row.id, lotCode: row.lot_code, lotType: row.lot_type,
    productName: row.product_name, quantityKg: Number(row.quantity_kg), batchId: row.batch_id,
    status: row.status, producedAt: row.produced_at, ownerOrganizationId: row.owner_organization_id,
    ownerName: row.owner_name, sourceMode: row.source_mode, sourceLabel: row.source_label,
    downstreamLotCount: row.downstream_lot_count, distributionCount: row.distribution_count }));
  });
  res.json(lots);
}

export async function traceBack(req: Request, res: Response): Promise<void> {
  if (!await requireLotAccess(req, res, [req.params.id])) return;
  const graph = await loadTraceGraph(undefined, [req.params.id]);
  res.json(calculateTraceBack(graph, {
    lotId: req.params.id,
    quantityKg: req.query.quantityKg == null ? undefined : Number(req.query.quantityKg),
  }));
}

export async function traceForward(req: Request, res: Response): Promise<void> {
  if (!await requireLotAccess(req, res, [req.params.id])) return;
  const graph = await loadTraceGraph(undefined, [req.params.id]);
  res.json(calculateTraceForward(graph, [{
    lotId: req.params.id,
    quantityKg: req.query.quantityKg == null ? undefined : Number(req.query.quantityKg),
  }]));
}

export async function calculateRecallImpact(req: Request, res: Response): Promise<void> {
  if (!await requireLotAccess(req, res, req.body.lots.map((lot: any) => lot.lotId))) return;
  const graph = await loadTraceGraph(undefined, req.body.lots.map((lot: { lotId: string }) => lot.lotId));
  res.json(calculateTraceForward(graph, req.body.lots));
}
