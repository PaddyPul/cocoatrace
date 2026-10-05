import type { PoolClient } from 'pg';
export interface FeeIssue {
  code: string;
  fee_id: string | null;
  contract_id: string;
}
export async function reconcileFees(client: Pick<PoolClient, 'query'>) {
  const issues = (
    await client.query<FeeIssue>(`WITH facts AS (
    SELECT f.*,c.status contract_status,c.currency contract_currency,c.currency_minor_units contract_minor_units,c.quantity_kg,c.price_per_kg,c.seller_organization_id,c.buyer_organization_id FROM platform_fee_invoices f JOIN sales_contracts c ON c.id=f.contract_id
  ), issues AS (
    SELECT 'FEE_MISSING_FOR_CONTRACT' code,NULL::uuid fee_id,c.id contract_id FROM sales_contracts c WHERE NOT EXISTS(SELECT 1 FROM platform_fee_invoices f WHERE f.contract_id=c.id)
    UNION ALL SELECT 'FEE_AMOUNT_OR_CURRENCY_MISMATCH' code,id fee_id,contract_id FROM facts WHERE currency<>contract_currency OR currency_minor_units<>contract_minor_units OR amount_total<>round(quantity_kg*price_per_kg*rate_bps/10000::numeric,currency_minor_units)
    UNION ALL SELECT 'FEE_PAYER_MISMATCH',id,contract_id FROM facts WHERE payer_organization_id IS DISTINCT FROM CASE fee_payer WHEN 'seller' THEN seller_organization_id WHEN 'buyer' THEN buyer_organization_id ELSE NULL END OR payer_organization_id IS NULL
    UNION ALL SELECT 'FEE_COMPLETION_STATE_MISMATCH',id,contract_id FROM facts WHERE (contract_status='settled' AND status='estimated') OR (status IN('invoiced','paid','written_off') AND contract_status<>'settled') OR (contract_status='cancelled' AND status<>'void') OR (status='void' AND contract_status<>'cancelled')
    UNION ALL SELECT 'FEE_PAID_WITHOUT_VERIFIED_RECEIPT',id,contract_id FROM facts f WHERE status='paid' AND (paid_at IS NULL OR verified_by_user_id IS NULL OR platform_receipt_reference IS NULL OR (SELECT COUNT(*) FROM platform_fee_submissions s WHERE s.fee_id=f.id AND s.status='verified')<>1)
    UNION ALL SELECT 'FEE_VERIFIED_SUBMISSION_STATE_MISMATCH',f.id,f.contract_id FROM facts f WHERE f.status<>'paid' AND EXISTS(SELECT 1 FROM platform_fee_submissions s WHERE s.fee_id=f.id AND s.status='verified')
    UNION ALL SELECT 'FEE_WRITE_OFF_WITHOUT_AUDIT_FIELDS',id,contract_id FROM facts WHERE status='written_off' AND (written_off_at IS NULL OR verified_by_user_id IS NULL OR length(trim(write_off_reason))<10 OR write_off_reason IS NULL)
    UNION ALL SELECT 'FEE_UNKNOWN_STATUS',id,contract_id FROM facts WHERE status NOT IN('estimated','invoiced','paid','void','written_off')
  ) SELECT * FROM issues ORDER BY code,fee_id`)
  ).rows;
  const totals = (
    await client.query<{
      currency: string;
      currency_minor_units: number;
      status: string;
      count: number;
      amount_total: string;
    }>(
      `SELECT currency,currency_minor_units,status,COUNT(*)::int count,SUM(amount_total)::text amount_total FROM platform_fee_invoices GROUP BY currency,currency_minor_units,status ORDER BY currency,currency_minor_units,status`,
    )
  ).rows;
  const statements = (
    await client.query(
      `SELECT id,contract_id,payer_organization_id,fee_payer,rate_bps,amount_total::text,currency,currency_minor_units,status,policy_version,tax_status,due_at,invoiced_at,paid_at,platform_receipt_reference,verified_by_user_id,written_off_at,write_off_reason FROM platform_fee_invoices ORDER BY created_at,id`,
    )
  ).rows;
  return {
    ok: issues.length === 0,
    issues,
    totals,
    statements,
    limitations: [
      'Amounts use snapshotted currency precision: whole yen for new JPY trades; existing records retain their recorded two-decimal meaning.',
      'No exchange conversion or mixed-currency grand total.',
      'Receipt verification is a platform attestation, not bank API reconciliation.',
      'Tax treatment is not configured.',
    ],
  };
}
