import type { PoolClient, QueryResult } from 'pg';
import type { Execute } from '../catalog/paging';
import {
  evidenceAvailabilityProjection,
  evidenceAvailabilityUsableSql,
} from '../../services/evidenceAvailability';
import type {
  RecallNotice,
  RecallParticipant,
  AffectedHolding,
  RecoveryRecord,
  ResolutionInventory,
} from './responseModel';

export async function loadNotice(
  client: PoolClient,
  parameters: [recallId: string, network: boolean, organizationId: string],
): Promise<QueryResult<RecallNotice>> {
  return client.query<RecallNotice>(
    `SELECT notice.* FROM recall_notices notice WHERE notice.id=$1 AND
    ($2::boolean OR notice.initiated_by_organization_id=$3 OR EXISTS(SELECT 1 FROM recall_participants p WHERE p.recall_id=notice.id AND p.organization_id=$3)) FOR UPDATE`,
    parameters,
  );
}

export async function acknowledgeParticipant(
  client: PoolClient,
  parameters: [recallId: string, organizationId: string, userId: string, note: string],
): Promise<QueryResult<RecallParticipant>> {
  return client.query<RecallParticipant>(
    `UPDATE recall_participants SET acknowledged_at=COALESCE(acknowledged_at,NOW()),
      acknowledged_by_user_id=COALESCE(acknowledged_by_user_id,$3),acknowledgement_note=COALESCE(acknowledgement_note,$4)
      WHERE recall_id=$1 AND organization_id=$2 RETURNING *`,
    parameters,
  );
}

export async function updateParticipantContact(
  client: PoolClient,
  parameters: [
    recallId: string,
    organizationId: string,
    status: string,
    note: string,
    userId: string,
  ],
): Promise<QueryResult<RecallParticipant>> {
  return client.query<RecallParticipant>(
    `UPDATE recall_participants SET contact_status=$3,contact_note=$4,contact_updated_by_user_id=$5,contact_updated_at=NOW()
      WHERE recall_id=$1 AND organization_id=$2 RETURNING *`,
    parameters,
  );
}

export async function loadAffectedHolding(
  client: PoolClient,
  parameters: [recallId: string, holdingId: string],
): Promise<QueryResult<AffectedHolding>> {
  return client.query<AffectedHolding>(
    `SELECT h.* FROM batch_holdings h JOIN recall_safety_holds hold ON hold.entity_id=h.id AND hold.entity_type='holding'
      WHERE hold.recall_id=$1 AND h.id=$2 AND h.status<>'transferred' FOR UPDATE OF h`,
    parameters,
  );
}

export async function loadRecovery(
  client: PoolClient,
  parameters: [recallId: string, holdingId: string],
): Promise<QueryResult<RecoveryRecord>> {
  return client.query<RecoveryRecord>(
    'SELECT * FROM recall_recovery_records WHERE recall_id=$1 AND holding_id=$2',
    parameters,
  );
}

export async function saveRecovery(
  client: PoolClient,
  parameters: [
    recallId: string,
    holdingId: string,
    quarantined: number,
    returned: number,
    destroyed: number,
    corrected: number,
    released: number,
    note: string,
    userId: string,
  ],
): Promise<QueryResult<RecoveryRecord>> {
  return client.query<RecoveryRecord>(
    `INSERT INTO recall_recovery_records(recall_id,holding_id,quarantined_kg,returned_kg,destroyed_kg,corrected_kg,released_kg,note,recorded_by_user_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(recall_id,holding_id) DO UPDATE SET quarantined_kg=$3,returned_kg=$4,destroyed_kg=$5,corrected_kg=$6,released_kg=$7,note=$8,recorded_by_user_id=$9,updated_at=NOW() RETURNING *`,
    parameters,
  );
}

