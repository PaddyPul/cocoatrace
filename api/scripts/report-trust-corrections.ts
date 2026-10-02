import { getClient, pool } from '../src/db';

async function run(): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const table = await client.query("SELECT to_regclass('public.trust_state_corrections') AS name");
    if (!table.rows[0].name) throw new Error('Apply migration 021 before running the trust correction report');
    const summary = await client.query(`SELECT entity_type,field_name,COUNT(*)::int AS corrected_count
      FROM trust_state_corrections GROUP BY entity_type,field_name ORDER BY entity_type,field_name`);
    const corrections = process.argv.includes('--details') ? (await client.query(`SELECT entity_type,entity_id,field_name,
      previous_value,new_value,reason,corrected_at FROM trust_state_corrections ORDER BY corrected_at,entity_id,field_name`)).rows : undefined;
    await client.query('COMMIT');
    console.log(JSON.stringify({report:'trust_state_corrections',correctionCount:summary.rows.reduce((sum,row) => sum+row.corrected_count,0),summary:summary.rows,...(corrections ? {corrections} : {})},null,2));
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
run().catch(error => {console.error('Trust report failed:',error instanceof Error ? error.message : error);process.exitCode=1;}).finally(() => pool.end());
