import { privateHoldingDetail } from '../modules/catalog/privateResources';
import { legacyHoldingList } from '../modules/catalog/repository';
import { legacyTransferList } from '../modules/catalog/transfers';
import { withCatalogRead } from '../modules/catalog/paging';
import { Request, Response } from 'express';
import * as workflow from '../modules/holdingsWorkflow/service';

export async function getHolding(req: Request, res: Response): Promise<void> {
  const detail = await withCatalogRead((execute) =>
    privateHoldingDetail(execute, req.user!, req.params.id as string),
  );
  if (!detail) {
    res.status(404).json({ error: 'Holding not found' });
    return;
  }
  res.json(detail);
}

export async function listHoldings(req: Request, res: Response): Promise<void> {
  const result = await withCatalogRead((execute) =>
    legacyHoldingList(execute, req.user!.organizationId),
  );
  res.json(result);
}

export async function listTransfers(req: Request, res: Response): Promise<void> {
  res.json(
    await withCatalogRead((execute) => legacyTransferList(execute, req.user!.organizationId)),
  );
}

export async function createHolding(req: Request, res: Response): Promise<void> {
  try {
    const result = await workflow.createHolding(req.user!, req.body);
    res.status(201).json(result);
  } catch (error) {
    if (!(error instanceof workflow.HoldingWorkflowError)) throw error;
    res.status(error.statusCode).json(error.response);
  }
}

export async function transferHolding(req: Request, res: Response): Promise<void> {
  try {
    const result = await workflow.transferHolding(req.user!, req.params.id as string, req.body);
    res.status(201).json(result);
  } catch (error) {
    if (!(error instanceof workflow.HoldingWorkflowError)) throw error;
    res.status(error.statusCode).json(error.response);
  }
}

export async function acceptTransfer(req: Request, res: Response): Promise<void> {
  try {
    const result = await workflow.acceptTransfer(req.user!, req.params.id as string);
    res.status(200).json(result);
  } catch (error) {
    if (!(error instanceof workflow.HoldingWorkflowError)) throw error;
    res.status(error.statusCode).json(error.response);
  }
}

export async function splitHolding(req: Request, res: Response): Promise<void> {
  try {
    const result = await workflow.splitHolding(req.user!, req.params.id as string, req.body);
    res.status(200).json(result);
  } catch (error) {
    if (!(error instanceof workflow.HoldingWorkflowError)) throw error;
    res.status(error.statusCode).json(error.response);
  }
}
