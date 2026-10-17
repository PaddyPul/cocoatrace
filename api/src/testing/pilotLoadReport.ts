export const LOAD_NAMES = [
  'marketplace',
  'trade-writes',
  'trade-actions',
  'provenance',
  'trace',
  'mixed',
] as const;
export type LoadTargets = {
  sampleCount: number;
  concurrency: number;
  p95Ms: number;
  p99Ms: number;
  classification: 'provisional-engineering-target';
};
export type LoadSample = { durationMs: number; status: number; expectedStatus: number };
export type RawWorkload = {
  name: string;
  concurrency: number;
  samples: LoadSample[];
  invariantsPassed: boolean;
};
export type LoadInput = {
  commit: string;
  startedAt: string;
  completedAt: string;
  hardware: {
    platform: string;
    architecture: string;
    node: string;
    cpuCount: number;
    hostMemoryBytes: number;
  };
  volumes: {
    listings: number;
    traceLots: number;
    traceEdges: number;
    measuredOfferWrites: number;
    provenanceEvidenceRows: number;
  };
  workloads: RawWorkload[];
};
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const integer = (n: unknown): n is number => finite(n) && Number.isSafeInteger(n);
function percentile(sorted: number[], fraction: number): number | null {
  return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : null;
}
function summarize(w: RawWorkload) {
  const sorted = w.samples.map((s) => s.durationMs).sort((a, b) => a - b);
  return {
    name: w.name,
    concurrency: w.concurrency,
    sampleCount: sorted.length,
    invariantsPassed: w.invariantsPassed,
    errors: w.samples.filter(
      (s) =>
        !finite(s.durationMs) ||
        ![200, 201].includes(s.expectedStatus) ||
        s.status !== s.expectedStatus,
    ).length,
    minMs: sorted[0] ?? null,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    maxMs: sorted.at(-1) ?? null,
  };
}
export interface PilotLoadReport {
  version: 1;
  scope: 'synthetic-local-http-postgres';
  status: 'passed' | 'failed';
  commit: string;
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  hardware: LoadInput['hardware'];
  volumes: LoadInput['volumes'];
  targets: LoadTargets;
  workloads: ReturnType<typeof summarize>[];
}
export function buildPilotLoadReport(input: LoadInput, targets: LoadTargets): PilotLoadReport {
  const report = {
    version: 1 as const,
    scope: 'synthetic-local-http-postgres' as const,
    status: 'passed' as 'passed' | 'failed',
    commit: input.commit,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    elapsedMs: Date.parse(input.completedAt) - Date.parse(input.startedAt),
    hardware: input.hardware,
    volumes: input.volumes,
    targets,
    workloads: input.workloads.map(summarize),
  };
  try {
    assertPilotLoadReport(report, input.commit, targets);
  } catch {
    report.status = 'failed';
  }
  return report;
}

const keys = (v: object, allowed: string[]) =>
  Object.keys(v).length === allowed.length && allowed.every((k) => Object.hasOwn(v, k));
export function assertPilotLoadReport(
  value: unknown,
  commit: string,
  targets: LoadTargets,
): asserts value is PilotLoadReport {
  if (!value || typeof value !== 'object' || !/^[0-9a-f]{40}$/.test(commit))
    throw new Error('Invalid load evidence');
  const r = value as PilotLoadReport;
  const fail = () => {
    throw new Error('Load evidence is incomplete, inconsistent, over budget or stale');
  };
  if (
    !keys(r, [
      'version',
      'scope',
      'status',
      'commit',
      'startedAt',
      'completedAt',
      'elapsedMs',
      'hardware',
      'volumes',
      'targets',
      'workloads',
    ]) ||
    r.version !== 1 ||
    r.scope !== 'synthetic-local-http-postgres' ||
    r.status !== 'passed' ||
    r.commit !== commit ||
    typeof r.startedAt !== 'string' ||
    typeof r.completedAt !== 'string' ||
    !finite(r.elapsedMs) ||
    !Number.isFinite(Date.parse(r.startedAt)) ||
    !Number.isFinite(Date.parse(r.completedAt)) ||
    r.elapsedMs !== Date.parse(r.completedAt) - Date.parse(r.startedAt)
  )
    fail();
  if (
    !r.targets ||
    !keys(r.targets, ['sampleCount', 'concurrency', 'p95Ms', 'p99Ms', 'classification']) ||
    Object.entries(targets).some(([k, v]) => r.targets[k as keyof LoadTargets] !== v) ||
    targets.sampleCount < 100 ||
    targets.concurrency < 1 ||
    targets.p95Ms > targets.p99Ms
  )
    fail();
  if (
    !r.hardware ||
    !keys(r.hardware, ['platform', 'architecture', 'node', 'cpuCount', 'hostMemoryBytes']) ||
    ![r.hardware.platform, r.hardware.architecture, r.hardware.node].every(
      (s) => typeof s === 'string' && /^[A-Za-z0-9._-]{1,40}$/.test(s),
    ) ||
    !integer(r.hardware.cpuCount) ||
    r.hardware.cpuCount < 1 ||
    !integer(r.hardware.hostMemoryBytes) ||
    r.hardware.hostMemoryBytes < 1
  )
    fail();
  if (
    !r.volumes ||
    !keys(r.volumes, [
      'listings',
      'traceLots',
      'traceEdges',
      'measuredOfferWrites',
      'provenanceEvidenceRows',
    ]) ||
    !Object.values(r.volumes).every(integer) ||
    r.volumes.listings < 1005 ||
    r.volumes.traceLots < 200 ||
    r.volumes.traceEdges < 199 ||
    r.volumes.measuredOfferWrites !== 150 ||
    r.volumes.provenanceEvidenceRows !== 100
  )
    fail();
  if (
    !Array.isArray(r.workloads) ||
    r.workloads.length !== LOAD_NAMES.length ||
    new Set(r.workloads.map((w) => w.name)).size !== LOAD_NAMES.length
  )
    fail();
  for (const w of r.workloads) {
    if (
      !w ||
      !keys(w, [
        'name',
        'concurrency',
        'sampleCount',
        'invariantsPassed',
        'errors',
        'minMs',
        'p50Ms',
        'p95Ms',
        'p99Ms',
        'maxMs',
      ]) ||
      !LOAD_NAMES.includes(w.name as (typeof LOAD_NAMES)[number]) ||
      w.concurrency !== targets.concurrency ||
      w.sampleCount !== targets.sampleCount ||
      w.invariantsPassed !== true ||
      w.errors !== 0 ||
      ![w.minMs, w.p50Ms, w.p95Ms, w.p99Ms, w.maxMs].every(finite)
    )
      fail();
    if (
      w.minMs! > w.p50Ms! ||
      w.p50Ms! > w.p95Ms! ||
      w.p95Ms! > w.p99Ms! ||
      w.p99Ms! > w.maxMs! ||
      w.maxMs! > r.elapsedMs ||
      w.p95Ms! > targets.p95Ms ||
      w.p99Ms! > targets.p99Ms
    )
      fail();
  }
}
