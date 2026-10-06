import { approveRecovery } from '../src/modules/mfa/recovery';
import { pool } from '../src/db';
// Tokens are secret stdin input, never CLI arguments or persisted artifacts.
(async()=>{
  let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>16000)throw new Error('Input too large');}
  const data=JSON.parse(input) as {targetUserId:string;reviewerTokens:[string,string];ticket:string};
  if(!/^[0-9a-f-]{36}$/i.test(data.targetUserId)||!Array.isArray(data.reviewerTokens)||data.reviewerTokens.length!==2||data.reviewerTokens.some(token=>typeof token!=='string'))throw new Error('Invalid recovery request');
  await approveRecovery(data.targetUserId,data.reviewerTokens,data.ticket);
  console.log('Reviewed recovery approved for 30 minutes. Sessions and old keys revoked. Access suspension remains unchanged.');
})().catch(()=>{console.error('Recovery was not approved. Check reviewer assurance and review ticket.');process.exitCode=1;}).finally(()=>pool.end());
