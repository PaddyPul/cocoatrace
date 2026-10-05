import type { Request, Response } from 'express';
import { z } from 'zod';
import { getCancellation, requestCancellation, reviewCancellation } from '../modules/cancellation/workflow';
import { ValidationError } from '../errors';
function identifier(value: unknown): string {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) throw new ValidationError('A valid trade/request identifier is required');
  return parsed.data;
}
export async function get(req: Request, res: Response): Promise<void> {
  res.json(await getCancellation(req.user!, identifier(req.params.id)));
}
export async function request(req: Request, res: Response): Promise<void> {
  res.json(await requestCancellation(req.user!, identifier(req.params.id), req.body.reason));
}
export async function approve(req: Request, res: Response): Promise<void> {
  res.json(await reviewCancellation(req.user!, identifier(req.params.id), identifier(req.params.requestId), true));
}
export async function reject(req: Request, res: Response): Promise<void> {
  res.json(await reviewCancellation(req.user!, identifier(req.params.id), identifier(req.params.requestId), false));
}
