import { pool, query } from "../src/db";
import { processRecallEmails } from "../src/modules/recall/notifications";
async function run() {
  const result = await processRecallEmails();
  const terminalFailures = Number(
    (
      await query(
        "SELECT COUNT(*)::int AS count FROM recall_email_outbox WHERE status='failed_terminal'",
      )
    ).rows[0].count,
  );
  console.log(JSON.stringify({ ...result, terminalFailures }, null, 2));
  if (result.failed || terminalFailures) process.exitCode = 1;
}
run()
  .catch((error) => {
    console.error("Recall notification processing failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
