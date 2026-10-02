import type { PoolClient } from "pg";
import crypto from "node:crypto";
import { getClient, query } from "../../db";
import { config } from "../../config/env";
import { emailSender, EmailSender } from "../../services/emailSender";
import logger from "../../logger";

export async function registerRecallParticipants(
  client: PoolClient,
  recallId: string,
) {
  await client.query(
    `INSERT INTO recall_participants(recall_id,organization_id)
    SELECT id,initiated_by_organization_id FROM recall_notices WHERE id=$1
    UNION SELECT affected.recall_id,holding.holder_organization_id FROM recall_affected_batches affected JOIN batch_holdings holding ON holding.batch_id=affected.batch_id WHERE affected.recall_id=$1
    UNION SELECT affected.recall_id,contract.buyer_organization_id FROM recall_affected_batches affected JOIN batch_holdings holding ON holding.batch_id=affected.batch_id JOIN sales_contracts contract ON contract.holding_id=holding.id WHERE affected.recall_id=$1
    UNION SELECT affected.recall_id,contract.seller_organization_id FROM recall_affected_batches affected JOIN batch_holdings holding ON holding.batch_id=affected.batch_id JOIN sales_contracts contract ON contract.holding_id=holding.id WHERE affected.recall_id=$1
    UNION SELECT affected.recall_id,lot.owner_organization_id FROM recall_affected_lots affected JOIN material_lots lot ON lot.id=affected.lot_id WHERE affected.recall_id=$1
    UNION SELECT affected.recall_id,distribution.recipient_organization_id FROM recall_affected_lots affected JOIN lot_distributions distribution ON distribution.lot_id=affected.lot_id WHERE affected.recall_id=$1
    ON CONFLICT DO NOTHING`,
    [recallId],
  );
  await client.query(
    `UPDATE recall_participants participant SET acknowledged_at=notice.initiated_at,
    acknowledged_by_user_id=notice.initiated_by_user_id,acknowledgement_note='Notice issued by this organization'
    FROM recall_notices notice WHERE notice.id=$1 AND participant.recall_id=notice.id AND participant.organization_id=notice.initiated_by_organization_id`,
    [recallId],
  );
  await client.query(
    `UPDATE recall_participants p SET contact_status='escalated',contact_note='No active platform contact; operator follow-up required'
    WHERE p.recall_id=$1 AND NOT EXISTS(SELECT 1 FROM users member WHERE member.organization_id=p.organization_id AND member.active)`,
    [recallId],
  );
  await queueRecallEmails(client, recallId, "activated");
}
export async function queueRecallEmails(
  client: PoolClient,
  recallId: string,
  eventType: "activated" | "resolved",
) {
  await client.query(
    `INSERT INTO recall_email_outbox(recall_id,recipient_user_id,event_type)
    SELECT participant.recall_id,member.id,$2 FROM recall_participants participant JOIN users member ON member.organization_id=participant.organization_id
    WHERE participant.recall_id=$1 AND member.active ON CONFLICT DO NOTHING`,
    [recallId, eventType],
  );
  await client.query(
    `UPDATE recall_participants p SET first_queued_at=COALESCE(first_queued_at,NOW()) WHERE p.recall_id=$1
    AND EXISTS(SELECT 1 FROM recall_email_outbox queue JOIN users member ON member.id=queue.recipient_user_id WHERE queue.recall_id=p.recall_id AND member.organization_id=p.organization_id)`,
    [recallId],
  );
}

// Durable, leased and retryable. SMTP acceptance is not proof of inbox delivery;
// acknowledgements are a separate participant decision. No raw email is logged.
export async function processRecallEmails(
  sender: EmailSender = emailSender(),
  limit = 20,
) {
  const totals = { sent: 0, suppressed: 0, failed: 0 };
  for (let i = 0; i < limit; i++) {
    const client = await getClient();
    let row: any;
    const lease = crypto.randomUUID();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE recall_email_outbox SET status='failed_terminal',last_error=COALESCE(last_error,'FINAL_LEASE_EXPIRED'),exhausted_at=NOW(),lease_token=NULL,lease_expires_at=NULL
        WHERE attempts>=8 AND (status IN ('queued','failed') OR (status='sending' AND lease_expires_at<NOW()))`);
      await client.query(`UPDATE recall_email_outbox queue SET status='suppressed',last_error='RECIPIENT_INACTIVE',lease_token=NULL,lease_expires_at=NULL
        FROM users member WHERE member.id=queue.recipient_user_id AND NOT member.active AND (queue.status IN ('queued','failed') OR (queue.status='sending' AND queue.lease_expires_at<NOW()))`);
      row = (
        await client.query(`SELECT queue.id,queue.event_type,queue.attempts,member.email,notice.reference_code,notice.title,notice.instructions,notice.status AS recall_status
        FROM recall_email_outbox queue JOIN users member ON member.id=queue.recipient_user_id JOIN recall_notices notice ON notice.id=queue.recall_id
        WHERE member.active AND queue.attempts<8 AND ((queue.status IN ('queued','failed') AND queue.next_attempt_at<=NOW()) OR (queue.status='sending' AND queue.lease_expires_at<NOW()))
        ORDER BY queue.created_at,queue.id FOR UPDATE OF queue SKIP LOCKED LIMIT 1`)
      ).rows[0];
      if (row)
        await client.query(
          "UPDATE recall_email_outbox SET status='sending',attempts=attempts+1,lease_token=$2,lease_expires_at=NOW()+INTERVAL '5 minutes' WHERE id=$1",
          [row.id, lease],
        );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    if (!row) break;
    let status: "sent" | "suppressed" | "failed";
    try {
      status = (
        await sender.send({
          to: row.email,
          category: "recall",
          subject: `CocoaTrace recall ${row.event_type}: ${String(row.reference_code).replace(/[\r\n]/g, " ")}`,
          text: `${row.title}\n\nReference: ${row.reference_code}\nCurrent status: ${row.recall_status}\nInstructions: ${row.instructions}\n\nSign in to review the notice and acknowledge your organization's response:\n${new URL("/recalls", config.publicWebUrl).toString()}\n\nA resolved notice does not automatically release retained stock or republish listings.`,
        })
      ).status;
    } catch {
      status = "failed";
      logger.error(
        { notificationId: row.id },
        "Recall email submission failed; queued retry retained",
      );
    }
    await query(
      `UPDATE recall_email_outbox SET status=CASE WHEN $3='failed' AND attempts>=8 THEN 'failed_terminal' ELSE $3 END,
      last_error=CASE WHEN $3='failed' THEN 'SMTP_SUBMISSION_FAILED' ELSE NULL END,exhausted_at=CASE WHEN $3='failed' AND attempts>=8 THEN NOW() ELSE NULL END,sent_at=CASE WHEN $3='sent' THEN NOW() ELSE sent_at END,
      next_attempt_at=NOW()+make_interval(secs=>LEAST(3600,60*attempts)),lease_token=NULL,lease_expires_at=NULL
      WHERE id=$1 AND lease_token=$2 AND status='sending'`,
      [row.id, lease, status],
    );
    totals[status]++;
  }
  return totals;
}
export function startRecallEmailWorker() {
  let running = false,
    stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await processRecallEmails();
    } catch {
      logger.error("Recall email worker failed; durable queue retained");
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), 15000);
  timer.unref();
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
