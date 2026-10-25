import test from 'node:test';
import assert from 'node:assert/strict';
import { compareOrdinal as apiOrder } from '../api/src/utils/ordinal.ts';
import { compareOrdinal as runnerOrder } from './ordinal-order.mjs';
import { hashObject } from '../api/src/services/audit.ts';

test('canonical ordering is the same across API and runners and never uses locale collation', () => {
  const expected = ['', '0', '10', '2', 'A', 'Z', 'a', 'é', 'Ω', '\ud800', '😀', '\ue000'];
  const original = [...expected].reverse();
  for (const order of [apiOrder, runnerOrder]) {
    assert.deepEqual([...original].sort(order), expected);
    for (const left of expected) {
      assert.equal(order(left, left), 0);
      for (const right of expected)
        assert.equal(Math.sign(order(left, right)) + Math.sign(order(right, left)), 0);
    }
  }
});
test('existing audit hash remains byte-compatible for case, numeric-looking and Unicode keys', () => {
  const data = { é: 1, Z: 2, a: 3, 10: 4, 2: 5, Ω: 6 };
  assert.equal(hashObject(data), 'sha256:ea6d9a20c6b724a7');
});
