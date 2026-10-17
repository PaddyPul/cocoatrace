import type { PoolClient } from 'pg';
import { query } from '../../db';
export interface RecallEmailRow {
  id: string;
  event_type: 'activated' | 'resolved';
  attempts: number;
  email: string;
  reference_code: string;
  title: string;
  instructions: string;
  recall_status: string;
}
export async function persistRecallParticipants(client: PoolClient, recallId: string) {
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
  await queueRecallEmails(client, recallId, 'activated');
}
export async function queueRecallEmails(
  client: PoolClient,
  recallId: string,
  eventType: 'activated' | 'resolved',
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

export async function claimRecallEmail(
  client: PoolClient,
  lease: string,
): Promise<RecallEmailRow | undefined> {
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE recall_email_outbox SET status='failed_terminal',last_error=COALESCE(last_error,'FINAL_LEASE_EXPIRED'),exhausted_at=NOW(),lease_token=NULL,lease_expires_at=NULL
        WHERE attempts>=8 AND (status IN ('queued','failed') OR (status='sending' AND lease_expires_at<NOW()))`);
    await client.query(`UPDATE recall_email_outbox queue SET status='suppressed',last_error='RECIPIENT_INACTIVE',lease_token=NULL,lease_expires_at=NULL
        FROM users member WHERE member.id=queue.recipient_user_id AND NOT member.active AND (queue.status IN ('queued','failed') OR (queue.status='sending' AND queue.lease_expires_at<NOW()))`);
    const row = (
      await client.query<RecallEmailRow>(`SELECT queue.id,queue.event_type,queue.attempts,member.email,notice.reference_code,notice.title,notice.instructions,notice.status AS recall_status
        FROM recall_email_outbox queue JOIN users member ON member.id=queue.recipient_user_id JOIN recall_notices notice ON notice.id=queue.recall_id
        WHERE member.active AND queue.attempts<8 AND ((queue.status IN ('queued','failed') AND queue.next_attempt_at<=NOW()) OR (queue.status='sending' AND queue.lease_expires_at<NOW()))
        ORDER BY queue.created_at,queue.id FOR UPDATE OF queue SKIP LOCKED LIMIT 1`)
    ).rows[0];
    if (row)
      await client.query(
        "UPDATE recall_email_outbox SET status='sending',attempts=attempts+1,lease_token=$2,lease_expires_at=NOW()+INTERVAL '5 minutes' WHERE id=$1",
        [row.id, lease],
      );
    await client.query('COMMIT');
    return row;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
export async function finishRecallEmail(
  row: RecallEmailRow,
  lease: string,
  status: 'sent' | 'suppressed' | 'failed',
) {
  await query(
    `UPDATE recall_email_outbox SET status=CASE WHEN $3='failed' AND attempts>=8 THEN 'failed_terminal' ELSE $3 END,
      last_error=CASE WHEN $3='failed' THEN 'SMTP_SUBMISSION_FAILED' ELSE NULL END,exhausted_at=CASE WHEN $3='failed' AND attempts>=8 THEN NOW() ELSE NULL END,sent_at=CASE WHEN $3='sent' THEN NOW() ELSE sent_at END,
      next_attempt_at=NOW()+make_interval(secs=>LEAST(3600,60*attempts)),lease_token=NULL,lease_expires_at=NULL
      WHERE id=$1 AND lease_token=$2 AND status='sending'`,
    [row.id, lease, status],
  );
}
