import { Request, Response } from 'express';
import { getPaymentOperations, remindPayment } from '../modules/payments/operations';
import { openPaymentIssue, proposeIssueResolution, approveIssueResolution } from '../modules/payments/issues';

const actor = (req: Request) => req.user!;
const bad = (res: Response, message: string) => { res.status(400).json({ error: message, code: 'VALIDATION_ERROR' }); };

export async function operations(req: Request, res: Response): Promise<void> {
  res.json(await getPaymentOperations(actor(req), req.params.id));
}
export async function remind(req: Request, res: Response): Promise<void> {
  res.json(await remindPayment(actor(req), req.params.id));
}
export async function openIssue(req: Request, res: Response): Promise<void> {
  const { issueType, installmentId, reason, proposedReference } = req.body || {};
  if (!['payment_dispute', 'reference_correction', 'receipt_reversal'].includes(issueType)) return bad(res, 'Invalid issue type');
  if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 2000) return bad(res, 'A valid issue explanation is required');
  if (installmentId !== undefined && typeof installmentId !== 'string') return bad(res, 'Invalid installment');
  if (proposedReference !== undefined && typeof proposedReference !== 'string') return bad(res, 'Invalid payment reference');
  res.status(201).json(await openPaymentIssue(actor(req), req.params.id, { issueType, installmentId, reason, proposedReference }));
}
export async function propose(req: Request, res: Response): Promise<void> {
  const note = req.body?.note;
  if (typeof note !== 'string' || note.trim().length < 5 || note.length > 2000) return bad(res, 'A resolution explanation is required');
  res.json(await proposeIssueResolution(actor(req), req.params.id, note));
}
export async function approve(req: Request, res: Response): Promise<void> {
  res.json(await approveIssueResolution(actor(req), req.params.id));
}
