import { Request, Response } from 'express';
import { query } from '../db';
import { inTradeTransaction, recordTradeAudit } from '../modules/trading/transaction';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { buildInstallments, requiredBeforeDispatch } from '../services/paymentProtection';
import { submitPayment, confirmReceipt, rejectReceipt } from '../modules/payments/installments';
import { presentDocuments, submitSecurity, confirmSecurity } from '../modules/payments/documentsAndSecurity';

export async function listPaymentRequests(req:Request,res:Response):Promise<void>{
  const {rows}=await query(`SELECT p.*,c.seller_organization_id,c.buyer_organization_id,c.payment_plan,c.payment_terms_status,c.deposit_percentage
    FROM payment_requests p JOIN sales_contracts c ON c.id=p.contract_id WHERE c.seller_organization_id=$1 OR c.buyer_organization_id=$1 ORDER BY p.created_at DESC`,[req.user!.organizationId]);res.json(rows);
}
export async function getPaymentRequest(req:Request,res:Response):Promise<void>{
  const {rows}=await query(`SELECT p.*,c.seller_organization_id,c.buyer_organization_id,c.quantity_kg,c.price_per_kg,c.incoterm,c.payment_plan,c.deposit_percentage,c.credit_days,c.payment_terms_status,c.payment_evidence_required,c.payment_terms_note,c.payment_terms_confirmed_at,
    s.name seller_name,b.name buyer_name,sh.current_milestone,fee.amount_total platform_fee_amount,fee.fee_payer,fee.status platform_fee_status
    FROM payment_requests p JOIN sales_contracts c ON c.id=p.contract_id JOIN organizations s ON s.id=c.seller_organization_id JOIN organizations b ON b.id=c.buyer_organization_id
    LEFT JOIN LATERAL(SELECT current_milestone FROM shipments WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1)sh ON TRUE LEFT JOIN platform_fee_invoices fee ON fee.contract_id=c.id WHERE p.id=$1`,[req.params.id]);
  if(!rows[0]){res.status(404).json({error:'Payment request not found'});return;} const p=rows[0];
  if(p.seller_organization_id!==req.user!.organizationId&&p.buyer_organization_id!==req.user!.organizationId){res.status(403).json({error:'Access denied'});return;}
  const installments=await query('SELECT i.*, e.file_name AS payment_evidence_file_name FROM payment_installments i LEFT JOIN evidence_items e ON e.id=i.payment_evidence_id WHERE i.payment_request_id=$1 ORDER BY i.sequence_number',[req.params.id]);res.json({...p,installments:installments.rows});
}
export async function createPaymentRequest(req: Request, res: Response): Promise<void> {
  const payment = await inTradeTransaction(async client => {
    const contract = (await client.query('SELECT * FROM sales_contracts WHERE id=$1 AND seller_organization_id=$2 FOR UPDATE',
      [req.params.id, req.user!.organizationId])).rows[0];
    if (!contract) throw new NotFoundError('Contract');
    if (['settled','cancelled'].includes(contract.status)) throw new ConflictError('Closed contracts cannot request a new payment');
    const existing = await client.query('SELECT id FROM payment_requests WHERE contract_id=$1', [contract.id]);
    if (existing.rows[0]) throw new ConflictError('A payment workflow already exists for this contract');
    const total = (await client.query('SELECT ROUND(quantity_kg*price_per_kg,2) AS total FROM sales_contracts WHERE id=$1', [contract.id])).rows[0].total;
    if (Number(total) !== req.body.amountTotal || contract.currency !== req.body.currency) {
      throw new ValidationError('The payment amount and currency must match the contract');
    }
    const created = (await client.query(`INSERT INTO payment_requests(contract_id,requested_by_organization_id,amount_total,currency,status,payment_method,dispatch_required_amount,security_status)
      VALUES($1,$2,$3,$4,'awaiting_terms',$5,$6,$7) RETURNING *`, [contract.id, req.user!.organizationId, total, contract.currency,contract.payment_plan,requiredBeforeDispatch(contract.payment_plan,Number(total),Number(contract.deposit_percentage)),contract.payment_plan==='bank_secured'?'awaiting_submission':'not_required'])).rows[0];
    for (const i of buildInstallments(contract.payment_plan, Number(total), Number(contract.deposit_percentage))) {
      await client.query(`INSERT INTO payment_installments(payment_request_id,installment_type,sequence_number,amount_due,due_trigger,status)
        VALUES($1,$2,$3,$4,$5,'awaiting_trigger')`, [created.id,i.installmentType,i.sequenceNumber,i.amountDue,i.dueTrigger]);
    }
    if (contract.payment_terms_status === 'agreed') {
      const status = contract.payment_plan === 'bank_secured' ? 'awaiting_security' : contract.payment_plan === 'pay_after_delivery' ? 'awaiting_delivery' : contract.payment_plan === 'documentary_collection' ? 'awaiting_documents' : 'payment_due';
      await client.query("UPDATE payment_installments SET status='due' WHERE payment_request_id=$1 AND due_trigger='terms_agreed'",[created.id]);
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
