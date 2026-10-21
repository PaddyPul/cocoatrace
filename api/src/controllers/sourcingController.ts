import * as workflow from '../modules/sourcing/requestWorkflow';
import { Request, Response } from 'express';
import { withCatalogRead } from '../modules/catalog/paging';
import { legacySourcing, sourcingPage, sourcingSummary } from '../modules/catalog/sourcingRecords';
import { structureSourcingBrief } from '../services/sourcingStructurer';

export async function structureRequest(req: Request, res: Response): Promise<void> {
  res.json(structureSourcingBrief(req.body.brief));
}

export async function listRequests(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead((execute) => legacySourcing(execute, req.user!)));
}
export async function listRequestPage(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead((execute) => sourcingPage(execute, req.user!, req.query)));
}
export async function summarizeRequests(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead((execute) => sourcingSummary(execute, req.user!)));
}

export async function createRequest(req: Request, res: Response): Promise<void> {
  const result = await workflow.createRequest(req.user!, req.body);
  res.status(201).json(result);
}

export async function updateRequest(req: Request, res: Response): Promise<void> {
  res.json(await workflow.updateRequest(req.user!, req.params.id as string, req.body));
}

export async function closeoutRequest(req: Request, res: Response): Promise<void> {
  res.json(await workflow.closeoutRequest(req.user!, req.params.id as string, req.body));
}

export async function getCloseout(req: Request, res: Response): Promise<void> {
  res.json(await workflow.getCloseout(req.user!.organizationId, req.params.id as string));
}
