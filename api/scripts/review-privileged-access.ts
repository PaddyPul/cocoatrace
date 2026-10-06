import { decidePrivilegedAccess } from '../src/modules/accessControls/privilegedLifecycle';
import { pool } from '../src/db';
// Operator-only JSON on stdin. Never put reviewer session secrets in CLI arguments or logs.
(async()=>{
  let input='';
  for await(const chunk of process.stdin){input+=chunk;if(Buffer.byteLength(input)>20000)throw new Error('Input too large');}
  const result=await decidePrivilegedAccess(JSON.parse(input));
  console.log(JSON.stringify(result));
})().catch(()=>{
  console.error('Reviewed access decision failed. Check target, independent reviewers, fresh passkeys and review ticket. No credentials are logged.');
  process.exitCode=1;
}).finally(()=>pool.end());
