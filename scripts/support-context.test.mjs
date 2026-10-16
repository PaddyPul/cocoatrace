import test from 'node:test';
import assert from 'node:assert/strict';
import { supportLink } from '../web/src/domains/support/context.ts';
test('support context copies only a workflow enum and exact record UUID', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(
    supportLink('contract', `/contracts/${id}`),
    `/support?context=agreement&entityId=${id}`,
  );
  assert.equal(
    supportLink('marketplace', '/marketplace?token=secret'),
    '/support?context=marketplace',
  );
  assert.equal(
    supportLink('unknown-secret', 'https://host/?password=secret'),
    '/support?context=other',
  );
  assert.equal(
    supportLink('evidence', '/evidence/private-secret.pdf'),
    '/support?context=evidence',
  );
  assert.equal(supportLink('contract', `/contracts/${id}/secret`), '/support?context=agreement');
});
