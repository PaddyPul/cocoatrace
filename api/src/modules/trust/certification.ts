import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import { inTradeTransaction as inTransaction, recordTradeAudit, TradeActor } from '../trading/transaction';
import { certificateExpiry, recordClaimReview } from './writeReviews';
import { hashObject } from '../../services/audit';

type CertificateInput = {
  farmerOrganizationId: string; farmId: string; standard: string; cropScope: string[];
  validFrom: string; validTo: string; issuingAuthority: string; accreditationReference: string;
};

export async function issueCertificateRecord(actor: TradeActor, input: CertificateInput) {
  return inTransaction(async client => {
    const farm = (await client.query('SELECT * FROM farms WHERE id=$1 AND farmer_organization_id=$2 FOR SHARE',
      [input.farmId,input.farmerOrganizationId])).rows[0];
    if (!farm) throw new ValidationError('Farm does not belong to the supplied farmer organization');
    const issuer = (await client.query('SELECT type,verification_status FROM organizations WHERE id=$1 FOR SHARE',
      [actor.organizationId])).rows[0];
    if (!issuer || issuer.type !== 'certifier' || issuer.verification_status !== 'verified' || actor.organizationId === farm.farmer_organization_id) {
      throw new ForbiddenError('Certificates require an approved certifier independent of the farm owner');
    }
    const certificate = (await client.query(`INSERT INTO organic_certificates
      (certifier_organization_id,farmer_organization_id,farm_id,standard,crop_scope,valid_from,valid_to,issuing_authority,accreditation_reference)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [actor.organizationId,input.farmerOrganizationId,input.farmId,input.standard,input.cropScope,
      input.validFrom,input.validTo,input.issuingAuthority,input.accreditationReference])).rows[0];
    await recordClaimReview(client,actor,{entityType:'certificate',entityId:certificate.id,
      sourceReference:certificate.id,reviewMethod:'certificate_issuance',expiresAt:certificateExpiry(certificate.valid_to),
      snapshot:{farmId:input.farmId,standard:input.standard,cropScope:input.cropScope}});
    await recordTradeAudit(client,actor,'certificate.issue','organic_certificate',certificate.id);
    return certificate;
  });
}

export async function attestBatchRecord(actor: TradeActor, batchId: string, input: {certificateId:string;notes?:string}) {
  return inTransaction(async client => {
    const batch = (await client.query('SELECT * FROM harvest_batches WHERE id=$1 FOR UPDATE',[batchId])).rows[0];
    if (!batch) throw new NotFoundError('Batch');
    if (batch.attestation_id) throw new ConflictError('Batch already attested');
    if (batch.source_mode === 'direct_inventory' || !batch.farm_id) throw new ValidationError('Conventional direct inventory cannot be attested as farm organic supply');
    const cert = (await client.query("SELECT * FROM organic_certificates WHERE id=$1 AND status='active' FOR SHARE",[input.certificateId])).rows[0];
    if (!cert) throw new ValidationError('Certificate not found or not active');
    if (cert.certifier_organization_id !== actor.organizationId) throw new ForbiddenError('Certificate not issued by your organization');
    if (cert.farm_id !== batch.farm_id) throw new ValidationError('Certificate does not cover this farm');
    const farm = (await client.query('SELECT farmer_organization_id FROM farms WHERE id=$1 FOR SHARE',[batch.farm_id])).rows[0];
    if (!farm || cert.farmer_organization_id !== farm.farmer_organization_id) throw new ValidationError('Certificate farmer organization does not match the farm owner');
    if (!Array.isArray(cert.crop_scope) || !cert.crop_scope.some((crop: string) => crop.trim().toLowerCase() === String(batch.crop).trim().toLowerCase())) throw new ValidationError('Certificate does not cover this crop');
    const from = new Date(cert.valid_from), expiry = certificateExpiry(cert.valid_to), harvest = new Date(batch.harvest_date), now = new Date();
    if (![from,expiry,harvest].every(date => Number.isFinite(date.getTime())) || harvest < from || harvest >= expiry) throw new ValidationError('Harvest date outside certificate validity window');
    if (now < from || now >= expiry) throw new ValidationError('Certificate is not currently valid');
    const issuer = (await client.query('SELECT type,verification_status FROM organizations WHERE id=$1 FOR SHARE',[actor.organizationId])).rows[0];
    if (!issuer || issuer.type !== 'certifier' || issuer.verification_status !== 'verified' || actor.organizationId === farm.farmer_organization_id) throw new ForbiddenError('Organic review requires an approved independent certifier');
    const provenanceHash = hashObject({batchId,certificateId:cert.id,reviewerUserId:actor.id,reviewedAt:now.toISOString()});
    const attestation = (await client.query(`INSERT INTO batch_attestations
      (batch_id,certificate_id,certifier_user_id,certifier_organization_id,provenance_hash,notes)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[batchId,cert.id,actor.id,actor.organizationId,provenanceHash,input.notes || null])).rows[0];
    await client.query("UPDATE harvest_batches SET attestation_id=$1,organic_claim_status='attested',provenance_hash=$2 WHERE id=$3",[attestation.id,provenanceHash,batchId]);
    await recordClaimReview(client,actor,{entityType:'batch',entityId:batchId,sourceReference:cert.id,
      reviewMethod:'certificate_attestation',expiresAt:expiry,snapshot:{attestationId:attestation.id,certificateId:cert.id,farmId:batch.farm_id,crop:batch.crop}});
    await recordTradeAudit(client,actor,'batch.attest','harvest_batch',batchId,{attestationId:attestation.id,certificateId:cert.id});
    return {attestation,policyChecks:[{rule:'Certificate currently valid and covers harvest',passed:true},{rule:'Independent issuing certifier reviewed the batch',passed:true}]};
  });
}

