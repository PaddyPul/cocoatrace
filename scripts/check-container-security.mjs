import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const scannerImage = 'aquasec/trivy:0.75.0';
export function evaluateImageReport(report, requireNodeInventory = false) {
  if (report?.SchemaVersion !== 2 || !report.Metadata || !Array.isArray(report.Results)) {
    throw new Error('Missing or malformed Trivy report');
  }
  if (!report.Metadata.OS?.Family || !report.Results.some((result) => result.Class === 'os-pkgs')) {
    throw new Error('Image scan did not include the operating-system inventory');
  }
  if (requireNodeInventory && !report.Results.some((result) => result.Type === 'node-pkg')) {
    throw new Error('API image scan did not include installed Node packages');
  }
  if (report.Metadata.OS.Eosl) throw new Error('Image operating system is end of support');
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
  const failures = [];
  for (const result of report.Results) {
    if (result.Vulnerabilities !== undefined && !Array.isArray(result.Vulnerabilities)) {
      throw new Error('Malformed vulnerability list');
    }
    for (const finding of result.Vulnerabilities ?? []) {
      const severity = finding.Severity;
      counts[Object.hasOwn(counts, severity) ? severity : 'UNKNOWN'] += 1;
      if (!['LOW', 'MEDIUM'].includes(severity)) {
        failures.push({
          id: finding.VulnerabilityID ?? 'unknown',
          package: finding.PkgName ?? 'unknown',
          version: finding.InstalledVersion,
          target: result.Target ?? null,
          packagePath: finding.PkgPath ?? null,
          fixedVersion: finding.FixedVersion ?? null,
          severity: severity ?? 'UNKNOWN',
        });
      }
    }
  }
  return { status: failures.length ? 'failed' : 'passed', counts, failures };
}

export function runImageChecks(execute, root, reports, archives) {
  const images = [
    { name: 'api', tag: 'cocoatrace-api:security', file: 'api/Dockerfile' },
    { name: 'web', tag: 'cocoatrace-web:security', file: 'web/Dockerfile' },
  ];
  const results = [];
  for (const image of images) {
    const build = ['build', '--pull', '--file', path.join(root, image.file), '--tag', image.tag];
    if (image.name === 'web')
      build.push('--build-arg', 'VITE_DEMO_MODE=false', '--build-arg', 'VITE_DEMO_PREVIEW=false');
    execute([...build, root]);
    if (image.name === 'api') {
      execute([
        'run',
        '--rm',
        '--entrypoint',
        'node',
        image.tag,
        'api/scripts/check-runtime-image.mjs',
      ]);
    } else {
      execute([
        'run',
        '--rm',
        '--add-host',
        'api:127.0.0.1',
        '--entrypoint',
        'sh',
        image.tag,
        '-c',
        'test "$(id -u)" != 0 && nginx -t',
      ]);
    }
    execute(['save', '--output', path.join(archives, `${image.name}.tar`), image.tag]);
    const reportPath = path.join(reports, `${image.name}.json`);
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
    execute([
      'run',
      '--rm',
      '--security-opt',
      'no-new-privileges',
      '-v',
      `${archives}:/scan:ro`,
      '-v',
      `${reports}:/reports`,
      '-v',
      'cocoatrace-trivy-cache:/root/.cache/trivy',
      scannerImage,
      'image',
      '--input',
      `/scan/${image.name}.tar`,
      '--scanners',
      'vuln',
      '--pkg-types',
      'os,library',
      '--format',
      'json',
      '--output',
      `/reports/${image.name}.json`,
      '--exit-code',
      '0',
      '--timeout',
      '10m',
    ]);
    const decision = evaluateImageReport(
      JSON.parse(fs.readFileSync(reportPath, 'utf8')),
      image.name === 'api',
    );
    results.push({ image: image.name, ...decision });
  }
  return {
    status: results.every((image) => image.status === 'passed') ? 'passed' : 'failed',
    images: results,
  };
}

export function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const reports = path.join(root, 'container-test-results');
  fs.mkdirSync(reports, { recursive: true });
  const archives = fs.mkdtempSync(path.join(os.tmpdir(), 'cocoatrace-image-scan-'));
  const docker = process.platform === 'win32' ? 'docker.exe' : 'docker';
  let summary;
  try {
    summary = runImageChecks(
      (args) => {
        const result = spawnSync(docker, args, { cwd: root, stdio: 'inherit' });
        if (result.error || result.status !== 0)
          throw new Error(`Container operation failed: ${args[0]}`);
      },
      root,
      reports,
      archives,
    );
  } catch (error) {
    summary = { status: 'failed', error: error.message };
  } finally {
    fs.rmSync(archives, { recursive: true, force: true });
  }
  fs.writeFileSync(
    path.join(reports, 'summary.json'),
    JSON.stringify({ ...summary, completedAt: new Date().toISOString() }, null, 2) + '\n',
  );
  console.log(JSON.stringify(summary, null, 2));
  console.log('Container report: container-test-results/summary.json');
  process.exitCode = summary.status === 'passed' ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
