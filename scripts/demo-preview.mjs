import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(root,'.demo-preview');
const stateFile=path.join(directory,'environment.json');
export function validateEmails(value) {
 const emails=String(value||'').split(',').map(v=>v.trim().toLowerCase());
 if(!emails.length||emails.length>10||emails.some(v=>v.length>254||! /^[a-z0-9.!#$%&'+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(v)||v.includes('*')))
  throw new Error('Supply 1–10 exact email addresses separated by commas; wildcard domains are not allowed.');
 return [...new Set(emails)].join(',');
}
export function sharingEmails(args) {
 const flag=args.indexOf('--emails');
 // Some Windows npm versions consume the unknown flag and forward only its value.
 if(flag>=0) {
  if(args.length!==2||flag!==0) throw new Error('Supply one --emails value');
  return validateEmails(args[1]);
 }
 if(args.length===1) return validateEmails(args[0]);
 throw new Error('Supply one comma-separated email list');
}
export function parseTunnelUrl(log) {
 const found=String(log).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/g);
 return found?.at(-1)||null;
}
export function validateState(state) {
 for(const name of ['PREVIEW_DB_PASSWORD','PREVIEW_JWT_SECRET','PREVIEW_UPLOAD_SECRET']) {
  if(!/^[a-f0-9]{64}$/.test(state[name]||'')) throw new Error('Invalid preview state. Do not replace secrets manually.');
 }
 if(new Set(['PREVIEW_DB_PASSWORD','PREVIEW_JWT_SECRET','PREVIEW_UPLOAD_SECRET'].map(name=>state[name])).size!==3)
  throw new Error('Preview secrets must be independent');
 if(state.PREVIEW_WEB_URL!=='http://127.0.0.1:14000'&&parseTunnelUrl(state.PREVIEW_WEB_URL)!==state.PREVIEW_WEB_URL)
  throw new Error('Unexpected preview hostname');
 if(!['true','false'].includes(state.PREVIEW_COOKIE_SECURE)) throw new Error('Invalid cookie setting');
 if(state.PREVIEW_ALLOWED_EMAILS) validateEmails(state.PREVIEW_ALLOWED_EMAILS);
 return state;
}
function save(state) {validateState(state);fs.mkdirSync(directory,{recursive:true,mode:0o700});fs.writeFileSync(stateFile,JSON.stringify(state,null,2),{mode:0o600});}
function load(create=false) {
 if(fs.existsSync(stateFile)) return validateState(JSON.parse(fs.readFileSync(stateFile,'utf8')));
 if(!create) throw new Error('Start the preview first: npm run demo:preview:start');
 const state=Object.fromEntries(['PREVIEW_DB_PASSWORD','PREVIEW_JWT_SECRET','PREVIEW_UPLOAD_SECRET'].map(name=>[name,crypto.randomBytes(32).toString('hex')]));
 Object.assign(state,{PREVIEW_WEB_URL:'http://127.0.0.1:14000',PREVIEW_COOKIE_SECURE:'false'});save(state);return state;
}
const docker=process.platform==='win32'?'docker.exe':'docker';
function run(args,state,capture=false) {
 const result=spawnSync(docker,args,{cwd:root,env:{...process.env,...state},stdio:capture?'pipe':'inherit',encoding:'utf8'});
 if(result.error) throw new Error('Cannot launch Docker. Start Docker Desktop.');
 if(result.status!==0) throw new Error(`Docker command failed (exit ${result.status}); no public URL is approved for sharing.`);
 return (result.stdout||'')+(result.stderr||'');
}
function compose(args,state,capture=false) {
 // Never reads the developer's .env or base application Compose project.
 return run(['compose','--env-file',path.join(root,'scripts/preview-empty.env'),'-p','cocoatrace-demo-preview','-f',path.join(root,'docker-compose.demo-preview.yml'),'--profile','share',...args],state,capture);
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function smoke() {
 const base='http://127.0.0.1:14000';
 const ready=await fetch(`${base}/api/health/ready`,{signal:AbortSignal.timeout(15000)});
 if(!ready.ok) throw new Error('Preview readiness failed (database, private storage or malware scanner)');
 const page=await fetch(base,{signal:AbortSignal.timeout(15000)});
 if(!page.ok||!(await page.text()).includes('id="root"')) throw new Error('Preview frontend failed');
 for(const email of ['newbuyer@cocoatrace.io','newsupplier@cocoatrace.io']) {
  const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'Password123!'}),signal:AbortSignal.timeout(15000)});
  if(!login.ok) throw new Error(`Synthetic ${email} login failed`);
  const payload=await login.json();
  const me=await fetch(`${base}/api/me`,{headers:{Authorization:`Bearer ${payload.accessToken}`},signal:AbortSignal.timeout(15000)});
  if(!me.ok) throw new Error('Preview authenticated identity check failed');
  const logout=await fetch(`${base}/api/auth/logout`,{method:'POST',headers:{Authorization:`Bearer ${payload.accessToken}`},signal:AbortSignal.timeout(15000)});
  if(!logout.ok) throw new Error('Synthetic session cleanup failed');
 }
 console.log('PASS: local preview readiness, frontend and synthetic buyer/supplier identity checks');
}
export function isEmailGate(status,location,body) {
 if([401,403].includes(status)) return true;
 if(status>=300&&status<400&&location) {
  try {const url=new URL(location);return url.protocol==='https:'&&(url.hostname.endsWith('.cloudflareaccess.com')||url.pathname.startsWith('/cdn-cgi/access/'));}catch{return false;}
 }
 return status===200&&!body.includes('id="root"')&&/cloudflare/i.test(body)&&/one.time|verification code|email/i.test(body);
}
async function verifyEmailGate(url) {
 const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000)});
 const body=(await response.text()).slice(0,100000);
 if(!isEmailGate(response.status,response.headers.get('location'),body))
  throw new Error('Could not prove unauthenticated requests are denied or reach the email gate; stopping public sharing');
}
async function main() {
 const action=process.argv[2];
 if(!['start','share','stop','status','check'].includes(action)) throw new Error('Use demo:preview:start|share|stop|status|check');
 const state=load(action==='start');
 if(action==='stop') {compose(['down','--remove-orphans'],state);console.log('Preview and tunnel stopped; synthetic data retained.');return;}
 if(action==='status') {compose(['ps'],state);console.log('Configured workspace:',state.PREVIEW_WEB_URL);return;}
 if(action==='check') {await smoke();return;}
 if(action==='start') {
  compose(['stop','tunnel'],state);
  state.PREVIEW_WEB_URL='http://127.0.0.1:14000';state.PREVIEW_COOKIE_SECURE='false';delete state.PREVIEW_ALLOWED_EMAILS;save(state);
  compose(['up','-d','--build','--wait','postgres','clamav','api','web'],state);
  await smoke();console.log('Open http://127.0.0.1:14000 — synthetic demo only; nothing is publicly shared.');return;
 }
 state.PREVIEW_ALLOWED_EMAILS=sharingEmails(process.argv.slice(3));
 compose(['stop','tunnel'],state);
 compose(['rm','-f','tunnel'],state);
 // Fail closed when the downloaded version lacks the documented email gate.
 const help=run(['run','--rm','cloudflare/cloudflared:latest','tunnel','--help'],state,true);
 if(!help.includes('--allowed-mail')) throw new Error('This cloudflared image lacks the required --allowed-mail gate. Local preview remains available; no tunnel was started.');
 const interrupt=()=>{try {compose(['stop','tunnel'],state);console.log('Public sharing stopped.');}catch(error){console.error(error.message);process.exitCode=1;}process.exit(process.exitCode||0);};
 process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
 try {
  compose(['up','-d','--wait','tunnel'],state);
  let url;
  for(let attempt=0;attempt<30&&!url;attempt++) {url=parseTunnelUrl(compose(['logs','--no-color','--tail','100','tunnel'],state,true));if(!url) await pause(2000);}
  if(!url) throw new Error('Temporary HTTPS URL was not issued');
  state.PREVIEW_WEB_URL=url;state.PREVIEW_COOKIE_SECURE='true';save(state);
  compose(['up','-d','--wait','api','web'],state);
  await smoke();
  await verifyEmailGate(url);
  console.log(`Email-restricted synthetic demo: ${url}`);
  console.log('Allowed visitors:',state.PREVIEW_ALLOWED_EMAILS);
  console.log('Keep this terminal and PC running. Ctrl+C stops sharing. Automatic stop after two hours. No real data, money or outgoing app email.');
  setTimeout(interrupt,2*60*60*1000);
  await new Promise(()=>{});
 } finally {process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);compose(['stop','tunnel'],state);console.log('Public sharing stopped.');}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
