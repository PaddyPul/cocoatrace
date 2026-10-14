import type { Actor } from '../../services/resourcePolicy';
import {
  hasExplicitPermission,
  hasFarmRelationship,
  hasBatchRelationship,
  hasCertificateRelationship,
} from '../../services/resourcePolicy';
import { activeBatchRecallSql } from '../recall/safety';
import { loadBatchTrust, legacyOrganicStatus } from '../trust/assessment';
import { farmPlotCollection } from './farmPlots';
import { farmCertificateCollection } from './certificates';
import { batchEvidenceCollection } from './evidenceRecords';
import type { Execute } from './paging';

// Callers supply one bounded repeatable-read executor for policy and private hydration.
export async function privateFarmDetail(
  execute: Execute,
  actor: Actor,
  id: string,
  parameters: Record<string, unknown>,
) {
  if (
    !hasExplicitPermission(actor, 'farm.read.all') &&
    !(await hasFarmRelationship(actor, id, execute))
  )
    return null;
  const row = (
    await execute(
      `SELECT f.*, o.name as farmer_org_name FROM farms f JOIN organizations o ON o.id = f.farmer_organization_id WHERE f.id = $1`,
      [id],
    )
  ).rows[0];
  if (!row) return null;
  const plots = await farmPlotCollection(execute, id, parameters.plotMode);
  const certificates = await farmCertificateCollection(
    execute,
    actor,
    id,
    parameters.certificateMode,
  );
  return { farm: row, ...plots, ...certificates };
}
export async function privateCertificateDetail(execute: Execute, actor: Actor, id: string) {
  if (
    !hasExplicitPermission(actor, 'certificate.read.all') &&
    !(await hasCertificateRelationship(actor, id, execute))
  )
    return null;
  return (
    (
      await execute(
        `SELECT c.*, o.name as certifier_name FROM organic_certificates c JOIN organizations o ON o.id = c.certifier_organization_id WHERE c.id = $1`,
        [id],
      )
    ).rows[0] ?? null
  );
}
export async function privateBatchDetail(
  execute: Execute,
  actor: Actor,
  id: string,
  parameters: Record<string, unknown>,
) {
  if (
    !hasExplicitPermission(actor, 'batch.read.all') &&
    !(await hasBatchRelationship(actor, id, execute))
  )
    return null;
  const row = (
    await execute(
      `SELECT b.*, f.name as farm_name, f.farmer_organization_id, o.name as holder_name,
            a.attested_at, a.provenance_hash as att_hash, a.notes as att_notes,
            c.standard as cert_standard, c.valid_to as cert_valid_to
     FROM harvest_batches b
     LEFT JOIN farms f ON f.id = b.farm_id
     JOIN organizations o ON o.id = b.current_holder_id
     LEFT JOIN batch_attestations a ON a.id = b.attestation_id
     LEFT JOIN organic_certificates c ON c.id = a.certificate_id
     WHERE b.id = $1`,
      [id],
    )
  ).rows[0];
  if (!row) return null;
  const evidence = await batchEvidenceCollection(execute, actor, id, parameters.evidenceMode);
  const trust = (await loadBatchTrust([String(row.id)], execute, true)).get(String(row.id));
  return {
    batch: {
      ...row,
      recorded_organic_claim_status: row.organic_claim_status,
      organic_claim_status: trust ? legacyOrganicStatus(trust) : 'self_declared',
      trust,
    },
    ...evidence,
  };
}
export async function privateHoldingDetail(execute: Execute, actor: Actor, id: string) {
  const row = (
    await execute(
      `SELECT h.*, ${activeBatchRecallSql('h.batch_id')} AS "activeRecall", b.crop, b.harvest_date, b.organic_claim_status, b.grade, b.farm_id, b.source_mode, b.source_name, b.source_country, b.source_region, f.name as farm_name, b.quantity_kg as batch_quantity
     FROM batch_holdings h
     JOIN harvest_batches b ON b.id = h.batch_id
     LEFT JOIN farms f ON f.id = b.farm_id
     WHERE h.id = $1 AND h.holder_organization_id = $2`,
      [id, actor.organizationId],
    )
  ).rows[0];
  if (!row) return null;
  const batch =
    (
      await execute(
        `SELECT b.*, f.name as farm_name, o.name as holder_name
     FROM harvest_batches b
     LEFT JOIN farms f ON f.id = b.farm_id
     JOIN organizations o ON o.id = b.current_holder_id
     WHERE b.id = $1`,
        [row.batch_id],
      )
    ).rows[0] ?? null;
  return { holding: row, batch };
}
