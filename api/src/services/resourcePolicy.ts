import { query } from '../db';
import { JwtPayload } from '../middleware/auth';

export type Actor = Pick<JwtPayload, 'organizationId' | 'permissions'>;

export const EVIDENCE_ENTITY_TYPES = [
  'batch', 'certificate', 'contract', 'farm', 'product_profile', 'shipment',
] as const;
export type EvidenceEntityType = (typeof EVIDENCE_ENTITY_TYPES)[number];

export function hasExplicitPermission(actor: Actor, ...permissions: string[]): boolean {
  return actor.permissions.includes('*') || permissions.some((permission) => actor.permissions.includes(permission));
}

async function policyExists(sql: string, params: unknown[]): Promise<boolean> {
  const result = await query(`SELECT EXISTS(${sql}) AS allowed`, params as any[]);
  return Boolean(result.rows[0]?.allowed);
}

export async function hasFarmRelationship(actor: Actor, farmId: string): Promise<boolean> {
  return policyExists(
    `SELECT 1 FROM farms f
      WHERE f.id=$1 AND (
        f.farmer_organization_id=$2 OR f.cooperative_organization_id=$2
        OR EXISTS (
          SELECT 1 FROM organic_certificates c
          WHERE c.farm_id=f.id AND c.certifier_organization_id=$2
        )
        OR EXISTS (
          SELECT 1 FROM harvest_batches b
          JOIN batch_holdings h ON h.batch_id=b.id
          JOIN sales_contracts c ON c.holding_id=h.id
          WHERE b.farm_id=f.id AND (c.seller_organization_id=$2 OR c.buyer_organization_id=$2)
        )
      )`,
    [farmId, actor.organizationId],
  );
}

export async function hasCertificateRelationship(actor: Actor, certificateId: string): Promise<boolean> {
  return policyExists(
    `SELECT 1 FROM organic_certificates cert
      WHERE cert.id=$1 AND (
        cert.certifier_organization_id=$2 OR cert.farmer_organization_id=$2
        OR EXISTS (
          SELECT 1 FROM harvest_batches b
          JOIN batch_holdings h ON h.batch_id=b.id
          JOIN sales_contracts c ON c.holding_id=h.id
          WHERE b.farm_id=cert.farm_id
            AND (c.seller_organization_id=$2 OR c.buyer_organization_id=$2)
        )
      )`,
    [certificateId, actor.organizationId],
  );
}

export async function hasBatchRelationship(actor: Actor, batchId: string): Promise<boolean> {
  return policyExists(
    `SELECT 1 FROM harvest_batches b
      LEFT JOIN farms f ON f.id=b.farm_id
      WHERE b.id=$1 AND (
        b.current_holder_id=$2 OR f.farmer_organization_id=$2 OR f.cooperative_organization_id=$2
        OR EXISTS (SELECT 1 FROM batch_holdings h WHERE h.batch_id=b.id AND h.holder_organization_id=$2)
        OR EXISTS (
          SELECT 1 FROM batch_attestations a
          WHERE a.batch_id=b.id AND a.certifier_organization_id=$2
        )
        OR EXISTS (
          SELECT 1 FROM batch_holdings h
          JOIN sales_contracts c ON c.holding_id=h.id
          WHERE h.batch_id=b.id AND (c.seller_organization_id=$2 OR c.buyer_organization_id=$2)
        )
        OR EXISTS (
          SELECT 1 FROM batch_holdings h
          JOIN sales_contracts c ON c.holding_id=h.id
          JOIN shipments s ON s.contract_id=c.id
          WHERE h.batch_id=b.id
            AND (s.logistics_organization_id=$2 OR s.transport_coordinator_organization_id=$2)
        )
      )`,
    [batchId, actor.organizationId],
  );
}

export async function hasContractRelationship(actor: Actor, contractId: string): Promise<boolean> {
  return policyExists(
    `SELECT 1 FROM sales_contracts c
      WHERE c.id=$1 AND (c.seller_organization_id=$2 OR c.buyer_organization_id=$2)`,
    [contractId, actor.organizationId],
  );
}

export async function hasShipmentRelationship(actor: Actor, shipmentId: string): Promise<boolean> {
  return policyExists(
    `SELECT 1 FROM shipments s
      JOIN sales_contracts c ON c.id=s.contract_id
      WHERE s.id=$1 AND (
        c.seller_organization_id=$2 OR c.buyer_organization_id=$2
        OR s.logistics_organization_id=$2 OR s.transport_coordinator_organization_id=$2
      )`,
    [shipmentId, actor.organizationId],
  );
}

export async function hasProductProfileRelationship(actor: Actor, profileId: string): Promise<boolean> {
  const result = await query('SELECT batch_id FROM product_profiles WHERE id=$1', [profileId]);
  return Boolean(result.rows[0]) && hasBatchRelationship(actor, result.rows[0].batch_id);
}

export async function canAccessEvidenceEntity(
  actor: Actor,
  entityType: EvidenceEntityType,
  entityId: string,
  networkPermission: string | null = 'evidence.read.all',
): Promise<boolean> {
  if (networkPermission && hasExplicitPermission(actor, networkPermission)) return true;
  switch (entityType) {
    case 'farm': return hasFarmRelationship(actor, entityId);
    case 'batch': return hasBatchRelationship(actor, entityId);
    case 'certificate': return hasCertificateRelationship(actor, entityId);
    case 'contract': return hasContractRelationship(actor, entityId);
    case 'product_profile': return hasProductProfileRelationship(actor, entityId);
    case 'shipment': return hasShipmentRelationship(actor, entityId);
  }
}
