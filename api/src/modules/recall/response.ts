import type { PoolClient } from 'pg';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import { inTradeTransaction, recordTradeAudit } from '../trading/transaction';
import { lockRecallBoundary } from './safety';
import { queueRecallEmails } from './notifications';

import {
  assertWorkflowEvidenceLimit,
  preflightEvidence,
} from '../../services/evidenceAvailability';

import type { RecallActor as Actor, RecallNotice } from './responseModel';
import { canManageRecall, hasNetworkRecallAuthority } from './policy';
import * as repository from './responseRepository';
async function noticeFor(actor: Actor, id: string, client: PoolClient) {
  const notice = (
    await repository.loadNotice(client, [
      id,
      hasNetworkRecallAuthority(actor),
      actor.organizationId,
    ])
  ).rows[0];
  if (!notice) throw new NotFoundError('Recall');
  return notice;
}
export { recallResponseRead as recallResponse } from '../catalog/recallResponseRead';
async function mutate<T>(
  actor: Actor,
  id: string,
  work: (client: PoolClient, notice: RecallNotice) => Promise<T>,
) {
  return inTradeTransaction(async (client) => {
    await lockRecallBoundary(client);
    const notice = await noticeFor(actor, id, client);
    if (notice.status !== 'active')
      throw new ConflictError('This recall is closed; its response history is read-only');
    return work(client, notice);
  });
}
export async function acknowledgeRecall(actor: Actor, id: string, note: string) {
  return mutate(actor, id, async (client) => {
    const row = (
      await repository.acknowledgeParticipant(client, [id, actor.organizationId, actor.id, note])
    ).rows[0];
    if (!row) throw new ForbiddenError('Only affected organizations can acknowledge this notice');
    await recordTradeAudit(client, actor, 'recall.acknowledge', 'recall_notice', id, {
      note,
      organizationId: actor.organizationId,
    });
    return row;
  });
}
export async function contactRecallParticipant(
  actor: Actor,
  id: string,
  orgId: string,
  status: string,
  note: string,
) {
  return mutate(actor, id, async (client, notice) => {
    if (!canManageRecall(actor, notice))
      throw new ForbiddenError('Only this recall manager can record contact attempts');
    const row = (
      await repository.updateParticipantContact(client, [id, orgId, status, note, actor.id])
    ).rows[0];
    if (!row) throw new NotFoundError('Recall participant');
    await recordTradeAudit(client, actor, 'recall.contact', 'recall_notice', id, {
      organizationId: orgId,
      status,
      note,
    });
    return row;
  });
}
export type RecoveryInput = {
  quarantinedKg: number;
  returnedKg: number;
  destroyedKg: number;
  correctedKg: number;
  releasedKg: number;
  note: string;
};
const toGrams = (value: number) => Math.round(value * 1000);
export async function recordRecallRecovery(
  actor: Actor,
  id: string,
  holdingId: string,
  input: RecoveryInput,
) {
  return mutate(actor, id, async (client) => {
    const holding = (await repository.loadAffectedHolding(client, [id, holdingId])).rows[0];
    if (!holding) throw new NotFoundError('Affected inventory');
    if (holding.holder_organization_id !== actor.organizationId)
      throw new ForbiddenError('Only the inventory holder can record its physical outcome');
    const values = [
      input.quarantinedKg,
      input.returnedKg,
      input.destroyedKg,
      input.correctedKg,
      input.releasedKg,
    ] as const;
    if (
      values.some(
        (value) =>
          !Number.isFinite(value) ||
          value < 0 ||
          !Number.isSafeInteger(toGrams(value)) ||
          Math.abs(value * 1000 - toGrams(value)) > 0.00001,
      )
    )
      throw new ValidationError(
        'Use finite, nonnegative quantities with at most three decimal places',
      );
    if (
      values.reduce((sum, value) => sum + toGrams(value), 0) > toGrams(Number(holding.quantity_kg))
    )
      throw new ValidationError('Recorded quantities exceed this holding');
    const previous = (await repository.loadRecovery(client, [id, holdingId])).rows[0] || null;
    const row = (
      await repository.saveRecovery(client, [id, holdingId, ...values, input.note, actor.id])
    ).rows[0];
    await recordTradeAudit(client, actor, 'recall.recovery', 'recall_notice', id, {
      holdingId,
      previous,
      response: row,
      inventoryPolicy: 'quantities and ownership unchanged',
    });
    return row;
  });
}
export async function resolveRecallResponse(
  actor: Actor,
  id: string,
  reason: string,
  evidenceIds: string[],
) {
  if (reason.trim().length < 10 || !evidenceIds.length)
    throw new ValidationError('Provide a substantive resolution reason and supporting evidence');
  assertWorkflowEvidenceLimit(evidenceIds);
  const selectedIds = [...new Set(evidenceIds)].sort();
  const availability = await preflightEvidence(
    async (execute) =>
      (
        await repository.loadResolutionCandidates(execute, [
          selectedIds,
          id,
          hasNetworkRecallAuthority(actor),
          actor.organizationId,
          actor.permissions.includes('recall.manage'),
        ])
      ).rows,
  );
  return mutate(actor, id, async (client, notice) => {
    if (!canManageRecall(actor, notice))
      throw new ForbiddenError('Only this recall manager can resolve it');
    const proof = (await repository.lockResolutionProof(client, [selectedIds, id])).rows;
    assertWorkflowEvidenceLimit(proof);
    if (proof.length !== selectedIds.length || proof.some((row) => !availability.available(row)))
      throw new ValidationError(
        'Resolution requires available, clean, non-rejected evidence attached to this exact recall',
      );
    const missingAck = (await repository.loadMissingAcknowledgement(client, [id])).rows.length;
    if (missingAck)
      throw new ConflictError(
        'Every affected organization must acknowledge the notice before resolution',
      );
    const inventory = (await repository.loadResolutionInventory(client, [id])).rows;
    for (const row of inventory) {
      const values = [
        'quarantined_kg',
        'returned_kg',
        'destroyed_kg',
        'corrected_kg',
        'released_kg',
      ].map((key) => Number(row[key] || 0));
      if (
        !row.holding_id ||
        values[0] > 0 ||
        values.reduce((sum, value) => sum + toGrams(value), 0) !== toGrams(Number(row.quantity_kg))
      )
        throw new ConflictError(
          'All current inventory must be fully accounted for with no quantity left in quarantine',
        );
    }
    await repository.releaseAccountedHoldingHolds(client, [id]);
    await repository.releaseAccountedLotHolds(client, [id]);
    const updated = (
      await repository.resolveNotice(client, [id, actor.id, reason, [...new Set(evidenceIds)]])
    ).rows[0];
    await recordTradeAudit(client, actor, 'recall.resolve', 'recall_notice', id, {
      reason,
      evidenceIds,
      listingPolicy: 'explicit republishing required',
      holdPolicy: 'returned and destroyed inventory retains batch safety hold',
    });
    await queueRecallEmails(client, id, 'resolved');
    return updated;
  });
}
