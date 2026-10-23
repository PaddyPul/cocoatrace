import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

test('local rehearsal overlay keeps captured email internal and disables external sending configuration', () => {
  const overlay = fs.readFileSync('docker-compose.demo-rehearsal.yml', 'utf8');
  assert.match(overlay, /127\.0\.0\.1:18026:8025/);
  assert.ok(!overlay.includes(':1025"'));
  assert.match(overlay, /SMTP_HOST: mailpit/);
  assert.match(overlay, /EMAIL_FROM: demo@bettertrade\.test/);
  assert.ok(!overlay.includes('MP_SMTP_RELAY'));
  const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.ok(workflow.includes('npm run demo:rehearsal:start'));
});

test(
  'invalid stored rehearsal key stops before starting services',
  { skip: process.platform === 'win32' },
  () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'email-rehearsal-'));
    try {
      fs.mkdirSync(path.join(dir, 'scripts'));
      fs.mkdirSync(path.join(dir, '.demo-preview'));
      fs.copyFileSync('scripts/demo-preview.mjs', path.join(dir, 'scripts/demo-preview.mjs'));
      fs.writeFileSync(
        path.join(dir, '.demo-preview/environment.json'),
        JSON.stringify({
          PREVIEW_DB_PASSWORD: 'a'.repeat(64),
          PREVIEW_JWT_SECRET: 'b'.repeat(64),
          PREVIEW_UPLOAD_SECRET: 'c'.repeat(64),
          PREVIEW_WEB_URL: 'http://127.0.0.1:14000',
          PREVIEW_COOKIE_SECURE: 'false',
          PREVIEW_REHEARSAL_INVITATION_KEY: 'invalid',
        }),
      );
      const log = path.join(dir, 'docker-calls');
      fs.writeFileSync(
        path.join(dir, 'docker'),
        '#!/usr/bin/env node\nrequire("node:fs").writeFileSync(process.env.REHEARSAL_DOCKER_LOG,"called");',
      );
      fs.chmodSync(path.join(dir, 'docker'), 0o755);
      const result = spawnSync(process.execPath, ['scripts/demo-preview.mjs', 'rehearse'], {
        cwd: dir,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: dir + path.delimiter + process.env.PATH,
          REHEARSAL_DOCKER_LOG: log,
        },
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Invalid local rehearsal key/);
      assert.equal(fs.existsSync(log), false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

test('reset without the exact confirmation cannot start Docker or read preview state', () => {
  const result = spawnSync(process.execPath, ['scripts/demo-preview.mjs', 'reset-rehearsal'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DELETE_SYNTHETIC_PREVIEW/);
  assert.doesNotMatch(result.stderr, /Cannot launch Docker|Start the preview first/);
});

test(
  'reset preflight failure never removes volumes',
  { skip: process.platform === 'win32' },
  () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-reset-refusal-'));
    try {
      fs.mkdirSync(path.join(dir, 'scripts'));
      fs.mkdirSync(path.join(dir, '.demo-preview'));
      fs.copyFileSync('scripts/demo-preview.mjs', path.join(dir, 'scripts/demo-preview.mjs'));
      fs.writeFileSync(
        path.join(dir, '.demo-preview/environment.json'),
        JSON.stringify({
          PREVIEW_DB_PASSWORD: 'a'.repeat(64),
          PREVIEW_JWT_SECRET: 'b'.repeat(64),
          PREVIEW_UPLOAD_SECRET: 'c'.repeat(64),
          PREVIEW_WEB_URL: 'http://127.0.0.1:14000',
          PREVIEW_COOKIE_SECURE: 'false',
        }),
      );
      const log = path.join(dir, 'calls.jsonl');
      fs.writeFileSync(
        path.join(dir, 'docker'),
        '#!/bin/sh\nprintf "%s\\n" "$*" >> "$PREVIEW_RESET_CALLS"\ncase "$*" in *api/scripts/check-demo-preview-reset.ts*) exit 7;; esac\n',
      );
      fs.chmodSync(path.join(dir, 'docker'), 0o755);
      const result = spawnSync(
        process.execPath,
        ['scripts/demo-preview.mjs', 'reset-rehearsal', 'DELETE_SYNTHETIC_PREVIEW'],
        {
          cwd: dir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: dir + path.delimiter + process.env.PATH,
            PREVIEW_RESET_CALLS: log,
          },
        },
      );
      assert.equal(result.status, 1);
      assert.ok(fs.existsSync(log), result.stderr);
      const calls = fs.readFileSync(log, 'utf8').trim().split('\n');
      assert.ok(calls.some((a) => a.includes('api/scripts/check-demo-preview-reset.ts')));
      assert.ok(calls.every((a) => a.includes('cocoatrace-demo-preview')));
      assert.ok(
        calls.every((a) => !a.includes('down') && !a.includes('--volumes') && !a.includes('up')),
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);
