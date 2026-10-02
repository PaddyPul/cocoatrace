import type { PoolClient } from "pg";
import { query } from "../../db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../errors";
import {
  inTradeTransaction,
  recordTradeAudit,
  TradeActor,
} from "../trading/transaction";
import { lockRecallBoundary } from "./safety";
import { queueRecallEmails } from "./notifications";

type Actor = TradeActor & { permissions: string[] };
const manages = (actor: Actor, notice: any) =>
  actor.permissions.some((p) => p === "*" || p === "recall.manage.all") ||
  (notice.initiated_by_organization_id === actor.organizationId &&
    actor.permissions.includes("recall.manage"));
async function noticeFor(actor: Actor, id: string, client?: PoolClient) {
  const run = client ? client.query.bind(client) : query;
  const notice = (
    await run(
      `SELECT notice.* FROM recall_notices notice WHERE notice.id=$1 AND
    ($2::boolean OR notice.initiated_by_organization_id=$3 OR EXISTS(SELECT 1 FROM recall_participants p WHERE p.recall_id=notice.id AND p.organization_id=$3)) ${client ? "FOR UPDATE" : ""}`,
      [
        id,
        actor.permissions.some((p) => p === "*" || p === "recall.manage.all"),
        actor.organizationId,
      ],
    )
  ).rows[0];
  if (!notice) throw new NotFoundError("Recall");
  return notice;
}
export async function recallResponse(actor: Actor, id: string) {
  const notice = await noticeFor(actor, id),
    canManage = manages(actor, notice);
  const params = [id, canManage, actor.organizationId];
  const participants = (
    await query(
      `SELECT p.*,org.name AS organization_name,
    (SELECT COUNT(*)::int FROM users member WHERE member.organization_id=p.organization_id AND member.active) AS eligible_contact_count,
    (SELECT MIN(queue.sent_at) FROM recall_email_outbox queue JOIN users member ON member.id=queue.recipient_user_id WHERE queue.recall_id=p.recall_id AND member.organization_id=p.organization_id AND queue.status='sent') AS first_submitted_at,
    ARRAY(SELECT DISTINCT queue.status FROM recall_email_outbox queue JOIN users member ON member.id=queue.recipient_user_id
      WHERE queue.recall_id=p.recall_id AND member.organization_id=p.organization_id) AS email_statuses
    FROM recall_participants p JOIN organizations org ON org.id=p.organization_id WHERE p.recall_id=$1 AND ($2::boolean OR p.organization_id=$3) ORDER BY org.name`,
      params,
    )
  ).rows;
  const holdings = (
    await query(
      `SELECT h.id,h.batch_id,h.quantity_kg,h.holder_organization_id FROM recall_safety_holds hold JOIN batch_holdings h ON h.id=hold.entity_id
    WHERE hold.recall_id=$1 AND hold.entity_type='holding' AND h.status<>'transferred' AND h.quantity_kg>0 AND ($2::boolean OR h.holder_organization_id=$3) ORDER BY h.id`,
      params,
    )
  ).rows;
  const recoveries = (
    await query(
      `SELECT recovery.* FROM recall_recovery_records recovery JOIN batch_holdings h ON h.id=recovery.holding_id
    WHERE recovery.recall_id=$1 AND ($2::boolean OR h.holder_organization_id=$3)`,
      params,
    )
  ).rows;
  const evidence = actor.permissions.some((p) =>
    ["*", "evidence.read", "evidence.read.all"].includes(p),
  )
    ? (
        await query(
          "SELECT id,file_name FROM evidence_items WHERE linked_entity_type='recall' AND linked_entity_id=$1 AND validation_status='validated' AND malware_scan_status='clean'",
          [id],
        )
      ).rows
    : [];
  return {
    notice,
    canManage,
    participants,
    holdings,
    recoveries,
    evidence,
    myOrganizationId: actor.organizationId,
  };
}
async function mutate<T>(
  actor: Actor,
  id: string,
  work: (client: PoolClient, notice: any) => Promise<T>,
) {
  return inTradeTransaction(async (client) => {
    await lockRecallBoundary(client);
    const notice = await noticeFor(actor, id, client);
    if (notice.status !== "active")
      throw new ConflictError(
        "This recall is closed; its response history is read-only",
      );
    return work(client, notice);
  });
}
export async function acknowledgeRecall(
  actor: Actor,
  id: string,
  note: string,
) {
  return mutate(actor, id, async (client) => {
    const row = (
      await client.query(
        `UPDATE recall_participants SET acknowledged_at=COALESCE(acknowledged_at,NOW()),
      acknowledged_by_user_id=COALESCE(acknowledged_by_user_id,$3),acknowledgement_note=COALESCE(acknowledgement_note,$4)
      WHERE recall_id=$1 AND organization_id=$2 RETURNING *`,
        [id, actor.organizationId, actor.id, note],
      )
    ).rows[0];
    if (!row)
      throw new ForbiddenError(
        "Only affected organizations can acknowledge this notice",
      );
    await recordTradeAudit(
      client,
      actor,
      "recall.acknowledge",
      "recall_notice",
      id,
      { note, organizationId: actor.organizationId },
    );
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
    if (!manages(actor, notice))
      throw new ForbiddenError(
        "Only this recall manager can record contact attempts",
      );
    const row = (
      await client.query(
        `UPDATE recall_participants SET contact_status=$3,contact_note=$4,contact_updated_by_user_id=$5,contact_updated_at=NOW()
      WHERE recall_id=$1 AND organization_id=$2 RETURNING *`,
        [id, orgId, status, note, actor.id],
      )
    ).rows[0];
    if (!row) throw new NotFoundError("Recall participant");
    await recordTradeAudit(
      client,
      actor,
      "recall.contact",
      "recall_notice",
      id,
      { organizationId: orgId, status, note },
    );
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
    const holding = (
      await client.query(
        `SELECT h.* FROM batch_holdings h JOIN recall_safety_holds hold ON hold.entity_id=h.id AND hold.entity_type='holding'
      WHERE hold.recall_id=$1 AND h.id=$2 AND h.status<>'transferred' FOR UPDATE OF h`,
        [id, holdingId],
      )
    ).rows[0];
    if (!holding) throw new NotFoundError("Affected inventory");
    if (holding.holder_organization_id !== actor.organizationId)
      throw new ForbiddenError(
        "Only the inventory holder can record its physical outcome",
      );
    const values = [
      input.quarantinedKg,
      input.returnedKg,
      input.destroyedKg,
      input.correctedKg,
      input.releasedKg,
    ];
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
        "Use finite, nonnegative quantities with at most three decimal places",
      );
    if (
      values.reduce((sum, value) => sum + toGrams(value), 0) >
      toGrams(Number(holding.quantity_kg))
    )
      throw new ValidationError("Recorded quantities exceed this holding");
    const previous =
      (
        await client.query(
          "SELECT * FROM recall_recovery_records WHERE recall_id=$1 AND holding_id=$2",
          [id, holdingId],
        )
      ).rows[0] || null;
    const row = (
      await client.query(
        `INSERT INTO recall_recovery_records(recall_id,holding_id,quarantined_kg,returned_kg,destroyed_kg,corrected_kg,released_kg,note,recorded_by_user_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(recall_id,holding_id) DO UPDATE SET quarantined_kg=$3,returned_kg=$4,destroyed_kg=$5,corrected_kg=$6,released_kg=$7,note=$8,recorded_by_user_id=$9,updated_at=NOW() RETURNING *`,
        [id, holdingId, ...values, input.note, actor.id],
      )
    ).rows[0];
    await recordTradeAudit(
      client,
      actor,
      "recall.recovery",
      "recall_notice",
      id,
      {
        holdingId,
        previous,
        response: row,
        inventoryPolicy: "quantities and ownership unchanged",
      },
    );
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
    throw new ValidationError(
      "Provide a substantive resolution reason and supporting evidence",
    );
  return mutate(actor, id, async (client, notice) => {
    if (!manages(actor, notice))
      throw new ForbiddenError("Only this recall manager can resolve it");
    const proof = (
      await client.query(
        `SELECT id FROM evidence_items WHERE id=ANY($1::uuid[]) AND linked_entity_type='recall' AND linked_entity_id=$2
      AND validation_status='validated' AND malware_scan_status='clean' FOR SHARE`,
        [evidenceIds, id],
      )
    ).rows;
    if (proof.length !== new Set(evidenceIds).size)
      throw new ValidationError(
        "Resolution requires clean evidence attached to this exact recall",
      );
    const missingAck = (
      await client.query(
        "SELECT 1 FROM recall_participants WHERE recall_id=$1 AND acknowledged_at IS NULL LIMIT 1",
        [id],
      )
    ).rows.length;
    if (missingAck)
      throw new ConflictError(
        "Every affected organization must acknowledge the notice before resolution",
      );
    const inventory = (
      await client.query(
        `SELECT h.quantity_kg,recovery.* FROM recall_safety_holds hold JOIN batch_holdings h ON h.id=hold.entity_id
      LEFT JOIN recall_recovery_records recovery ON recovery.recall_id=hold.recall_id AND recovery.holding_id=h.id
      WHERE hold.recall_id=$1 AND hold.entity_type='holding' AND h.status<>'transferred' AND h.quantity_kg>0`,
        [id],
      )
    ).rows;
    for (const row of inventory) {
      const values = [
        "quarantined_kg",
        "returned_kg",
        "destroyed_kg",
        "corrected_kg",
        "released_kg",
      ].map((key) => Number(row[key] || 0));
      if (
        !row.holding_id ||
        values[0] > 0 ||
        values.reduce((sum, value) => sum + toGrams(value), 0) !==
          toGrams(Number(row.quantity_kg))
      )
        throw new ConflictError(
          "All current inventory must be fully accounted for with no quantity left in quarantine",
        );
    }
    await client.query(
      `UPDATE recall_safety_holds hold SET released_at=NOW() FROM batch_holdings h
      LEFT JOIN recall_recovery_records recovery ON recovery.holding_id=h.id AND recovery.recall_id=$1
      WHERE hold.recall_id=$1 AND hold.entity_type='holding' AND hold.entity_id=h.id AND hold.released_at IS NULL
        AND (h.status='transferred' OR h.quantity_kg=0 OR (recovery.returned_kg=0 AND recovery.destroyed_kg=0 AND recovery.quarantined_kg=0))`,
      [id],
    );
    await client.query(
      `UPDATE recall_safety_holds hold SET released_at=NOW() FROM material_lots lot
      WHERE hold.recall_id=$1 AND hold.entity_type='lot' AND hold.entity_id=lot.id AND hold.released_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM recall_safety_holds remaining JOIN batch_holdings h ON h.id=remaining.entity_id
        WHERE remaining.recall_id=$1 AND remaining.entity_type='holding' AND remaining.released_at IS NULL AND h.batch_id=lot.batch_id)`,
      [id],
    );
    const updated = (
      await client.query(
        `UPDATE recall_notices SET status='resolved',resolved_at=NOW(),resolved_by_user_id=$2,resolution_reason=$3,resolution_evidence_ids=$4 WHERE id=$1 RETURNING *`,
        [id, actor.id, reason, [...new Set(evidenceIds)]],
      )
    ).rows[0];
    await recordTradeAudit(
      client,
      actor,
      "recall.resolve",
      "recall_notice",
      id,
      {
        reason,
        evidenceIds,
        listingPolicy: "explicit republishing required",
        holdPolicy:
          "returned and destroyed inventory retains batch safety hold",
      },
    );
    await queueRecallEmails(client, id, "resolved");
    return updated;
  });
}
