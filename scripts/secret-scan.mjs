import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const scannerVersion = '8.30.1';
export const scannerImage =
  'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';

export function reviewFindings(findings, exceptions, now = new Date()) {
  if (!Array.isArray(findings) || !Array.isArray(exceptions))
    throw new Error('Invalid secret-scan report or exceptions');
  const allowed = new Map();
  for (const item of exceptions) {
    if (
      !item.fingerprint ||
      !item.reason ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.expires) ||
      Date.parse(item.expires + 'T23:59:59.999Z') < now.getTime() ||
      allowed.has(item.fingerprint)
    ) {
      throw new Error('Invalid, duplicate or expired secret-scan exception');
    }
    allowed.set(item.fingerprint, item);
  }
  const projected = findings.map((finding) => {
    if (
      typeof finding.Fingerprint !== 'string' ||
      typeof finding.RuleID !== 'string' ||
      typeof finding.File !== 'string' ||
      !Number.isInteger(finding.StartLine)
    ) {
      throw new Error('Invalid secret-scan finding');
    }
    // Never serialize scanner Match, Secret, context, author or commit message.
    return {
      rule: finding.RuleID,
      file: finding.File,
      line: finding.StartLine,
      fingerprint: finding.Fingerprint,
      accepted: allowed.has(finding.Fingerprint),
    };
  });
  return {
    status: projected.some((item) => !item.accepted) ? 'failed' : 'passed',
    findings: projected,
  };
}

export function scannerArguments(root, reportDirectory, native = false, canary = false) {
  const flags = [
    'git',
    native ? root : '/repo',
    '--redact=100',
    '--no-banner',
    '--no-color',
    '--ignore-gitleaks-allow',
    '--gitleaks-ignore-path',
    native ? path.join(reportDirectory, 'no-ignores') : '/report/no-ignores',
    '--config',
    native ? path.join(root, 'security/gitleaks.toml') : '/repo/security/gitleaks.toml',
    '--report-format=json',
    '--report-path',
    native ? path.join(reportDirectory, 'raw.json') : '/report/raw.json',
    '--timeout=300',
  ];
  if (canary) flags.splice(0, 2, 'stdin');
  return native
    ? flags
    : [
        'run',
        '--rm',
        ...(canary ? ['-i'] : []),
        '--network=none',
        '--read-only',
        '--env',
        'GIT_CONFIG_COUNT=1',
        '--env',
        'GIT_CONFIG_KEY_0=safe.directory',
        '--env',
        'GIT_CONFIG_VALUE_0=/repo',
        '--mount',
        `type=bind,source=${root},target=/repo,readonly`,
        '--mount',
        `type=bind,source=${reportDirectory},target=/report`,
        scannerImage,
        ...flags,
      ];
}

export function scanSecrets(root) {
  const directory = path.join(root, 'secret-scan-test-results');
  fs.mkdirSync(directory, { recursive: true });
  const summary = path.join(directory, 'summary.json');
  fs.rmSync(summary, { force: true });
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bettertrade-secret-scan-'));
  let report = { status: 'failed', scannerVersion, findings: [] };
  try {
    const native = process.env.GITLEAKS_BINARY;
    const command = native || (process.platform === 'win32' ? 'docker.exe' : 'docker');
    if (native) {
      const version = spawnSync(command, ['version'], { encoding: 'utf8', timeout: 10000 });
      if (version.status !== 0 || version.stdout.trim().replace(/^v/, '') !== scannerVersion) {
        throw new Error('Native Gitleaks must match the pinned scanner version');
      }
    }
    const shallow = spawnSync('git', ['rev-parse', '--is-shallow-repository'], {
      cwd: root,
      encoding: 'utf8',
    });
    if (shallow.status !== 0 || shallow.stdout.trim() !== 'false')
      throw new Error('Secret scan requires complete Git history; fetch with --unshallow first');
    const canary = spawnSync(command, scannerArguments(root, temporary, Boolean(native), true), {
      cwd: root,
      encoding: 'utf8',
      timeout: 360000,
      maxBuffer: 8 * 1024 * 1024,
      input:
        'github_token = "' +
        'gh' +
        'p_' +
        crypto.randomBytes(27).toString('base64url').replaceAll('-', 'A').replaceAll('_', 'B') +
        '"',
      env: { ...process.env, GITLEAKS_CONFIG: '', GITLEAKS_CONFIG_TOML: '' },
    });
    const canaryPath = path.join(temporary, 'raw.json');
    if (
      canary.error ||
      canary.status !== 1 ||
      !fs.existsSync(canaryPath) ||
      JSON.parse(fs.readFileSync(canaryPath, 'utf8')).length < 1
    )
      throw new Error('Secret scanner detection canary failed');
    fs.rmSync(canaryPath);
    const result = spawnSync(command, scannerArguments(root, temporary, Boolean(native)), {
      cwd: root,
      encoding: 'utf8',
      timeout: 360000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, GITLEAKS_CONFIG: '', GITLEAKS_CONFIG_TOML: '' },
    });
    if (result.error || ![0, 1].includes(result.status))
      throw new Error('Secret scanner could not complete; start Docker Desktop and retry');
    const raw = path.join(temporary, 'raw.json');
    if (!fs.existsSync(raw)) throw new Error('Secret scanner produced no report');
    const findings = JSON.parse(fs.readFileSync(raw, 'utf8'));
    const exceptions = JSON.parse(
      fs.readFileSync(path.join(root, 'security/secret-scan-exceptions.json'), 'utf8'),
    );
    report = { ...reviewFindings(findings, exceptions), scannerVersion };
    if (result.status === 1 && findings.length === 0)
      throw new Error('Secret scanner exit/report mismatch');
  } catch (error) {
    report.status = 'failed';
    // Only our fixed messages are emitted; never copy native stderr or raw report errors.
    report.error = error instanceof SyntaxError ? 'Invalid secret scanner JSON' : error.message;
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  report.commit = revision.status === 0 ? revision.stdout.trim() : null;
  report.completedAt = new Date().toISOString();
  fs.writeFileSync(summary, JSON.stringify(report, null, 2));
  console.log(
    `Secret scan: ${report.status}; ${report.findings.length} findings (values suppressed). Report: secret-scan-test-results/summary.json`,
  );
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode =
    scanSecrets(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')).status ===
    'passed'
      ? 0
      : 1;
}
