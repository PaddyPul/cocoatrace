import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const source = fileURLToPath(new URL('../api/scripts/stamp-build-metadata.mjs', import.meta.url));
function build(sha, verify) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bettertrade-build-stamp-'));
  try {
    const scripts = path.join(base, 'api/scripts');
    fs.mkdirSync(scripts, { recursive: true });
    const executable = path.join(scripts, 'stamp-build-metadata.mjs');
    fs.copyFileSync(source, executable);
    const env = { ...process.env };
    if (sha === undefined) delete env.BUILD_GIT_SHA;
    else env.BUILD_GIT_SHA = sha;
    const started = Date.now();
    const result = spawnSync(process.execPath, [executable], { env, encoding: 'utf8' });
    verify(result.status, path.join(base, 'api/dist/build-metadata.json'), started);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
}
test('build artifact preserves supplied full SHA and actual builder time; missing SHA stays unknown', () => {
  for (const sha of ['a'.repeat(40), undefined])
    build(sha, (status, target, started) => {
      assert.equal(status, 0);
      const stamp = JSON.parse(fs.readFileSync(target, 'utf8'));
      assert.equal(stamp.gitSha, sha ?? null);
      assert.equal(stamp.source, 'build-artifact');
      assert.ok(Date.parse(stamp.builtAt) >= started && Date.parse(stamp.builtAt) <= Date.now());
      assert.deepEqual(Object.keys(stamp).sort(), ['builtAt', 'gitSha', 'schemaVersion', 'source']);
    });
});
test('malformed supplied identity fails the build before producing a metadata asset', () => {
  build('branch-main', (status, target) => {
    assert.notEqual(status, 0);
    assert.equal(fs.existsSync(target), false);
  });
});
