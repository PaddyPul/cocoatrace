import { privateBatchDetail } from '../modules/catalog/privateResources';
import { legacySourceList } from '../modules/catalog/sourceRecords';
import { withCatalogRead } from '../modules/catalog/paging';
import { Request, Response } from 'express';
import { attestBatchRecord } from '../modules/trust/certification';
import {
  BatchWorkflowError,
  publishBatchInventory,
  registerHarvestBatch,
  registerDirectInventory,
} from '../modules/batchWorkflow/useCases';

function respondWorkflowError(error: unknown, res: Response): void {
  if (!(error instanceof BatchWorkflowError)) throw error;
  res
    .status(error.status)
    .json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
}

export async function pushToMarketplace(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json(await publishBatchInventory(req.user!, req.params.id as string, req.body));
  } catch (error) {
    respondWorkflowError(error, res);
  }
}

export async function createBatch(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json(await registerHarvestBatch(req.user!, req.body));
  } catch (error) {
    respondWorkflowError(error, res);
  }
}

export async function createDirectInventory(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json(await registerDirectInventory(req.user!, req.body));
  } catch (error) {
    respondWorkflowError(error, res);
  }
}

export async function listBatches(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead((execute) => legacySourceList(execute, req.user!, 'batches')));
}

export async function getBatch(req: Request, res: Response): Promise<void> {
  const detail = await withCatalogRead((execute) =>
    privateBatchDetail(execute, req.user!, req.params.id as string, req.query),
  );
  if (!detail) {
    res.status(404).json({ error: 'Batch not found' });
    return;
  }
  res.json(detail);
}

export async function attestBatch(req: Request, res: Response): Promise<void> {
  res.status(201).json(await attestBatchRecord(req.user!, req.params.id as string, req.body));
}
