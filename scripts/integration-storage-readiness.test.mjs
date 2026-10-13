import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { stressEnvironment, requireStressPorts } from './run-evidence-stress.mjs';
function probe(endpoint) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'api/scripts/check-integration-storage.ts'],
      {
        env: {
          ...process.env,
          ...stressEnvironment(requireStressPorts()),
          EVIDENCE_STORAGE_ENDPOINT: endpoint,
          EVIDENCE_STORAGE_BUCKET: 'cocoatrace-test-evidence',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.once('error', reject);
    child.once('exit', (status) => resolve({ status, output }));
  });
}
test('readiness exercises real adapter promotion and removes all disposable bytes', async () => {
  const objects = new Map();
  let requests = 0;
  const server = http.createServer(async (req, res) => {
    requests++;
    const key = req.url;
    const bucket = key === '/cocoatrace-test-evidence';
    if (req.method === 'PUT') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      if (!bucket) objects.set(key, Buffer.concat(chunks));
      res.end();
      return;
    }
    if (req.method === 'DELETE') {
      objects.delete(key);
      res.writeHead(204);
      res.end();
      return;
    }
    const bytes = objects.get(key);
    if (!bytes) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader('Content-Length', bytes.length);
    res.end(req.method === 'HEAD' ? undefined : bytes);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await probe(`http://127.0.0.1:${server.address().port}`);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /"status":"passed"/);
    assert.equal(objects.size, 0);
    assert.ok(requests >= 10);
    const before = requests;
    const refused = await probe('http://example.invalid');
    assert.equal(refused.status, 1);
    assert.match(refused.output, /INTEGRATION_STORAGE_GUARD_FAILED/);
    assert.equal(requests, before);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
