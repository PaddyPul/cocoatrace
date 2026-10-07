import { query } from '../db';
import { JwtPayload } from '../middleware/auth';

// Callers can supply their transaction/snapshot executor without coupling policies to a feature module.
type PolicyRead = (sql: string, parameters?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

export type Actor = Pick<JwtPayload, 'organizationId' | 'permissions'>;

export const EVIDENCE_ENTITY_TYPES = [
  'batch', 'certificate', 'contract', 'farm', 'product_profile', 'shipment', 'recall',
] as const;
export type EvidenceEntityType = (typeof EVIDENCE_ENTITY_TYPES)[number];

export function hasExplicitPermission(actor: Actor, ...permissions: string[]): boolean {
  return actor.permissions.includes('*') || permissions.some((permission) => actor.permissions.includes(permission));
}

async function policyExists(sql: string, params: unknown[], execute: PolicyRead = query): Promise<boolean> {
  const result = await execute(`SELECT EXISTS(${sql}) AS allowed`, params);
  return Boolean(result.rows[0]?.allowed);
}

export async function hasFarmRelationship(actor: Actor, farmId: string, execute: PolicyRead = query): Promise<boolean> {
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
    [farmId, actor.organizationId], execute,
  );
}

export async function hasCertificateRelationship(actor: Actor, certificateId: string, execute: PolicyRead = query): Promise<boolean> {
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
    [certificateId, actor.organizationId], execute,
  );
}

export async function hasBatchRelationship(actor: Actor, batchId: string, execute: PolicyRead = query): Promise<boolean> {
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
    [batchId, actor.organizationId], execute,
  );
}

export async function hasContractRelationship(actor: Actor, contractId: string, execute: PolicyRead = query): Promise<boolean> {
  return policyExists(
    `SELECT 1 FROM sales_contracts c
      WHERE c.id=$1 AND (c.seller_organization_id=$2 OR c.buyer_organization_id=$2)`,
    [contractId, actor.organizationId], execute,
  );
}

export async function hasShipmentRelationship(actor: Actor, shipmentId: string, execute: PolicyRead = query): Promise<boolean> {
  return policyExists(
    `SELECT 1 FROM shipments s
      JOIN sales_contracts c ON c.id=s.contract_id
      WHERE s.id=$1 AND (
        c.seller_organization_id=$2 OR c.buyer_organization_id=$2
        OR s.logistics_organization_id=$2 OR s.transport_coordinator_organization_id=$2
      )`,
    [shipmentId, actor.organizationId], execute,
  );
}

export async function hasProductProfileRelationship(actor: Actor, profileId: string, execute: PolicyRead = query): Promise<boolean> {
  const result = await execute('SELECT batch_id FROM product_profiles WHERE id=$1', [profileId]);
  return Boolean(result.rows[0]) && hasBatchRelationship(actor, String(result.rows[0].batch_id), execute);
}

export async function canAccessEvidenceEntity(
  actor: Actor,
  entityType: EvidenceEntityType,
  entityId: string,
  networkPermission: string | null = 'evidence.read.all',
  execute: PolicyRead = query,
): Promise<boolean> {
  if (networkPermission && hasExplicitPermission(actor, networkPermission)) return true;
  switch (entityType) {
    case 'recall': return policyExists(`SELECT 1 FROM recall_notices notice WHERE notice.id=$1 AND
      (notice.initiated_by_organization_id=$2 OR $3::boolean OR EXISTS(SELECT 1 FROM recall_participants p WHERE p.recall_id=notice.id AND p.organization_id=$2))`,
      [entityId,actor.organizationId,hasExplicitPermission(actor,'recall.manage.all')], execute);
    case 'farm': return hasFarmRelationship(actor, entityId, execute);
    case 'batch': return hasBatchRelationship(actor, entityId, execute);
    case 'certificate': return hasCertificateRelationship(actor, entityId, execute);
    case 'contract': return hasContractRelationship(actor, entityId, execute);
    case 'product_profile': return hasProductProfileRelationship(actor, entityId, execute);
    case 'shipment': return hasShipmentRelationship(actor, entityId, execute);
  }
}
