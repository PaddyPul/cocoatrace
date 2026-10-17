import type { Request, Response } from 'express';
import type { ArrangementInput, MilestoneInput } from '../modules/transportWorkflow/model';
import * as workflow from '../modules/transportWorkflow/service';

export async function listShipments(req: Request, res: Response): Promise<void> {
  const result = await workflow.listShipments(req.user!);
  res.status(result.status).json(result.body);
}
export async function getShipment(req: Request, res: Response): Promise<void> {
  const result = await workflow.getShipment(req.user!, req.params.id as string);
  res.status(result.status).json(result.body);
}
export async function updateShipmentDetails(
  req: Request<{ id: string }, unknown, ArrangementInput>,
  res: Response,
): Promise<void> {
  const result = await workflow.updateArrangement(req.user!, req.params.id as string, req.body);
  res.status(result.status).json(result.body);
}
export async function recordMilestone(
  req: Request<{ id: string }, unknown, MilestoneInput>,
  res: Response,
): Promise<void> {
  const result = await workflow.recordMilestone(req.user!, req.params.id as string, req.body);
  res.status(result.status).json(result.body);
}
