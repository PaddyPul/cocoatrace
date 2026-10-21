import type { Request, Response } from 'express';
import { readWorkspaceReadiness } from '../modules/catalog/readinessRead';
export async function getReadiness(req: Request, res: Response): Promise<void> {
  res.json(await readWorkspaceReadiness(req.user!));
}
