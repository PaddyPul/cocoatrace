import { Request, Response } from 'express';
import { calculateTraceBack, calculateTraceForward } from '../services/recallTrace';
import { accessibleTraceLotIds, loadTraceGraph } from '../services/traceGraphRepository';

function canSeeAll(req: Request): boolean {
  const permissions = req.user!.permissions || [];
  return permissions.includes('*') || permissions.includes('recall.manage.all') || permissions.includes('audit.read');
}

async function requireLotAccess(req: Request, res: Response, lotIds: string[]): Promise<boolean> {
  const accessible = await accessibleTraceLotIds(req.user!.organizationId, canSeeAll(req));
  if (lotIds.some((id) => !accessible.has(id))) {
    res.status(403).json({ error: 'This lot is not connected to your organization’s inventory, custody or trade records' });
    return false;
  }
  return true;
}

export async function listLots(req: Request, res: Response): Promise<void> {
  const graph = await loadTraceGraph();
  const accessible = await accessibleTraceLotIds(req.user!.organizationId, canSeeAll(req));
  res.json(graph.lots.filter((lot) => accessible.has(lot.id)));
}

export async function traceBack(req: Request, res: Response): Promise<void> {
  if (!await requireLotAccess(req, res, [req.params.id])) return;
  const graph = await loadTraceGraph();
  res.json(calculateTraceBack(graph, {
    lotId: req.params.id,
    quantityKg: req.query.quantityKg == null ? undefined : Number(req.query.quantityKg),
  }));
}

export async function traceForward(req: Request, res: Response): Promise<void> {
  if (!await requireLotAccess(req, res, [req.params.id])) return;
  const graph = await loadTraceGraph();
  res.json(calculateTraceForward(graph, [{
    lotId: req.params.id,
    quantityKg: req.query.quantityKg == null ? undefined : Number(req.query.quantityKg),
  }]));
}

export async function calculateRecallImpact(req: Request, res: Response): Promise<void> {
  if (!await requireLotAccess(req, res, req.body.lots.map((lot: any) => lot.lotId))) return;
  const graph = await loadTraceGraph();
  res.json(calculateTraceForward(graph, req.body.lots));
}
