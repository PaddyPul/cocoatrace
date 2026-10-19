import test from 'node:test';
import assert from 'node:assert/strict';
import { statusPresentation } from '../web/src/components/shared/statusPresentation.ts';

test('completion is scoped to the recorded business domain', () => {
  assert.equal(statusPresentation('accepted', 'trade').tone, 'amber');
  assert.equal(statusPresentation('delivered', 'trade').tone, 'amber');
  assert.equal(statusPresentation('settled', 'trade').tone, 'green');
  assert.equal(statusPresentation('accepted', 'transport').tone, 'amber');
  assert.equal(statusPresentation('delivered', 'transport').tone, 'green');
  assert.equal(statusPresentation('paid', 'payment').tone, 'green');
  assert.equal(statusPresentation('paid', 'trade').tone, 'gray');
});

test('pending payment and physical transport milestones have consistent caution tones', () => {
  for (const value of ['due', 'payment_submitted', 'partially_paid']) {
    assert.equal(statusPresentation(value, 'payment').tone, 'amber');
  }
  for (const value of ['picked_up', 'warehouse_received', 'port_received', 'unloaded']) {
    assert.equal(statusPresentation(value, 'transport').tone, 'amber');
  }
  assert.equal(statusPresentation('agreed', 'terms').tone, 'green');
  assert.equal(statusPresentation('proposed', 'terms').tone, 'amber');
});

test('missing and unrecognized statuses stay explicit and neutral', () => {
  assert.deepEqual(statusPresentation(undefined, 'trade'), { label: 'Unknown', tone: 'gray' });
  assert.deepEqual(statusPresentation('provider_pending', 'payment'), {
    label: 'provider pending',
    tone: 'gray',
  });
});
