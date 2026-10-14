import { AppError } from '../../errors';
import type { Execute } from './paging';

// Party scope is applied before any commercial fields or linked documents are read.
export async function privatePaymentDetail(execute: Execute, organizationId: string, id: string) {
  const payment = (
    await execute(
      `SELECT p.*,c.seller_organization_id,c.buyer_organization_id,c.quantity_kg,c.price_per_kg,c.incoterm,c.payment_plan,c.deposit_percentage,c.credit_days,c.payment_terms_status,c.payment_evidence_required,c.payment_terms_note,c.payment_terms_confirmed_at,c.status AS contract_status,
    s.name seller_name,b.name buyer_name,sh.current_milestone,fee.amount_total platform_fee_amount,fee.fee_payer,fee.status platform_fee_status
    FROM payment_requests p JOIN sales_contracts c ON c.id=p.contract_id JOIN organizations s ON s.id=c.seller_organization_id JOIN organizations b ON b.id=c.buyer_organization_id
    LEFT JOIN LATERAL(SELECT current_milestone FROM shipments WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1)sh ON TRUE LEFT JOIN platform_fee_invoices fee ON fee.contract_id=c.id
    WHERE p.id=$1 AND $2 IN(c.seller_organization_id,c.buyer_organization_id)`,
      [id, organizationId],
    )
  ).rows[0];
  if (!payment) return null;
  const installments = (
    await execute(
      `SELECT i.*, e.file_name AS payment_evidence_file_name
    FROM payment_installments i LEFT JOIN evidence_items e ON e.id=i.payment_evidence_id
    WHERE i.payment_request_id=$1 ORDER BY i.sequence_number,i.id LIMIT 1001`,
      [id],
    )
  ).rows;
  if (installments.length > 1000)
    throw new AppError(
      'Payment installments exceed the complete read limit. Contact the platform operator.',
      422,
      'CATALOG_READ_LIMIT',
    );
  return { ...payment, installments };
}
