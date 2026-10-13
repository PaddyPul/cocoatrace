import { pool, query } from '../src/db';
import { jobErrorCode, statusHealthy } from '../src/modules/operations/jobs';

async function run() {
  const result = await query(
    'SELECT job_name,status,started_at,finished_at,last_success_at,error_code,consecutive_failures,runs FROM operations_job_status ORDER BY job_name',
  );
  const healthy = statusHealthy(result.rows);
  console.log(
    JSON.stringify({ status: healthy ? 'passed' : 'failed', jobs: result.rows }, null, 2),
  );
  process.exitCode = healthy ? 0 : 1;
}
void run()
  .catch((error: unknown) => {
    console.error(JSON.stringify({ status: 'failed', code: jobErrorCode(error) }));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
