import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// Exercise the real runners without starting containers. Linux CI supplies the
// fake executable; Windows still exercises the existing release runner tests.
function exercise(script, failBuild) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'compose-compat-'));
 try {
  const log=path.join(dir,'calls.jsonl');
  fs.writeFileSync(path.join(dir,'docker'), `#!/usr/bin/env node\nconst fs=require('node:fs');const a=process.argv.slice(2);fs.appendFileSync(process.env.COMPOSE_TEST_LOG,JSON.stringify(a)+'\\n');if(a.includes('run')&&a.includes('--build'))process.exit(99);if(process.env.COMPOSE_TEST_FAIL_BUILD==='1'&&a.includes('build'))process.exit(7);`);
  fs.chmodSync(path.join(dir,'docker'),0o755);
  const result=spawnSync(process.execPath,[script],{encoding:'utf8',env:{...process.env,PATH:dir+path.delimiter+process.env.PATH,COMPOSE_TEST_LOG:log,COMPOSE_TEST_FAIL_BUILD:failBuild?'1':'0'}});
  const calls=fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse);
  return {result,calls};
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
}
test('migration runner builds separately before run, then cleans its isolated project',{skip:process.platform==='win32'},()=>{
 const {result,calls}=exercise('scripts/run-migration-tests.mjs',false);
 assert.equal(result.status,0,result.stderr);
 assert.deepEqual(calls.map(a=>a[5]),['down','up','build','run','down']);
 assert.ok(calls.every(a=>!(a.includes('run')&&a.includes('--build'))));
 assert.ok(calls.every(a=>a.includes('cocoatrace-migration-tests')));
});
for(const script of ['scripts/run-migration-tests.mjs','scripts/run-recovery-tests.mjs']) {
 test(`${script} stops on build failure and cleans only its test project`,{skip:process.platform==='win32'},()=>{
  const {result,calls}=exercise(script,true);
  assert.equal(result.status,1);
  assert.ok(calls.some(a=>a.includes('build')));
  assert.ok(calls.every(a=>!a.includes('run')));
  assert.equal(calls.at(-1)[5],'down');
 });
}