export async function changeCertificateStatusRecord(actor: TradeActor, certificateId: string, action: string, reason?: string) {
  const states: Record<string, string> = {suspend:'suspended',revoke:'revoked',reinstate:'active'};
  if (!states[action]) throw new ValidationError('Invalid certificate action');
  return inTransaction(async client => {
    const cert = (await client.query('SELECT * FROM organic_certificates WHERE id=$1 AND certifier_organization_id=$2 FOR UPDATE',[certificateId,actor.organizationId])).rows[0];
    if (!cert) throw new NotFoundError('Certificate');
    if (action === 'suspend' && cert.status !== 'active') throw new ConflictError('Only active certificates can be suspended');
    if (action === 'reinstate' && cert.status !== 'suspended') throw new ConflictError('Only suspended certificates can be reinstated; revoked certificates require a new issuance');
    if (action === 'reinstate' && (new Date() < new Date(cert.valid_from) || new Date() >= certificateExpiry(cert.valid_to))) throw new ConflictError('Certificate must be currently valid to reinstate');
    const issuer = (await client.query('SELECT type,verification_status FROM organizations WHERE id=$1 FOR SHARE',[actor.organizationId])).rows[0];
    if (!issuer || issuer.type !== 'certifier' || issuer.verification_status !== 'verified') throw new ForbiddenError('Certificate actions require an approved issuing certifier');
    const updated = (await client.query('UPDATE organic_certificates SET status=$1 WHERE id=$2 RETURNING *',[states[action],certificateId])).rows[0];
    if (action === 'reinstate') {
      await recordClaimReview(client,actor,{entityType:'certificate',entityId:certificateId,sourceReference:certificateId,
        reviewMethod:'certificate_reinstatement',expiresAt:certificateExpiry(cert.valid_to),snapshot:{previousStatus:cert.status,reason:reason || null}});
    } else {
      await client.query("UPDATE trust_claim_reviews SET status='revoked' WHERE entity_type='certificate' AND entity_id=$1 AND claim_key='organic' AND status='reviewed'",[certificateId]);
    }
    await recordTradeAudit(client,actor,`certificate.${action}`,'organic_certificate',certificateId,{previousStatus:cert.status,newStatus:states[action],reason:reason || null});
    return updated;
  });
}
