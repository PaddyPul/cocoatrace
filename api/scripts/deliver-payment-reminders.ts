import { pool, query } from '../src/db';
import { enqueueOverdueReminders, processPaymentReminderEmails } from '../src/modules/payments/reminders';

async function run() {
  const queued = await enqueueOverdueReminders();
  const delivery = await processPaymentReminderEmails();
  const terminalFailures = Number((await query("SELECT COUNT(*)::int n FROM payment_reminder_email_outbox WHERE status='failed_terminal'")).rows[0].n);
  console.log(JSON.stringify({ ...queued, ...delivery, terminalFailures }, null, 2));
  if (delivery.failed || terminalFailures) process.exitCode = 1;
}
run().catch(() => { console.error('Payment reminder processing failed; inspect redacted API logs.'); process.exitCode = 1; }).finally(() => pool.end());
