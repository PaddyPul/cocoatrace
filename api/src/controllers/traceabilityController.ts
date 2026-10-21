import type { z } from 'zod';
import { recallImpactSchema } from '../validation';
import { Request, Response } from 'express';
import {
  TraceAccessError,
  listTraceLotPage,
  listTraceLots,
  readTraceBack,
  readTraceForward,
} from '../modules/trace/readWorkflow';

function respondTraceError(error: unknown, res: Response): void {
  if (!(error instanceof TraceAccessError)) throw error;
  res.status(403).json({ error: error.message });
}
export async function listLotPage(req: Request, res: Response): Promise<void> {
  res.json(await listTraceLotPage(req.user!, req.query));
}
export async function listLots(req: Request, res: Response): Promise<void> {
  res.json(await listTraceLots(req.user!));
}
export async function traceBack(req: Request, res: Response): Promise<void> {
  try {
    res.json(
      await readTraceBack(req.user!, {
        lotId: req.params.id,
        quantityKg: req.query.quantityKg == null ? undefined : Number(req.query.quantityKg),
      }),
    );
  } catch (error) {
    respondTraceError(error, res);
  }
}
export async function traceForward(req: Request, res: Response): Promise<void> {
  try {
    res.json(
      await readTraceForward(req.user!, [
        {
          lotId: req.params.id,
          quantityKg: req.query.quantityKg == null ? undefined : Number(req.query.quantityKg),
        },
      ]),
    );
  } catch (error) {
    respondTraceError(error, res);
  }
}
export async function calculateRecallImpact(
  req: Request<Record<string, string>, unknown, z.infer<typeof recallImpactSchema>>,
  res: Response,
): Promise<void> {
  try {
    res.json(await readTraceForward(req.user!, req.body.lots));
  } catch (error) {
    respondTraceError(error, res);
  }
}
