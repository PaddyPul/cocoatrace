import test from 'node:test';
import assert from 'node:assert/strict';
import {runReleaseChecks, releaseChecks} from './run-release-checks.mjs';
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

test('quality and workspace types gate every release before infrastructure checks',()=>{
 assert.deepEqual(releaseChecks.slice(0,2).map(check=>check[1]),[['run','check:quality'],['run','typecheck']]);
});

test('dependency audit is required before application and Docker release checks',()=>{
 assert.deepEqual(releaseChecks[2][1],['run','check:dependencies']);
 assert.ok(releaseChecks.find(check=>check[0]==='Runner checks')[1].includes('scripts/check-dependencies.test.mjs'));
});

test('image security is required before native migration and browser checks',()=>{
 const imageIndex=releaseChecks.findIndex(check=>check[0]==='Container runtime and vulnerability checks');
 const migrationIndex=releaseChecks.findIndex(check=>check[0]==='Fresh and upgrade migrations');
 assert.ok(imageIndex>=0 && imageIndex<migrationIndex);
 assert.deepEqual(releaseChecks[imageIndex][1],['run','check:containers']);
});


test('language regressions gate the release before Docker journeys',()=>{
 const languageIndex=releaseChecks.findIndex(check=>check[0]==='Language foundation tests');
 const browserIndex=releaseChecks.findIndex(check=>check[0]==='Browser journeys');
 assert.ok(languageIndex>=0 && languageIndex<browserIndex);
 assert.deepEqual(releaseChecks[languageIndex][1],['run','test:locale']);
});
