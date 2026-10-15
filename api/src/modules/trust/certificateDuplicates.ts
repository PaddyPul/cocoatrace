import type { PoolClient } from 'pg';
import { ConflictError, ValidationError } from '../../errors';

export type CertificateScope = {
  farmId: string;
  farmerOrganizationId: string;
  standard: string;
  cropScope: string[];
  validFrom: string;
  validTo: string;
};

/** Call after locking the farm row FOR UPDATE, in the same transaction as the write. */
export async function rejectDuplicateActiveCertificate(
  client: Pick<PoolClient, 'query'>,
  issuerId: string,
  scope: CertificateScope,
  excludedId: string | null = null,
): Promise<void> {
  const crops = [
    ...new Set(scope.cropScope.map((crop) => crop.trim().toLowerCase()).filter(Boolean)),
  ];
  if (!scope.standard.trim() || !crops.length || scope.validFrom > scope.validTo) {
    throw new ValidationError(
      'Certificate requires a standard, crop scope and ordered validity dates',
    );
  }
  const duplicate = (
    await client.query(
      `SELECT id FROM organic_certificates c
    WHERE c.farm_id=$1 AND c.certifier_organization_id=$2 AND c.farmer_organization_id=$3
      AND c.status='active' AND lower(btrim(c.standard))=lower(btrim($4))
      AND c.valid_from <= $6::date AND c.valid_to >= $5::date
      AND ($8::uuid IS NULL OR c.id<>$8::uuid)
      AND EXISTS (SELECT 1 FROM unnest(c.crop_scope) crop WHERE lower(btrim(crop))=ANY($7::text[]))
    LIMIT 1`,
      [
        scope.farmId,
        issuerId,
        scope.farmerOrganizationId,
        scope.standard,
        scope.validFrom,
        scope.validTo,
        crops,
        excludedId,
      ],
    )
  ).rows[0];
  if (duplicate)
    throw new ConflictError(
      'An active certificate already covers this issuer, farm, standard, crop and overlapping validity period',
    );
}
