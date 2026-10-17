import { claimRecallEmail, finishRecallEmail, type RecallEmailRow } from './notificationRepository';
import crypto from 'node:crypto';
import { getClient } from '../../db';
import { config } from '../../config/env';
import { emailSender, EmailSender } from '../../services/emailSender';
import logger from '../../logger';

export {
  persistRecallParticipants as registerRecallParticipants,
  queueRecallEmails,
} from './notificationRepository';
// Durable, leased and retryable. SMTP acceptance is not proof of inbox delivery;
// acknowledgements are a separate participant decision. No raw email is logged.
export async function processRecallEmails(sender: EmailSender = emailSender(), limit = 20) {
  const totals = { sent: 0, suppressed: 0, failed: 0 };
  for (let i = 0; i < limit; i++) {
    const client = await getClient();
    let row: RecallEmailRow | undefined;
    const lease = crypto.randomUUID();
    try {
      row = await claimRecallEmail(client, lease);
    } finally {
      client.release();
    }
    if (!row) break;
    let status: 'sent' | 'suppressed' | 'failed';
    try {
      status = (
        await sender.send({
          to: row.email,
          category: 'recall',
          subject: `BetterTrade recall ${row.event_type}: ${String(row.reference_code).replace(/[\r\n]/g, ' ')}`,
          text: `${row.title}\n\nReference: ${row.reference_code}\nCurrent status: ${row.recall_status}\nInstructions: ${row.instructions}\n\nSign in to review the notice and acknowledge your organization's response:\n${new URL('/recalls', config.publicWebUrl).toString()}\n\nA resolved notice does not automatically release retained stock or republish listings.`,
        })
      ).status;
    } catch {
      status = 'failed';
      logger.error(
        { notificationId: row.id },
        'Recall email submission failed; queued retry retained',
      );
    }
    await finishRecallEmail(row, lease, status);
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
      logger.error('Recall email worker failed; durable queue retained');
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