export async function loadResolutionCandidates(
  execute: Execute,
  parameters: [
    evidenceIds: string[],
    recallId: string,
    network: boolean,
    organizationId: string,
    tenantManager: boolean,
  ],
): Promise<{ rows: Record<string, unknown>[] }> {
  return execute(
    `SELECT ${evidenceAvailabilityProjection('e')}
    FROM evidence_items e JOIN recall_notices notice ON notice.id=e.linked_entity_id AND e.linked_entity_type='recall'
    WHERE notice.id=$2 AND notice.status='active' AND e.id=ANY($1::uuid[])
    AND ($3::boolean OR (notice.initiated_by_organization_id=$4 AND $5::boolean))
    AND e.validation_status='validated' AND e.malware_scan_status='clean' AND e.review_status<>'rejected'
    AND e.storage_key IS NOT NULL AND ${evidenceAvailabilityUsableSql('e')}
    ORDER BY e.id DESC LIMIT 65`,
    parameters,
  );
}

export async function lockResolutionProof(
  client: PoolClient,
  parameters: [evidenceIds: string[], recallId: string],
): Promise<QueryResult<Record<string, unknown>>> {
  return client.query<Record<string, unknown>>(
    `SELECT ${evidenceAvailabilityProjection()} FROM evidence_items WHERE id=ANY($1::uuid[]) AND linked_entity_type='recall' AND linked_entity_id=$2
      AND validation_status='validated' AND malware_scan_status='clean' AND review_status<>'rejected'
      AND storage_key IS NOT NULL AND ${evidenceAvailabilityUsableSql()} ORDER BY id DESC LIMIT 65 FOR SHARE`,
    parameters,
  );
}

export async function loadMissingAcknowledgement(
  client: PoolClient,
  parameters: [recallId: string],
): Promise<QueryResult<Record<string, unknown>>> {
  return client.query<Record<string, unknown>>(
    'SELECT 1 FROM recall_participants WHERE recall_id=$1 AND acknowledged_at IS NULL LIMIT 1',
    parameters,
  );
}

export async function loadResolutionInventory(
  client: PoolClient,
  parameters: [recallId: string],
): Promise<QueryResult<ResolutionInventory>> {
  return client.query<ResolutionInventory>(
    `SELECT h.quantity_kg,recovery.* FROM recall_safety_holds hold JOIN batch_holdings h ON h.id=hold.entity_id
      LEFT JOIN recall_recovery_records recovery ON recovery.recall_id=hold.recall_id AND recovery.holding_id=h.id
      WHERE hold.recall_id=$1 AND hold.entity_type='holding' AND h.status<>'transferred' AND h.quantity_kg>0`,
    parameters,
  );
}

export async function releaseAccountedHoldingHolds(
  client: PoolClient,
  parameters: [recallId: string],
): Promise<QueryResult<Record<string, unknown>>> {
  return client.query<Record<string, unknown>>(
    `UPDATE recall_safety_holds hold SET released_at=NOW() FROM batch_holdings h
      LEFT JOIN recall_recovery_records recovery ON recovery.holding_id=h.id AND recovery.recall_id=$1
      WHERE hold.recall_id=$1 AND hold.entity_type='holding' AND hold.entity_id=h.id AND hold.released_at IS NULL
        AND (h.status='transferred' OR h.quantity_kg=0 OR (recovery.returned_kg=0 AND recovery.destroyed_kg=0 AND recovery.quarantined_kg=0))`,
    parameters,
  );
}

export async function releaseAccountedLotHolds(
  client: PoolClient,
  parameters: [recallId: string],
): Promise<QueryResult<Record<string, unknown>>> {
  return client.query<Record<string, unknown>>(
    `UPDATE recall_safety_holds hold SET released_at=NOW() FROM material_lots lot
      WHERE hold.recall_id=$1 AND hold.entity_type='lot' AND hold.entity_id=lot.id AND hold.released_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM recall_safety_holds remaining JOIN batch_holdings h ON h.id=remaining.entity_id
        WHERE remaining.recall_id=$1 AND remaining.entity_type='holding' AND remaining.released_at IS NULL AND h.batch_id=lot.batch_id)`,
    parameters,
  );
}

export async function resolveNotice(
  client: PoolClient,
  parameters: [recallId: string, userId: string, reason: string, evidenceIds: string[]],
): Promise<QueryResult<RecallNotice>> {
  return client.query<RecallNotice>(
    `UPDATE recall_notices SET status='resolved',resolved_at=NOW(),resolved_by_user_id=$2,resolution_reason=$3,resolution_evidence_ids=$4 WHERE id=$1 RETURNING *`,
    parameters,
  );
}
