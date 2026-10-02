import {getClient,pool} from '../src/db';
import {reconcileRecallSafety} from '../src/modules/recall/reconciliation';
async function run() {
  const client=await getClient();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const report=await reconcileRecallSafety(client);
    await client.query('COMMIT');
    console.log(JSON.stringify(report,null,2));
    if(!report.ok) process.exitCode=1;
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();}
}
run().catch(error=>{console.error('Recall safety check failed:',error instanceof Error?error.message:error);process.exitCode=1;}).finally(()=>pool.end());
