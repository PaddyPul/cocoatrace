import test from 'node:test';
import assert from 'node:assert/strict';
import { runReleaseChecks, releaseChecks } from './run-release-checks.mjs';
const plan = [
  ['first', ['first']],
  ['second', ['second']],
  ['third', ['third']],
];
test('a failed gate stops execution and cannot count later checks as passing', () => {
  const invoked = [];
  const result = runReleaseChecks((args) => {
    invoked.push(args[0]);
    return args[0] === 'second' ? 1 : 0;
  }, plan);
  assert.equal(result.status, 'failed');
  assert.deepEqual(invoked, ['first', 'second']);
  assert.deepEqual(
    result.checks.map((check) => check.status),
    ['passed', 'failed', 'not_run'],
  );
});
test('a launch error fails the release and prevents later checks', () => {
  const result = runReleaseChecks(() => {
    throw new Error('Cannot spawn');
  }, plan);
  assert.equal(result.status, 'failed');
  assert.deepEqual(
    result.checks.map((check) => check.status),
    ['failed', 'not_run', 'not_run'],
  );
});
test('all gates must execute successfully to report a passed release', () => {
  let count = 0;
  const result = runReleaseChecks(() => {
    count++;
    return 0;
  }, plan);
  assert.equal(count, 3);
  assert.equal(result.status, 'passed');
  assert.ok(result.checks.every((check) => check.status === 'passed'));
});

test('quality and workspace types gate every release before infrastructure checks', () => {
  assert.deepEqual(
    releaseChecks.slice(0, 2).map((check) => check[1]),
    [
      ['run', 'check:quality'],
      ['run', 'typecheck'],
    ],
  );
});

test('dependency audit is required before application and Docker release checks', () => {
  assert.deepEqual(releaseChecks[2][1], ['run', 'check:dependencies']);
  assert.ok(
    releaseChecks
      .find((check) => check[0] === 'Runner checks')[1]
      .includes('scripts/check-dependencies.test.mjs'),
  );
});

test('image security is required before native migration and browser checks', () => {
  const imageIndex = releaseChecks.findIndex(
    (check) => check[0] === 'Container runtime and vulnerability checks',
  );
  const migrationIndex = releaseChecks.findIndex(
    (check) => check[0] === 'Fresh and upgrade migrations',
  );
  assert.ok(imageIndex >= 0 && imageIndex < migrationIndex);
  assert.deepEqual(releaseChecks[imageIndex][1], ['run', 'check:containers']);
});

test('language regressions gate the release before Docker journeys', () => {
  const languageIndex = releaseChecks.findIndex(
    (check) => check[0] === 'Language foundation tests',
  );
  const browserIndex = releaseChecks.findIndex((check) => check[0] === 'Browser journeys');
  assert.ok(languageIndex >= 0 && languageIndex < browserIndex);
  assert.deepEqual(releaseChecks[languageIndex][1], ['run', 'test:locale']);
});

test('real evidence memory stress is required before browser journeys', () => {
  const stress = releaseChecks.findIndex((check) => check[0] === 'Evidence transfer memory stress');
  const integration = releaseChecks.findIndex(
    (check) => check[0] === 'Database/storage/scanner integration',
  );
  const browser = releaseChecks.findIndex((check) => check[0] === 'Browser journeys');
  assert.ok(stress > integration && stress < browser);
  assert.deepEqual(releaseChecks[stress][1], ['run', 'test:evidence:stress:docker']);
  assert.ok(
    releaseChecks
      .find((check) => check[0] === 'Runner checks')[1]
      .includes('scripts/run-evidence-stress.test.mjs'),
  );
});

test('reviewed authorization entry-point inventory gates application and infrastructure acceptance', () => {
  const gate = releaseChecks.findIndex((check) => check[0] === 'Authorization route register');
  assert.ok(gate >= 0 && gate < releaseChecks.findIndex((check) => check[0] === 'API unit tests'));
  assert.deepEqual(releaseChecks[gate][1], ['run', 'check:authorization']);
});

test('shared frontend transport regressions gate release before application and Docker checks', () => {
  const boundaryIndex = releaseChecks.findIndex((check) => check[0] === 'Frontend HTTP boundaries');
  const unitIndex = releaseChecks.findIndex((check) => check[0] === 'API unit tests');
  assert.ok(boundaryIndex >= 0 && boundaryIndex < unitIndex);
  assert.deepEqual(releaseChecks[boundaryIndex][1], ['run', 'test:web-boundaries']);
});

test('risk register ownership and current rendered evidence are required before runtime release work', () => {
  const risk = releaseChecks.findIndex((check) => check[0] === 'Pilot risk register');
  const api = releaseChecks.findIndex((check) => check[0] === 'API unit tests');
  assert.ok(risk >= 0 && risk < api);
  assert.deepEqual(releaseChecks[risk][1], ['run', 'check:risks']);
});

test('initial JavaScript budget runs after production web build and before infrastructure acceptance', () => {
  const build = releaseChecks.findIndex((check) => check[0] === 'Web build');
  const budget = releaseChecks.findIndex(
    (check) => check[0] === 'Initial frontend JavaScript budget',
  );
  const infra = releaseChecks.findIndex(
    (check) => check[0] === 'Container runtime and vulnerability checks',
  );
  assert.ok(build >= 0 && budget > build && budget < infra);
  assert.deepEqual(releaseChecks[budget][1], ['run', 'check:web-budget']);
});
