# Payment/document hardening: full Windows instructions

Download `cocoatrace-payment-document-hardening.bundle` into Downloads. These instructions assume the working preview branch was already merged and main synchronized, as you reported. Use PowerShell, one block at a time. Stop if a command fails. Keep Docker Desktop running. Existing local Compose override files can remain untracked; do not commit them or reset your data.

## 1. Synchronize main

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git switch main
git pull --ff-only origin main
git status
```

Tracked files must be clean before applying. If the supervised preview is still sharing, Ctrl+C in its sharing terminal first. That stops the temporary tunnel, not your data.

## 2. Import and apply on a feature branch

```powershell
git bundle verify "$env:USERPROFILE\Downloads\cocoatrace-payment-document-hardening.bundle"
git fetch "$env:USERPROFILE\Downloads\cocoatrace-payment-document-hardening.bundle" "HEAD:refs/remotes/bundle/payment-document-hardening"
git switch -c feat/payment-document-hardening
git cherry-pick bundle/payment-document-hardening
git status
git log -2 --oneline
```

Apply the bundle tip only; do not merge its entire history. If this feature branch already exists or cherry-pick conflicts, stop and send the output. Do not force/reset.

## 3. Install and run automated release checks

```powershell
npm ci
npm run verify:release
```

This runs units, builds, browser type checks, migration integrity, fresh/upgrade migrations, PostgreSQL/storage/scanner integration, browser journeys and restore rehearsal. It uses separate disposable test databases and includes the new five-plan payment coverage. You do not need to repeat a long manual trade checklist.

Proceed only when it ends with `Release checks: passed`. Inspect the recorded report if needed:

```powershell
Get-Content .\release-test-results\summary.json
```

On failure, send the failing gate and error output. Do not merge a failing release. The concurrency case is enabled in your normal native PostgreSQL suite, even though the authoring supplemental database cannot execute it.

## 4. Start the application (optional UI check)

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 60
Start-Process "http://localhost:3000"
```

API startup applies forward migration 024, adding the proof requirement and installment attachment. It does not reset existing agreements, payments or uploads. The local captured-email override is for testing; it does not configure real outgoing SMTP.

If you want a quick visual check, open an **unconfirmed** deal as the supplier: Set payment protection now includes “Require payment proof for every installment.” Confirm terms as the buyer; the due payment control shows a PDF/JPEG/PNG upload before submission. Already confirmed deals keep their existing requirements. The five automated browser journeys cover the remaining flow.

## 5. Review and push

```powershell
git status
git diff --check
git diff --stat origin/main...HEAD
git -c http.version=HTTP/1.1 push -u origin feat/payment-document-hardening
```

Do not use `git add .` for untracked local overrides. The imported commit already contains the implementation. If npm changed tracked files, inspect that diff before pushing; do not silently add generated lockfile noise.

## 6. Open and merge the pull request

```powershell
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/payment-document-hardening?expand=1"
```

Sign in to GitHub. Base: main; compare: feat/payment-document-hardening. Click Create pull request. Suggested title: **Harden payment proofs, document release and retry-safe settlement**. Wait for all required GitHub checks, then Merge pull request and Confirm merge. If GitHub reports a conflict, send that output before choosing a whole-file resolution.

## 7. Pull merged main

```powershell
git switch main
git pull --ff-only origin main
git status
git log -3 --oneline
```

Expected: main is up to date with origin/main; no tracked changes. Untracked personal Compose override files are acceptable.

## 8. Run the merged application

```powershell
npm ci
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
Start-Process "http://localhost:3000"
```

For the isolated synthetic preview instead:

```powershell
npm run demo:preview:start
npm run demo:preview:check
npm run demo:preview:share -- "pulalbert2@gmail.com"
```

Use the newly printed HTTPS link and a fresh email code in the same browser tab. Keep the PC/terminal running. Ctrl+C stops sharing. Sharing remains synthetic and temporary; it is not production hosting.
