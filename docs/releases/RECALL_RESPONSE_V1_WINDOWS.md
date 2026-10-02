# Recall Response v1 — apply, test, push, merge and synchronize

Use PowerShell. Apply this on top of the Recall Safety code you just tested. That previous wave can be merged already or still on your tested local feature branch; the steps preserve it and add one correction commit. Keep local Compose override files uncommitted.

## 1. Apply the bundle

Download `cocoatrace-recall-response-v1.bundle` into Downloads. In the same repository and branch used for your successful Recall Safety test:

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git branch --show-current
```

Continue only if there are no modified tracked files or unresolved conflicts. Untracked local Compose overrides may remain. Do not switch to an older main before applying the new work.

```powershell
if (-not (Test-Path "api\src\migrations\022_recall_safety_holds.ts")) { throw "Recall Safety is missing. Switch to the branch you just tested before continuing." }
git bundle verify "$env:USERPROFILE\Downloads\cocoatrace-recall-response-v1.bundle"
git fetch "$env:USERPROFILE\Downloads\cocoatrace-recall-response-v1.bundle" "HEAD:refs/remotes/bundle/recall-response-v1"
git switch -c feat/recall-response-v1
git cherry-pick bundle/recall-response-v1
git status
git log -3 --oneline
```

Cherry-pick applies only the bundle's latest commit, not its entire history. If the new branch name already exists, switch to it instead of creating it, inspect its log and do not apply the same change twice. If any Git command fails or conflicts, stop and share that output before testing or pushing.

No dependencies were added; use your existing installed packages. If dependencies are absent, run `npm ci`.

## 2. Automated release checks

Run each command separately and stop on failure:

```powershell
npm test --workspace=api
npm run build --workspace=api
npm run build --workspace=web
npm run typecheck:browser
npm run migrations:verify --workspace=api
npm run test:migrations:docker
npm run test:integration:docker
npm run test:browser:docker
```

The complete native suite is expected to contain 92 integration tests and 23 browser tests. Native PostgreSQL, scanner/storage integration, production migration startup and the real browser journey must pass before merging. Supplemental authoring checks do not replace these release gates. Browser tests use a disposable database and captured SMTP inbox; they do not need your real customer email addresses.

## 3. Start the application

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 100
Start-Process "http://localhost:3000"
Start-Process "http://localhost:8025"
```

Migration 023 should run normally. Do not reset/reseed or remove database volumes. The email-test override captures messages in Mailpit; real-provider delivery is a later staging configuration task.

## 4. Short UI smoke test

The automated suites cover the detailed regressions. This smoke test checks that the experience is understandable:

1. Use an existing supplier and buyer with a genuine shared batch/contract, or create conventional inventory and transfer part of it to the buyer. The supplier needs recall-management permission; the buyer needs its usual evidence permission, not recall-management permission. No certifier account is needed.
2. Supplier opens Trace & Recall / Recall Center, chooses the affected batch, supplies a unique reference, reason and isolation instructions, and activates the notice. The affected listing is withdrawn.
3. Open the notice's **Recall response and recovery** panel. Supplier sees affected organizations, acknowledgement status and email status. Mailpit should capture activation messages; SMTP submission is not acknowledgement.
4. Buyer signs in, opens Recall Center, enters an acknowledgement note and selects **Acknowledge instructions**. Buyer sees and can record only its own affected holdings. It cannot resolve the recall or modify supplier stock.
5. Each current holder selects its holding and records the full quantity across the five recovery fields. For a clearance test, record the full amount as Released or Corrected and give an explanatory note. For a disposal test, use Returned or Destroyed instead. These are accounting records and do not silently change ownership or inventory quantities.
6. Supplier records a contact result and note if needed. Upload a genuine PDF/JPEG/PNG investigation record through **Upload response evidence**. Wait for it to appear, download it and select its resolution checkbox.
7. Enter a substantive resolution reason and select **Resolve recall with evidence**. Missing acknowledgement, missing evidence, incomplete accounting or remaining quarantine must prevent closure.
8. After closure, the notice and response history remain visible. A cleared batch requires explicit review/republishing. Returned or destroyed material remains blocked; a batch with any retained disposal hold remains entirely blocked until a future audited segregation workflow.

Email states may include queued, sent, suppressed, failed or failed_terminal. A failed email does not remove the notice. Record contact/escalation and investigate SMTP; do not interpret it as buyer acknowledgement.

## 5. Operational checks

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run recall:deliver
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run recall:check
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run trade:reconcile
```

The worker reports sent/suppressed/failed counts. No new queued work is a normal zero result. `terminalFailures` greater than zero needs operator attention; this CLI exits unsuccessfully in that case. Both reconciliation reports should return `ok: true` and `issueCount: 0`; retained disposal holds can remain in the summary without being an error.

## 6. Push and create the pull request

Only after all checks and the smoke test pass:

```powershell
git status
git push -u origin feat/recall-response-v1
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/recall-response-v1?expand=1"
```

Create a pull request into `main`, title **Add recall response and evidence-backed closure**. If Recall Safety was not merged yet, this branch includes that tested work as well; review the combined diff. Do not merge an older duplicate PR after this combined PR. Wait for every GitHub check to pass and resolve any reported conflicts before selecting **Merge pull request** and **Confirm merge**.

If the usual push hangs on your older Git setup, cancel it and retry the previously successful command:

```powershell
git -c http.version=HTTP/1.1 push --verbose --progress -u origin feat/recall-response-v1
```

## 7. Pull merged main and restart

After GitHub confirms the merge:

```powershell
git switch main
git pull --ff-only origin main
git status
git log -3 --oneline
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run recall:check
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run trade:reconcile
```

Keep branch deletion optional until main is confirmed current. If `pull --ff-only` refuses, share its output; do not reset local work. The release is complete when main is synchronized, CI is green and both operational checks are clean.

## Authoring validation and limits

Passed: 159 API unit tests, API/web production builds, browser type checking, migration integrity, and 16 browser checks against explicit API fixtures. 23 recall checks passed in supplemental PostgreSQL and cover the recall response and safety behavior, including private evidence authorization, recovery bounds, full custody transfer, retained disposal holds, active-user notification filtering, concurrent workers and expired leases.

Four recall checks require native PostgreSQL and were not executed in the supplemental database: the real activation/offer-acceptance race, already-dispatched receipt containment, and two audit-failure rollback cases. Docker is unavailable in the authoring environment, so native migration/integration tests and the complete real-browser journey are still required on your machine and in CI. Real SMTP-provider delivery, physical stock segregation and external-recipient acknowledgement remain explicitly open backlog work.
