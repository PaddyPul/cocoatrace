import type { Request, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '../errors';
import {
  statement,
  submitFee,
  reviewFee,
  writeOffFee,
  listFees,
  type FeeReview,
} from '../modules/fees/ledger';
import { getClient } from '../db';
import { reconcileFees } from '../modules/fees/reconciliation';
function id(value: unknown) {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) throw new ValidationError('A valid identifier is required');
  return result.data;
}
export async function get(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store').json(await statement(req.user!, id(req.params.id)));
}
export async function submit(req: Request, res: Response) {
  res.json(await submitFee(req.user!, id(req.params.id), req.body.reference));
}
export async function review(req: Request, res: Response) {
  res.json(
    await reviewFee(
      req.user!,
      id(req.params.id),
      id(req.params.submissionId),
      req.body as FeeReview,
    ),
  );
}
export async function writeOff(req: Request, res: Response) {
  res.json(await writeOffFee(req.user!, id(req.params.id), req.body.reason));
}
export async function list(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store').json(await listFees(req.user!));
}
export async function download(req: Request, res: Response) {
  const result = await statement(req.user!, id(req.params.id));
  res
    .set('Cache-Control', 'no-store')
    .attachment(`${result.statementNumber}.json`)
    .type('application/json')
    .send(JSON.stringify(result, null, 2));
}
export async function reconcile(_req: Request, res: Response) {
  const client = await getClient();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result = await reconcileFees(client);
    await client.query('COMMIT');
    res.set('Cache-Control', 'no-store').json(result);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
