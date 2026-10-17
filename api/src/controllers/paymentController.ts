import { createPaymentRequest as createRequest } from '../modules/payments/requests';
import { legacyPayments } from '../modules/catalog/payments';
import { withCatalogRead } from '../modules/catalog/paging';
import { Request, Response } from 'express';
import { privatePaymentDetail } from '../modules/catalog/privatePayments';
import { submitPayment, confirmReceipt, rejectReceipt } from '../modules/payments/installments';
import {
  presentDocuments,
  submitSecurity,
  confirmSecurity,
} from '../modules/payments/documentsAndSecurity';

export async function listPaymentRequests(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead((execute) => legacyPayments(execute, req.user!.organizationId)));
}
export async function getPaymentRequest(req: Request, res: Response): Promise<void> {
  const payment = await withCatalogRead((execute) =>
    privatePaymentDetail(execute, req.user!.organizationId, req.params.id),
  );
  if (!payment) {
    res.status(404).json({ error: 'Payment request not found' });
    return;
  }
  res.json(payment);
}
export async function createPaymentRequest(req: Request, res: Response): Promise<void> {
  const payment = await createRequest(req.user!, req.params.id, req.body);
  res.status(201).json(payment);
}
export async function payPaymentRequest(req: Request, res: Response): Promise<void> {
  res.json(await submitPayment(req.user!, req.params.id, req.body, true));
}
export async function submitPaymentDocuments(req: Request, res: Response): Promise<void> {
  res.json(await presentDocuments(req.user!, req.params.id));
}
export async function submitInstallmentPayment(req: Request, res: Response): Promise<void> {
  res.json(await submitPayment(req.user!, req.params.id, req.body));
}
export async function confirmInstallmentPayment(req: Request, res: Response): Promise<void> {
  res.json(await confirmReceipt(req.user!, req.params.id));
}
export async function rejectInstallmentPayment(req: Request, res: Response): Promise<void> {
  res.json(await rejectReceipt(req.user!, req.params.id, req.body.reason));
}
export async function submitPaymentSecurity(req: Request, res: Response): Promise<void> {
  res.json(await submitSecurity(req.user!, req.params.id, req.body));
}
export async function confirmPaymentSecurity(req: Request, res: Response): Promise<void> {
  res.json(await confirmSecurity(req.user!, req.params.id));
}
