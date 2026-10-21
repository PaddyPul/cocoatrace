import * as workflow from '../modules/farmWorkflow/commands';
import { privateFarmDetail } from '../modules/catalog/privateResources';
import { legacySourceList } from '../modules/catalog/sourceRecords';
import { withCatalogRead } from '../modules/catalog/paging';
import { Request, Response } from 'express';

export async function listFarms(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead((execute) => legacySourceList(execute, req.user!, 'farms')));
}

export async function getFarm(req: Request, res: Response): Promise<void> {
  const detail = await withCatalogRead((execute) =>
    privateFarmDetail(execute, req.user!, req.params.id as string, req.query),
  );
  if (!detail) {
    res.status(404).json({ error: 'Farm not found' });
    return;
  }
  res.json(detail);
}

export async function createFarm(req: Request, res: Response): Promise<void> {
  const result = await workflow.createFarm(req.user!, req.body);
  res.status(201).json(result);
}

export async function createPlot(req: Request, res: Response): Promise<void> {
  const plot = await workflow.createPlot(req.user!, req.params.id as string, req.body);
  if (!plot) {
    res.status(404).json({ error: 'Farm not found' });
    return;
  }
  res.status(201).json(plot);
}
