import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { controllerViolations, checkControllerBoundaries } from './controller-boundaries.mjs';

test('rejects database imports, aliased access, query calls and inline SQL without executing code', () => {
  for (const source of [
    "import { query as read } from '../db'; read('opaque');",
    "import { Pool } from 'pg';",
    "const read = require('../db');",
    "client.query('opaque');",
    "export * from '../db';",
    "const db = import('../db');",
    'const sql = `WITH scoped AS (SELECT ${projection} FROM records) SELECT * FROM scoped`;',
    'getClient();',
    'const sql = `SELECT id FROM records`;',
    "const sql = 'UPDATE records SET active=false';",
  ])
    assert.ok(controllerViolations(source).length, source);
});
test('allows HTTP mapping, query parameters and feature use cases; ignores SQL in comments', () => {
  assert.deepEqual(
    controllerViolations(
      "import { list } from '../modules/catalog/records'; // SELECT example\nexport const read = async (req,res) => res.json(await list(req.user, req.query));",
    ),
    [],
  );
});
test('checks every current controller recursively including public product adapters', () => {
  assert.ok(checkControllerBoundaries(fileURLToPath(new URL('../', import.meta.url))) > 20);
});
