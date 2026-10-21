import { query } from '../../db';
export type ComplianceContract = { id: string } & Record<string, unknown>;
export async function saveEudrReference(
  id: string,
  buyerOrganizationId: string,
  reference: string,
) {
  return (
    await query<ComplianceContract>(
      'UPDATE sales_contracts SET eudr_due_diligence_reference=$1 WHERE id=$2 AND buyer_organization_id=$3 RETURNING *',
      [reference, id, buyerOrganizationId],
    )
  ).rows[0];
}
export async function saveComplianceReference(
  id: string,
  buyerOrganizationId: string,
  scheme: string,
  reference: string,
) {
  const isEudr = String(scheme).trim().toUpperCase() === 'EUDR';
  return (
    await query<ComplianceContract>(
      `UPDATE sales_contracts SET compliance_scheme=$1, compliance_reference=$2,
    eudr_due_diligence_reference=CASE WHEN $3 THEN $2 ELSE eudr_due_diligence_reference END
    WHERE id=$4 AND buyer_organization_id=$5 RETURNING *`,
      [scheme.trim(), reference.trim(), isEudr, id, buyerOrganizationId],
    )
  ).rows[0];
}
