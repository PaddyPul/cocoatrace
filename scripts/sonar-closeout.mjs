import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = 'PaddyPul_cocoatrace';
const planPath = 'docs/quality/sonar-closeout-2026-10-25.json';
const marker = '[BetterTrade individual review 2026-10-25]';
const targets = { FALSE_POSITIVE: 'falsepositive', ACCEPTED: 'accept' };

export function validatePlan(plan, readSource) {
  if (plan.schemaVersion !== 1 || plan.project !== project || plan.issues?.length !== 47)
    throw new Error('Unexpected closeout scope');
  const seen = new Set();
  const totals = { SOURCE_FIX: 0, FALSE_POSITIVE: 0, ACCEPTED: 0 };
  for (const issue of plan.issues) {
    if (
      !/^[\w-]+$/.test(issue.id) ||
      seen.has(issue.id) ||
      !Object.hasOwn(totals, issue.disposition) ||
      !issue.reason?.trim() ||
      !issue.path ||
      !/^[\w./-]+$/.test(issue.path) ||
      path.isAbsolute(issue.path) ||
      issue.path.split('/').includes('..')
    )
      throw new Error('Invalid individual review decision');
    seen.add(issue.id);
    totals[issue.disposition]++;
    if (issue.disposition !== 'SOURCE_FIX' && readSource) {
      const digest = createHash('sha256')
        .update(readSource(issue.path).toString('utf8').replace(/\r\n/g, '\n'))
        .digest('hex');
      if (digest !== issue.sourceSha256) throw new Error(`Reviewed source changed: ${issue.path}`);
    }
  }
  if (totals.SOURCE_FIX !== 1 || totals.FALSE_POSITIVE !== 35 || totals.ACCEPTED !== 11)
    throw new Error('Review decision totals changed');
}

function state(issue) {
  if (issue.issueStatus) return issue.issueStatus;
  if (issue.resolution === 'FALSE-POSITIVE') return 'FALSE_POSITIVE';
  if (issue.resolution === 'WONTFIX') return 'ACCEPTED';
  if (issue.resolution === 'FIXED') return 'FIXED';
  return issue.status;
}

/** Preflight the whole reviewed set before any write. Never retry a write. */
export async function closeout(plan, { request, apply = false, record = () => {} }) {
  validatePlan(plan);
  const pending = [];
  for (const decision of plan.issues) {
    const data = await request('GET', 'issues/search', {
      issues: decision.id,
      additionalFields: 'comments',
    });
    if (data.issues?.length !== 1) throw new Error(`Issue missing or inaccessible: ${decision.id}`);
    const issue = data.issues[0];
    if (
      issue.key !== decision.id ||
      issue.rule !== decision.rule ||
      issue.component !== `${project}:${decision.path}`
    )
      throw new Error(`Issue identity changed: ${decision.id}`);
    const current = state(issue);
    if (decision.disposition === 'SOURCE_FIX') {
      record({
        id: decision.id,
        status: current === 'FIXED' ? 'FIXED_BY_SCAN' : 'AWAITING_SOURCE_RESCAN',
      });
      continue;
    }
    if (current === decision.disposition) {
      record({ id: decision.id, status: 'ALREADY_REVIEWED', disposition: current });
      continue;
    }
    if (!['OPEN', 'CONFIRMED', 'REOPENED'].includes(current))
      throw new Error(`Unexpected issue state: ${decision.id}`);
    pending.push({ decision, issue });
  }
  for (const { decision, issue } of pending) {
    if (!apply) {
      record({ id: decision.id, status: 'PLANNED', disposition: decision.disposition });
      continue;
    }
    // Re-read immediately before this issue's writes; another reviewer may act.
    const fresh = await request('GET', 'issues/search', {
      issues: decision.id,
      additionalFields: 'comments',
    });
    const live = fresh.issues?.[0];
    if (
      fresh.issues?.length !== 1 ||
      live.key !== issue.key ||
      live.rule !== issue.rule ||
      live.component !== issue.component ||
      state(live) !== state(issue) ||
      live.updateDate !== issue.updateDate
    )
      throw new Error(`Issue changed after preflight: ${decision.id}`);
    record({ id: decision.id, status: 'REVIEW_STARTED', disposition: decision.disposition });
    const comment = `${marker} ${decision.disposition}: ${decision.reason}`;
    if (!live.comments?.some((item) => item.markdown === comment)) {
      await request('POST', 'issues/add_comment', { issue: decision.id, text: comment });
    }
    const changed = await request('POST', 'issues/do_transition', {
      issue: decision.id,
      transition: targets[decision.disposition],
    });
    if (changed.issue?.key !== decision.id || state(changed.issue) !== decision.disposition)
      throw new Error(`Transition not confirmed: ${decision.id}`);
    record({ id: decision.id, status: 'REVIEW_APPLIED', disposition: decision.disposition });
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--apply', '--plan'].includes(arg)) || args.length > 1)
    throw new Error('Use --plan (local only), no argument (live read-only), or --apply');
  const plan = JSON.parse(fs.readFileSync(path.join(root, planPath), 'utf8'));
  validatePlan(plan, (file) => fs.readFileSync(path.join(root, file)));
  if (args.includes('--plan')) {
    console.log(
      JSON.stringify(
        {
          project,
          summary: plan.summary,
          issues: plan.issues.map(({ id, rule, path: file, disposition, reason }) => ({
            id,
            rule,
            path: file,
            disposition,
            reason,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }
  const token = process.env.SONAR_TOKEN;
  if (!token)
    throw new Error('Set SONAR_TOKEN locally; never paste the token into chat or commit it');
  const results = [];
  let status = 'failed';
  try {
    await closeout(plan, {
      apply: args.includes('--apply'),
      request: async (method, endpoint, values) => {
        const form = new URLSearchParams(values);
        const url = `https://sonarcloud.io/api/${endpoint}${method === 'GET' ? `?${form}` : ''}`;
        const response = await fetch(url, {
          method,
          redirect: 'error',
          signal: AbortSignal.timeout(30_000),
          headers: {
            Authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}`,
            ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
          },
          ...(method === 'POST' ? { body: form } : {}),
        });
        if (!response.ok)
          throw new Error(
            `Sonar ${method} ${endpoint} failed (HTTP ${response.status}); no automatic retry`,
          );
        return response.json();
      },
      record: (item) => {
        results.push(item);
        console.log(
          `${item.id}: ${item.status}${item.disposition ? ` (${item.disposition})` : ''}`,
        );
      },
    });
    status = args.includes('--apply') ? 'review_actions_completed' : 'read_only_preflight_passed';
  } finally {
    const output = path.join(root, 'sonar-closeout-results');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(
      path.join(output, 'summary.json'),
      JSON.stringify({ status, project, completedAt: new Date().toISOString(), results }, null, 2) +
        '\n',
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error) => {
    // Do not print HTTP bodies, headers, credentials or exception causes.
    console.error(
      error instanceof Error && !/fetch|network|JSON|Unexpected token/i.test(error.message)
        ? error.message
        : 'Sonar closeout stopped; inspect the redacted partial summary before retrying',
    );
    process.exitCode = 1;
  });
}
