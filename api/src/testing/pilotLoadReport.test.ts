import { expect, it } from 'vitest';
import {
  assertPilotLoadReport,
  buildPilotLoadReport,
  LOAD_NAMES,
  type LoadInput,
  type LoadTargets,
} from './pilotLoadReport';
const sha = 'a'.repeat(40),
  targets: LoadTargets = {
    sampleCount: 100,
    concurrency: 4,
    p95Ms: 2000,
    p99Ms: 5000,
    classification: 'provisional-engineering-target',
  };
function input(): LoadInput {
  return {
    commit: sha,
    startedAt: '2026-10-17T00:00:00Z',
    completedAt: '2026-10-17T00:01:00Z',
    hardware: {
      platform: 'win32',
      architecture: 'x64',
      node: 'v24.21.0',
      cpuCount: 4,
      hostMemoryBytes: 16000000000,
    },
    volumes: {
      listings: 1005,
      traceLots: 200,
      traceEdges: 199,
      measuredOfferWrites: 150,
      provenanceEvidenceRows: 100,
    },
    workloads: LOAD_NAMES.map((name) => ({
      name,
      concurrency: 4,
      invariantsPassed: true,
      samples: Array.from({ length: 100 }, (_, i) => ({
        durationMs: i + 1,
        status: 200,
        expectedStatus: 200,
      })),
    })),
  };
}
it('records nearest-rank percentiles without retaining individual requests or credentials', () => {
  const report = buildPilotLoadReport(input(), targets);
  expect(report.status).toBe('passed');
  expect(report.workloads[0]).toMatchObject({
    sampleCount: 100,
    p50Ms: 50,
    p95Ms: 95,
    p99Ms: 99,
    maxMs: 100,
    errors: 0,
  });
  expect(report.workloads[0]).not.toHaveProperty('samples');
});
it.each([
  'errors',
  'invariants',
  'samples',
  'concurrency',
  'latency',
  'missing',
  'duplicate',
] as const)('refuses %s rather than giving partial capacity credit', (kind) => {
  const i = input();
  if (kind === 'errors') i.workloads[0].samples[0].status = 503;
  if (kind === 'invariants') i.workloads[0].invariantsPassed = false;
  if (kind === 'samples') i.workloads[0].samples.pop();
  if (kind === 'concurrency') i.workloads[0].concurrency = 1;
  if (kind === 'latency') i.workloads[0].samples.forEach((s) => (s.durationMs = 2001));
  if (kind === 'missing') i.workloads.pop();
  if (kind === 'duplicate') i.workloads[1].name = i.workloads[0].name;
  expect(buildPilotLoadReport(i, targets).status).toBe('failed');
});
it('rejects stale commits, changed targets and unknown metadata fields', () => {
  const r = buildPilotLoadReport(input(), targets);
  expect(() => assertPilotLoadReport(r, 'b'.repeat(40), targets)).toThrow();
  expect(() =>
    assertPilotLoadReport({ ...r, targets: { ...targets, p95Ms: 3000 } }, sha, targets),
  ).toThrow();
  expect(() => assertPilotLoadReport({ ...r, token: 'secret' }, sha, targets)).toThrow();
});
it('rejects nonfinite timing and malformed machine/volume evidence', () => {
  const i = input();
  i.workloads[0].samples[0].durationMs = Infinity;
  expect(buildPilotLoadReport(i, targets).status).toBe('failed');
  const r = buildPilotLoadReport(input(), targets);
  expect(() =>
    assertPilotLoadReport(
      { ...r, volumes: { ...r.volumes, measuredOfferWrites: 0 } },
      sha,
      targets,
    ),
  ).toThrow();
  expect(() => assertPilotLoadReport({ ...r, elapsedMs: 1 }, sha, targets)).toThrow();
});
