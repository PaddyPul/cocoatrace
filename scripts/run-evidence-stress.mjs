import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const stressFileBytes = 10 * 1024 * 1024;
export const stressRssBudgetBytes = 512 * 1024 * 1024;
export function requireStressPorts(environment = {}) {
  const names = [
    'BETTERTRADE_STRESS_DB_PORT',
    'BETTERTRADE_STRESS_STORAGE_PORT',
    'BETTERTRADE_STRESS_SCANNER_PORT',
  ];
  const defaults = [15446, 19012, 13322];
  const ports = names.map((name, index) => {
    const raw = environment[name] ?? String(defaults[index]);
    if (!/^\d{1,5}$/.test(raw) || Number(raw) < 1024 || Number(raw) > 65535)
      throw Error('EVIDENCE_STRESS_PORT_INVALID');
    return Number(raw);
  });
  if (new Set(ports).size !== ports.length) throw Error('EVIDENCE_STRESS_PORT_COLLISION');
  return Object.fromEntries(names.map((name, index) => [name, String(ports[index])]));
}
export function stressEnvironment(ports) {
  return {
    APP_ENV: 'test',
    NODE_ENV: 'test',
    DEMO_MODE: 'false',
    EVIDENCE_STRESS_FIXTURES: 'true',
    DATABASE_URL: `postgresql://stress_test:stress_test@127.0.0.1:${ports.BETTERTRADE_STRESS_DB_PORT}/bettertrade_evidence_stress_test`,
    JWT_SECRET: 'synthetic-stress-jwt-secret-32-characters',
    JWT_REFRESH_SECRET: 'synthetic-stress-refresh-secret-32-characters',
    WEB_URL: 'http://localhost:3000',
    PUBLIC_WEB_URL: 'http://localhost:3000',
    IDENTITY_EMAIL_ENABLED: 'false',
    EVIDENCE_STORAGE_DRIVER: 's3',
    EVIDENCE_STORAGE_ENDPOINT: `http://127.0.0.1:${ports.BETTERTRADE_STRESS_STORAGE_PORT}`,
    EVIDENCE_STORAGE_REGION: 'us-east-1',
    EVIDENCE_STORAGE_BUCKET: 'bettertrade-evidence-stress-test',
    EVIDENCE_STORAGE_ACCESS_KEY: 'synthetic-stress-access',
    EVIDENCE_STORAGE_SECRET_KEY: 'synthetic-stress-secret',
    EVIDENCE_STORAGE_AUTO_CREATE_BUCKET: 'true',
    EVIDENCE_UPLOAD_SIGNING_SECRET: 'synthetic-stress-upload-signing-secret-32-chars',
    EVIDENCE_MAX_FILE_BYTES: String(stressFileBytes),
    EVIDENCE_ORGANIZATION_QUOTA_BYTES: String(512 * 1024 * 1024),
    EVIDENCE_SCANNER_DRIVER: 'clamav',
    EVIDENCE_SCANNER_HOST: '127.0.0.1',
    EVIDENCE_SCANNER_PORT: ports.BETTERTRADE_STRESS_SCANNER_PORT,
    EVIDENCE_SCANNER_TIMEOUT_MS: '30000',
    EVIDENCE_SCANNER_RETRIES: '0',
    EVIDENCE_STORAGE_TIMEOUT_MS: '30000',
    EMAIL_DRIVER: 'development',
    SMTP_HOST: '',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    LOG_LEVEL: 'silent',
  };
}
export function genuinePdf(bytes = stressFileBytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 1024) throw Error('EVIDENCE_STRESS_PDF_SIZE');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 72 72] /Contents 4 0 R >>\nendobj\n',
    '4 0 obj\n<< /Length 4 >>\nstream\nq\nQ\nendstream\nendobj\n',
  ];
  let prefix = '%PDF-1.7\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(prefix));
    prefix += object;
  }
  const xref = `xref\n0 5\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n`;
  let offset = bytes - Buffer.byteLength(xref + '0\n%%EOF\n');
  let footer;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    footer = Buffer.from(`${xref}${offset}\n%%EOF\n`);
    offset = bytes - footer.length;
  }
  footer = Buffer.from(`${xref}${offset}\n%%EOF\n`);
  const result = Buffer.alloc(bytes, 0x20);
  Buffer.from(prefix).copy(result);
  footer.copy(result, offset);
  return result;
}
export function parseSnapshot(message) {
  if (
    !message ||
    message.type !== 'snapshot' ||
    ![
      'id',
      'baselineRssBytes',
      'peakRssBytes',
      'rssBytes',
      'activeTransfers',
      'activeTenants',
    ].every((key) => Number.isSafeInteger(message[key]) && message[key] >= 0) ||
    message.peakRssBytes < message.baselineRssBytes ||
    message.activeTransfers > 4 ||
    message.activeTenants > 4
  )
    throw Error('EVIDENCE_STRESS_IPC_INVALID');
  return {
    id: message.id,
    baselineRssBytes: message.baselineRssBytes,
    peakRssBytes: message.peakRssBytes,
    rssBytes: message.rssBytes,
    activeTransfers: message.activeTransfers,
    activeTenants: message.activeTenants,
  };
}
function ensure(condition, code) {
  if (!condition) throw Error(code);
}
function responseResult(response) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const parts = [];
    response.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 256 * 1024) {
        response.destroy();
        reject(Error('EVIDENCE_STRESS_RESPONSE_LIMIT'));
        return;
      }
      parts.push(chunk);
    });
    response.on('end', () => {
      let body;
      try {
        body = JSON.parse(Buffer.concat(parts).toString('utf8'));
      } catch {
        body = {};
      }
      resolve({ status: response.statusCode, headers: response.headers, body });
    });
    response.on('error', () => reject(Error('EVIDENCE_STRESS_HTTP_RESPONSE_FAILED')));
  });
}
function send(port, method, url, body, token) {
  return new Promise((resolve, reject) => {
    const content = body ? Buffer.from(JSON.stringify(body)) : undefined;
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: url,
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(content
            ? { 'Content-Type': 'application/json', 'Content-Length': content.length }
            : {}),
        },
      },
      (response) => {
        void responseResult(response).then(resolve, reject);
      },
    );
    request.setTimeout(60000, () => request.destroy());
    request.on('error', () => reject(Error('EVIDENCE_STRESS_HTTP_REQUEST_FAILED')));
    request.end(content);
  });
}
function holdUpload(port, url, content) {
  let request;
  const completion = new Promise((resolve, reject) => {
    request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: url,
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf', 'Content-Length': content.length },
      },
      (response) => {
        void responseResult(response).then(resolve, reject);
      },
    );
    request.setTimeout(60000, () => request.destroy());
    request.on('error', () => reject(Error('EVIDENCE_STRESS_UPLOAD_FAILED')));
    request.flushHeaders();
    request.write(content.subarray(0, 1));
  });
  // Attach a handler immediately: admission rejection may arrive before its phase
  // awaits the response, and must never become an unhandled rejection.
  void completion.catch(() => undefined);
  return {
    completion,
    complete: () => request.end(content.subarray(1)),
    abort: () => request.destroy(),
  };
}
function holdDownload(port, id, token) {
  let response, request;
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const completion = new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    let bytes = 0;
    request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: `/evidence/${id}/download`,
        headers: { Authorization: `Bearer ${token}` },
      },
      (incoming) => {
        response = incoming;
        incoming.pause();
        resolveReady(incoming.statusCode);
        incoming.on('data', (chunk) => {
          bytes += chunk.length;
          hash.update(chunk);
          incoming.pause();
          setTimeout(() => incoming.resume(), 2);
        });
        incoming.on('end', () =>
          resolve({ status: incoming.statusCode, bytes, hash: hash.digest('hex') }),
        );
        incoming.on('error', () => reject(Error('EVIDENCE_STRESS_DOWNLOAD_FAILED')));
      },
    );
    request.setTimeout(60000, () => request.destroy());
    request.on('error', () => {
      rejectReady(Error('EVIDENCE_STRESS_DOWNLOAD_FAILED'));
      reject(Error('EVIDENCE_STRESS_DOWNLOAD_FAILED'));
    });
    request.end();
  });
  void completion.catch(() => undefined);
  void ready.catch(() => undefined);
  return {
    ready,
    completion,
    resume: () => response.resume(),
    abort: () => {
      request.destroy();
      response?.destroy();
    },
  };
}
function apiChild(environment) {
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', path.join(root, 'api/scripts/evidence-stress-server.ts')],
    {
      cwd: root,
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    },
  );
  const pending = new Map();
  let id = 0;
  const ready = new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(Error('EVIDENCE_STRESS_API_START_TIMEOUT')), 120000);
    child.on('message', (message) => {
      if (message?.type === 'ready') {
        clearTimeout(deadline);
        resolve(message);
      }
      if (message?.type === 'failed') {
        clearTimeout(deadline);
        reject(
          Error(
            /^EVIDENCE_STRESS_(START_(CONFIG|FIXTURES|STORAGE|SCANNER|APP)|FIXTURE_(DATABASE|MIGRATIONS|ACTORS))$/.test(
              message.code ?? '',
            )
              ? message.code
              : 'EVIDENCE_STRESS_API_START_FAILED',
          ),
        );
      }
      if (message?.type === 'snapshot') {
        const waiter = pending.get(message.id);
        if (waiter) {
          pending.delete(message.id);
          clearTimeout(waiter.timer);
          try {
            waiter.resolve(parseSnapshot(message));
          } catch (error) {
            waiter.reject(error);
          }
        }
      }
    });
    child.once('error', () => {
      clearTimeout(deadline);
      reject(Error('EVIDENCE_STRESS_API_PROCESS_FAILED'));
    });
    child.once('exit', () => {
      clearTimeout(deadline);
      reject(Error('EVIDENCE_STRESS_API_EXITED'));
      for (const waiter of pending.values()) {
        clearTimeout(waiter.timer);
        waiter.reject(Error('EVIDENCE_STRESS_API_EXITED'));
      }
      pending.clear();
    });
  });
  const snapshot = () =>
    new Promise((resolve, reject) => {
      const next = ++id;
      const timer = setTimeout(() => {
        pending.delete(next);
        reject(Error('EVIDENCE_STRESS_IPC_TIMEOUT'));
      }, 3000);
      pending.set(next, { resolve, reject, timer });
      child.send({ type: 'snapshot', id: next });
    });
  return { child, ready, snapshot };
}
async function waitTransfers(api, count) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const snapshot = await api.snapshot();
    if (snapshot.activeTransfers === count) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw Error('EVIDENCE_STRESS_ADMISSION_NOT_OBSERVED');
}
async function exercise(api, ready, report) {
  ensure(
    Number.isInteger(ready.port) && Array.isArray(ready.actors) && ready.actors.length === 2,
    'EVIDENCE_STRESS_READY_INVALID',
  );
  const actors = [];
  for (const fixture of ready.actors) {
    const login = await send(ready.port, 'POST', '/auth/login', {
      email: fixture.email,
      password: fixture.password,
    });
    ensure(
      login.status === 200 && typeof login.body.accessToken === 'string',
      'EVIDENCE_STRESS_LOGIN_FAILED',
    );
    actors.push({ farmId: fixture.farmId, token: login.body.accessToken });
  }
  api.child.send({ type: 'baseline' });
  const baseline = await api.snapshot();
  const content = genuinePdf();
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const sequence = [0, 0, 1, 1, 0];
  const intents = [];
  for (const index of sequence) {
    const intent = await send(
      ready.port,
      'POST',
      '/evidence/upload-intents',
      {
        type: 'stress_pdf',
        fileName: 'synthetic-stress.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: content.length,
        linkedEntityType: 'farm',
        linkedEntityId: actors[index].farmId,
        claimDescription: 'Disposable maximum-size evidence stress fixture.',
      },
      actors[index].token,
    );
    ensure(
      intent.status === 201 && typeof intent.body.uploadUrl === 'string',
      'EVIDENCE_STRESS_INTENT_FAILED',
    );
    intents.push(intent.body.uploadUrl);
  }
  const held = [];
  const downloads = [];
  const phases = report.phases;
  let busyResponses = 0;
  try {
    const uploadStarted = Date.now();
    for (const url of intents.slice(0, 4)) held.push(holdUpload(ready.port, url, content));
    await waitTransfers(api, 4);
    const rejected = holdUpload(ready.port, intents[4], content);
    held.push(rejected);
    const busy = await rejected.completion;
    rejected.abort();
    ensure(
      busy.status === 503 &&
        busy.body.code === 'EVIDENCE_TRANSFER_BUSY' &&
        busy.headers['retry-after'],
      'EVIDENCE_STRESS_UPLOAD_ADMISSION_FAILED',
    );
    busyResponses += 1;
    report.busyResponses = busyResponses;
    held.slice(0, 4).forEach((request) => request.complete());
    const completed = await Promise.all(held.slice(0, 4).map((request) => request.completion));
    ensure(
      completed.every((result) => result.status === 201 && typeof result.body.id === 'string'),
      'EVIDENCE_STRESS_UPLOAD_OUTCOME_FAILED',
    );
    await waitTransfers(api, 0);
    phases.push({
      phase: 'four_maximum_uploads',
      durationMs: Date.now() - uploadStarted,
      completed: 4,
      busyResponses: 1,
    });
    const downloadStarted = Date.now();
    for (let index = 0; index < 4; index += 1)
      downloads.push(
        holdDownload(ready.port, completed[index].body.id, actors[sequence[index]].token),
      );
    const statuses = await Promise.all(downloads.map((request) => request.ready));
    ensure(
      statuses.every((status) => status === 200),
      'EVIDENCE_STRESS_DOWNLOAD_HEADERS_FAILED',
    );
    await waitTransfers(api, 4);
    const denied = await send(
      ready.port,
      'GET',
      `/evidence/${completed[0].body.id}/download`,
      undefined,
      actors[0].token,
    );
    ensure(
      denied.status === 503 &&
        denied.body.code === 'EVIDENCE_TRANSFER_BUSY' &&
        denied.headers['retry-after'],
      'EVIDENCE_STRESS_DOWNLOAD_ADMISSION_FAILED',
    );
    busyResponses += 1;
    report.busyResponses = busyResponses;
    downloads.forEach((request) => request.resume());
    const received = await Promise.all(downloads.map((request) => request.completion));
    ensure(
      received.every(
        (result) =>
          result.status === 200 && result.bytes === content.length && result.hash === hash,
      ),
      'EVIDENCE_STRESS_DOWNLOAD_BYTES_FAILED',
    );
    await waitTransfers(api, 0);
    phases.push({
      phase: 'four_slow_authorized_downloads',
      durationMs: Date.now() - downloadStarted,
      completed: 4,
      busyResponses: 1,
    });
    const memory = await api.snapshot();
    ensure(memory.peakRssBytes <= stressRssBudgetBytes, 'EVIDENCE_STRESS_RSS_BUDGET_EXCEEDED');
    return {
      baselineRssBytes: baseline.baselineRssBytes,
      peakRssBytes: memory.peakRssBytes,
      busyResponses,
      phases,
    };
  } finally {
    held.forEach((request) => request.abort());
    downloads.forEach((request) => request.abort());
  }
}
export async function runEvidenceStress() {
  const output = path.join(root, 'evidence-stress-test-results');
  fs.mkdirSync(output, { recursive: true });
  let lock;
  let api;
  let project;
  let dockerArguments;
  let environment;
  let started = false;
  const began = Date.now();
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout?.trim();
  const report = {
    status: 'failed',
    commit: /^[a-f0-9]{40}$/.test(commit ?? '') ? commit : null,
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    osRelease: os.release(),
    rssSampleIntervalMs: 10,
    busyResponses: 0,
    hostMemoryBytes: os.totalmem(),
    fileBytes: stressFileBytes,
    globalConcurrency: 4,
    tenantConcurrency: 2,
    rssBudgetBytes: stressRssBudgetBytes,
    rssScope:
      'single host Node API process; scanner/database/storage/client processes excluded; not a container memory limit',
    scannerRetries: 0,
    phases: [],
  };
  const docker = process.platform === 'win32' ? 'docker.exe' : 'docker';
  const compose = (command) => {
    const result = spawnSync(docker, [...dockerArguments, ...command], {
      cwd: root,
      env: environment,
      stdio: 'ignore',
      timeout: 420000,
    });
    if (result.error || result.status !== 0) throw Error('EVIDENCE_STRESS_COMPOSE_FAILED');
  };
  try {
    lock = fs.openSync(path.join(output, '.run.lock'), 'wx');
    const ports = requireStressPorts(process.env);
    environment = { ...process.env, ...ports };
    project = `bettertrade-evidence-stress-${crypto.randomBytes(5).toString('hex')}`;
    dockerArguments = [
      'compose',
      '-p',
      project,
      '-f',
      path.join(root, 'docker-compose.evidence-stress.yml'),
    ];
    started = true;
    compose(['up', '-d', '--wait']);
    api = apiChild(stressEnvironment(ports));
    const ready = await api.ready;
    Object.assign(report, await exercise(api, ready, report));
    report.status = 'passed';
  } catch (error) {
    if (api) {
      try {
        const memory = await api.snapshot();
        report.baselineRssBytes = memory.baselineRssBytes;
        report.peakRssBytes = memory.peakRssBytes;
      } catch {
        /* A crashed API cannot supply a trustworthy final sample. */
      }
    }
    report.errorCode = /^EVIDENCE_STRESS_[A-Z_]+$/.test(error?.message ?? '')
      ? error.message
      : 'EVIDENCE_STRESS_FAILED';
  } finally {
    if (api) {
      if (api.child.connected) api.child.send({ type: 'stop' });
      await Promise.race([
        new Promise((resolve) => api.child.once('exit', resolve)),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      if (api.child.exitCode === null) api.child.kill();
    }
    if (started) {
      try {
        compose(['down', '--volumes', '--remove-orphans']);
      } catch {
        report.status = 'failed';
        report.cleanupErrorCode = 'EVIDENCE_STRESS_COMPOSE_CLEANUP_FAILED';
      }
    }
    report.durationMs = Date.now() - began;
    report.completedAt = new Date().toISOString();
    if (lock !== undefined) {
      fs.closeSync(lock);
      fs.unlinkSync(path.join(output, '.run.lock'));
      const filename = path.join(output, 'summary.json');
      const temporary = path.join(output, `${crypto.randomUUID()}.tmp`);
      fs.writeFileSync(temporary, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
      fs.renameSync(temporary, filename);
    } else {
      report.errorCode = 'EVIDENCE_STRESS_RUN_ALREADY_ACTIVE';
    }
  }
  console.log(JSON.stringify(report, null, 2));
  return report.status === 'passed' ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runEvidenceStress();
}
