import {legacyPayments} from '../modules/catalog/payments';
import {withCatalogRead} from '../modules/catalog/paging';
import { activatePaymentInstallments } from '../modules/payments/dueDates';
import { Request, Response } from 'express';
import { privatePaymentDetail } from '../modules/catalog/privatePayments';
import { inTradeTransaction, recordTradeAudit } from '../modules/trading/transaction';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { buildInstallments, requiredBeforeDispatch } from '../services/paymentProtection';
import { submitPayment, confirmReceipt, rejectReceipt } from '../modules/payments/installments';
import { presentDocuments, submitSecurity, confirmSecurity } from '../modules/payments/documentsAndSecurity';

export async function listPaymentRequests(req:Request,res:Response):Promise<void>{
  res.json(await withCatalogRead(execute => legacyPayments(execute,req.user!.organizationId)));
}
export async function getPaymentRequest(req:Request,res:Response):Promise<void>{
  const payment = await withCatalogRead(execute => privatePaymentDetail(execute, req.user!.organizationId, req.params.id));
  if (!payment) { res.status(404).json({error:'Payment request not found'}); return; }
  res.json(payment);
}
export async function createPaymentRequest(req: Request, res: Response): Promise<void> {
  const payment = await inTradeTransaction(async client => {
    const contract = (await client.query('SELECT * FROM sales_contracts WHERE id=$1 AND seller_organization_id=$2 FOR UPDATE',
      [req.params.id, req.user!.organizationId])).rows[0];
    if (!contract) throw new NotFoundError('Contract');
    if (['settled','cancelled'].includes(contract.status)) throw new ConflictError('Closed contracts cannot request a new payment');
    const existing = await client.query('SELECT id FROM payment_requests WHERE contract_id=$1', [contract.id]);
    if (existing.rows[0]) throw new ConflictError('A payment workflow already exists for this contract');
    const total = (await client.query('SELECT ROUND(quantity_kg*price_per_kg,currency_minor_units) AS total FROM sales_contracts WHERE id=$1', [contract.id])).rows[0].total;
    if (Number(total) !== req.body.amountTotal || contract.currency !== req.body.currency) {
      throw new ValidationError('The payment amount and currency must match the contract');
    }
    const created = (await client.query(`INSERT INTO payment_requests(contract_id,requested_by_organization_id,amount_total,currency,status,payment_method,dispatch_required_amount,security_status,currency_minor_units)
      VALUES($1,$2,$3,$4,'awaiting_terms',$5,$6,$7,$8) RETURNING *`, [contract.id, req.user!.organizationId, total, contract.currency,contract.payment_plan,requiredBeforeDispatch(contract.payment_plan,total,Number(contract.deposit_percentage),contract.currency_minor_units),contract.payment_plan==='bank_secured'?'awaiting_submission':'not_required',contract.currency_minor_units])).rows[0];
    for (const i of buildInstallments(contract.payment_plan, total, Number(contract.deposit_percentage),contract.currency_minor_units)) {
      await client.query(`INSERT INTO payment_installments(payment_request_id,installment_type,sequence_number,amount_due,due_trigger,status,currency_minor_units)
        VALUES($1,$2,$3,$4,$5,'awaiting_trigger',$6)`, [created.id,i.installmentType,i.sequenceNumber,i.amountDue,i.dueTrigger,contract.currency_minor_units]);
    }
    if (contract.payment_terms_status === 'agreed') {
      const status = contract.payment_plan === 'bank_secured' ? 'awaiting_security' : contract.payment_plan === 'pay_after_delivery' ? 'awaiting_delivery' : contract.payment_plan === 'documentary_collection' ? 'awaiting_documents' : 'payment_due';
      await activatePaymentInstallments(client,created.id,'terms_agreed',{triggeredAt:contract.payment_terms_confirmed_at});
      await client.query("UPDATE payment_requests SET status=$1,release_status=CASE WHEN $2='pay_after_delivery' THEN 'authorized' ELSE release_status END WHERE id=$3",[status,contract.payment_plan,created.id]);
    }
    await recordTradeAudit(client, req.user!, 'payment.request', 'payment_request', created.id);
    return created;
  });
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
