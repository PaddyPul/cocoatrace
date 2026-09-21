import { Request, Response } from 'express';
import { calculateTraceBack, calculateTraceForward } from '../services/recallTrace';
import { loadTraceGraph } from '../services/traceGraphRepository';

export async function listLots(_req: Request, res: Response): Promise<void> {
  const graph = await loadTraceGraph();
  res.json(graph.lots);
}

export async function traceBack(req: Request, res: Response): Promise<void> {
  const graph = await loadTraceGraph();
  res.json(calculateTraceBack(graph, {
    lotId: req.params.id,
    quantityKg: req.query.quantityKg == null ? undefined : Number(req.query.quantityKg),
  }));
}

export async function traceForward(req: Request, res: Response): Promise<void> {
  const graph = await loadTraceGraph();
  res.json(calculateTraceForward(graph, [{
    lotId: req.params.id,
    quantityKg: req.query.quantityKg == null ? undefined : Number(req.query.quantityKg),
  }]));
}

export async function calculateRecallImpact(req: Request, res: Response): Promise<void> {
  const graph = await loadTraceGraph();
  res.json(calculateTraceForward(graph, req.body.lots));
}
