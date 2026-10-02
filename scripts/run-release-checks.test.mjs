import test from 'node:test';
import assert from 'node:assert/strict';
import {runReleaseChecks} from './run-release-checks.mjs';
const plan=[['first',['first']],['second',['second']],['third',['third']]];
test('a failed gate stops execution and cannot count later checks as passing',()=>{
 const invoked=[];
 const result=runReleaseChecks(args=>{invoked.push(args[0]);return args[0]==='second'?1:0;},plan);
 assert.equal(result.status,'failed');assert.deepEqual(invoked,['first','second']);
 assert.deepEqual(result.checks.map(check=>check.status),['passed','failed','not_run']);
});
test('a launch error fails the release and prevents later checks',()=>{
 const result=runReleaseChecks(()=>{throw new Error('Cannot spawn');},plan);
 assert.equal(result.status,'failed');assert.deepEqual(result.checks.map(check=>check.status),['failed','not_run','not_run']);
});
test('all gates must execute successfully to report a passed release',()=>{
 let count=0;const result=runReleaseChecks(()=>{count++;return 0;},plan);
 assert.equal(count,3);assert.equal(result.status,'passed');assert.ok(result.checks.every(check=>check.status==='passed'));
});
