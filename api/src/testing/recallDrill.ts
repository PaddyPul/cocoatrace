/** Synthetic native drill evidence. No customer names, resource IDs, contact data or proof bytes. */
export const DRILL_SCENARIOS = ['partial', 'commingled', 'distributed'] as const;
export interface DrillScenario {
  name: (typeof DRILL_SCENARIOS)[number];
  status: 'passed' | 'failed';
  elapsedMs: number;
  graphComplete: boolean;
  expectedRecipients: number;
  identifiedRecipients: number;
  missingRecipients: number;
  unexpectedRecipients: number;
  unresolvedRecipients: number;
  unresolvedContactRecipients: number;
  expectedQuantityGrams: number;
  accountedQuantityGrams: number;
  retainedQuantityGrams: number;
}
export interface DrillReport {
  version: 1;
  scope: 'synthetic-disposable-native';
  status: 'passed' | 'failed';
  commit: string;
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  scenarios: DrillScenario[];
}
const count = (n: unknown): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
const onlyKeys = (value: object, keys: readonly string[]) =>
  Object.keys(value).every((key) => keys.includes(key)) &&
  keys.every((key) => Object.hasOwn(value, key));
const duration = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
function validScenario(value: unknown): value is DrillScenario {
  if (!value || typeof value !== 'object') return false;
  const s = value as DrillScenario;
  return (
    onlyKeys(s, [
      'name',
      'status',
      'elapsedMs',
      'graphComplete',
      'expectedRecipients',
      'identifiedRecipients',
      'missingRecipients',
      'unexpectedRecipients',
      'unresolvedRecipients',
      'unresolvedContactRecipients',
      'expectedQuantityGrams',
      'accountedQuantityGrams',
      'retainedQuantityGrams',
    ]) &&
    DRILL_SCENARIOS.includes(s.name) &&
    s.status === 'passed' &&
    s.graphComplete === true &&
    duration(s.elapsedMs) &&
    [
      s.expectedRecipients,
      s.identifiedRecipients,
      s.missingRecipients,
      s.unexpectedRecipients,
      s.unresolvedRecipients,
      s.unresolvedContactRecipients,
      s.expectedQuantityGrams,
      s.accountedQuantityGrams,
      s.retainedQuantityGrams,
    ].every(count) &&
    s.expectedRecipients > 0 &&
    s.identifiedRecipients === s.expectedRecipients &&
    s.missingRecipients === 0 &&
    s.unexpectedRecipients === 0 &&
    s.unresolvedRecipients <= s.identifiedRecipients &&
    s.unresolvedContactRecipients <= s.identifiedRecipients &&
    s.expectedQuantityGrams > 0 &&
    s.accountedQuantityGrams === s.expectedQuantityGrams &&
    s.retainedQuantityGrams <= s.accountedQuantityGrams
  );
}
export function assertDrillReport(
  value: unknown,
  expectedCommit: string,
): asserts value is DrillReport {
  if (!/^[a-f0-9]{40}$/.test(expectedCommit) || !value || typeof value !== 'object')
    throw new Error('Invalid recall drill evidence');
  const r = value as DrillReport;
  if (
    !onlyKeys(r, [
      'version',
      'scope',
      'status',
      'commit',
      'startedAt',
      'completedAt',
      'elapsedMs',
      'scenarios',
    ]) ||
    typeof r.startedAt !== 'string' ||
    typeof r.completedAt !== 'string' ||
    r.version !== 1 ||
    r.scope !== 'synthetic-disposable-native' ||
    r.status !== 'passed' ||
    r.commit !== expectedCommit ||
    !Array.isArray(r.scenarios) ||
    r.scenarios.length !== DRILL_SCENARIOS.length ||
    !r.scenarios.every(validScenario) ||
    new Set(r.scenarios.map((s) => s.name)).size !== DRILL_SCENARIOS.length ||
    !duration(r.elapsedMs) ||
    !Number.isFinite(Date.parse(r.startedAt)) ||
    !Number.isFinite(Date.parse(r.completedAt)) ||
    Date.parse(r.completedAt) < Date.parse(r.startedAt) ||
    r.elapsedMs !== Date.parse(r.completedAt) - Date.parse(r.startedAt) ||
    r.scenarios.some((s) => s.elapsedMs > r.elapsedMs)
  )
    throw new Error('Recall drill evidence is incomplete, inconsistent or from another commit');
}
export function buildDrillReport(
  commit: string,
  startedAt: Date,
  completedAt: Date,
  scenarios: DrillScenario[],
): DrillReport {
  const report: DrillReport = {
    version: 1,
    scope: 'synthetic-disposable-native',
    status: 'passed',
    commit,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    elapsedMs: completedAt.getTime() - startedAt.getTime(),
    scenarios,
  };
  try {
    assertDrillReport(report, commit);
  } catch {
    report.status = 'failed';
  }
  return report;
}
