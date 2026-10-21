import * as workflow from '../modules/workspaceWorkflow/commands';
import { Request, Response } from 'express';
import { withCatalogRead } from '../modules/catalog/paging';
import { feedbackPage, feedbackSummary, legacyFeedback } from '../modules/catalog/feedbackRecords';
import { loadTradeActions } from '../services/tradeActionRepository';

export async function getOnboarding(req: Request, res: Response): Promise<void> {
  res.json(await workflow.getOnboarding(req.user!.id));
}

export async function updateOnboarding(req: Request, res: Response): Promise<void> {
  res.json(await workflow.updateOnboarding(req.user!, req.body));
}

export async function createFeedback(req: Request, res: Response): Promise<void> {
  const result = await workflow.createFeedback(req.user!, req.body);
  res.status(201).json(result);
}

export async function listFeedback(req: Request, res: Response): Promise<void> {
  res
    .set('Cache-Control', 'no-store')
    .json(await withCatalogRead((execute) => legacyFeedback(execute, req.user!, req.query)));
}
export async function listFeedbackPage(req: Request, res: Response): Promise<void> {
  res
    .set('Cache-Control', 'no-store')
    .json(await withCatalogRead((execute) => feedbackPage(execute, req.user!, req.query)));
}
export async function summarizeFeedback(req: Request, res: Response): Promise<void> {
  res
    .set('Cache-Control', 'no-store')
    .json(await withCatalogRead((execute) => feedbackSummary(execute, req.user!, req.query)));
}

export async function getTradeActions(req: Request, res: Response): Promise<void> {
  res.json(await loadTradeActions(req.user!));
}
