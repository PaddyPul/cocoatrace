import { Request, Response } from 'express';
import { legacyRecalls } from '../../modules/catalog/recallRecords';
import { withCatalogRead } from '../../modules/catalog/paging';
import { activateRecall } from '../../modules/recall/lifecycle';

export async function listRecalls(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead((execute) => legacyRecalls(execute, req.user!, req.query)));
}

export async function createRecall(req: Request, res: Response): Promise<void> {
  const canManageAll = (req.user!.permissions || []).some(
    (permission) => permission === '*' || permission === 'recall.manage.all',
  );
  res.status(201).json(await activateRecall(req.user!, canManageAll, req.body));
}
