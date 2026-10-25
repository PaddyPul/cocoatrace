import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { closeout, validatePlan } from './sonar-closeout.mjs';

const plan = JSON.parse(fs.readFileSync('docs/quality/sonar-closeout-2026-10-25.json', 'utf8'));
function fixture(options = {}) {
  const calls = [];
  const issues = new Map(
    plan.issues.map((item) => [
      item.id,
      {
        key: item.id,
        rule: item.rule,
        component: `${plan.project}:${item.path}`,
        issueStatus:
          item.disposition === 'SOURCE_FIX'
            ? 'FIXED'
            : options.reviewed
              ? item.disposition
              : 'OPEN',
        updateDate: 'review-snapshot',
        comments: [],
      },
    ]),
  );
  const reads = new Map();
  const request = async (method, endpoint, values) => {
    calls.push({ method, endpoint, values });
    if (method === 'GET') {
      const item = structuredClone(issues.get(values.issues));
      const count = (reads.get(item.key) || 0) + 1;
      reads.set(item.key, count);
      if (options.badIdentity && item.key === plan.issues.at(-1).id)
        item.component = 'unrelated:secret';
      if (options.concurrent && count === 2) item.updateDate = 'concurrent-review';
      return { issues: [item] };
    }
    if (options.fail === endpoint) throw new Error('Simulated unknown write outcome');
    const item = issues.get(values.issue);
    if (endpoint === 'issues/add_comment') {
      item.comments.push({ markdown: values.text });
      return { issue: item };
    }
    item.issueStatus = values.transition === 'accept' ? 'ACCEPTED' : 'FALSE_POSITIVE';
    return { issue: structuredClone(item) };
  };
  return { calls, request, issues };
}

test('47-item review manifest preserves exact source scope and individual decisions', () => {
  validatePlan(plan, (file) => fs.readFileSync(file));
  validatePlan(plan, (file) => fs.readFileSync(file, 'utf8').replace(/\r?\n/g, '\r\n'));
  const wrong = structuredClone(plan);
  wrong.issues[0].path = '../outside';
  assert.throws(() => validatePlan(wrong), /Invalid/);
  assert.throws(() => validatePlan(plan, () => Buffer.from('changed')), /source changed/);
  const duplicate = structuredClone(plan);
  duplicate.issues[1].id = duplicate.issues[0].id;
  assert.throws(() => validatePlan(duplicate), /Invalid/);
});
test('default live preflight reads all 47 identities and never writes', async () => {
  const api = fixture();
  const records = [];
  await closeout(plan, { request: api.request, record: (row) => records.push(row) });
  assert.equal(api.calls.length, 47);
  assert.ok(api.calls.every((call) => call.method === 'GET'));
  assert.equal(records.filter((row) => row.status === 'PLANNED').length, 46);
  assert.equal(records.filter((row) => row.status === 'FIXED_BY_SCAN').length, 1);
});
test('a mismatched issue anywhere prevents every write', async () => {
  const api = fixture({ badIdentity: true });
  await assert.rejects(closeout(plan, { request: api.request, apply: true }), /identity changed/);
  assert.ok(api.calls.every((call) => call.method === 'GET'));
});
test('apply comments each decision then records 35 false positives and 11 accepted risks without resolving the source fix', async () => {
  const api = fixture();
  await closeout(plan, { request: api.request, apply: true });
  const writes = api.calls.filter((call) => call.method === 'POST');
  assert.equal(writes.length, 92);
  for (let index = 0; index < writes.length; index += 2) {
    assert.equal(writes[index].endpoint, 'issues/add_comment');
    assert.equal(writes[index + 1].endpoint, 'issues/do_transition');
    assert.equal(writes[index].values.issue, writes[index + 1].values.issue);
  }
  assert.equal(writes.filter((call) => call.values.transition === 'falsepositive').length, 35);
  assert.equal(writes.filter((call) => call.values.transition === 'accept').length, 11);
});
test('already reviewed issues are read but never receive duplicate comments or transitions', async () => {
  const api = fixture({ reviewed: true });
  await closeout(plan, { request: api.request, apply: true });
  assert.ok(api.calls.every((call) => call.method === 'GET'));
});
test('concurrent review stops before adding a comment', async () => {
  const api = fixture({ concurrent: true });
  await assert.rejects(closeout(plan, { request: api.request, apply: true }), /after preflight/);
  assert.ok(api.calls.every((call) => call.method === 'GET'));
});
for (const endpoint of ['issues/add_comment', 'issues/do_transition']) {
  test(`unknown ${endpoint} outcome stops without replay or subsequent issue writes`, async () => {
    const api = fixture({ fail: endpoint });
    await assert.rejects(
      closeout(plan, { request: api.request, apply: true }),
      /unknown write outcome/,
    );
    assert.equal(api.calls.filter((call) => call.endpoint === endpoint).length, 1);
    assert.ok(
      api.calls
        .filter((call) => call.method === 'POST')
        .every((call) => call.values.issue === plan.issues[0].id),
    );
  });
}
