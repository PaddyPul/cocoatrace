# Browser reviewer-session correction: full Windows instructions

The expanded browser suite repeatedly signed in as the same platform-admin while creating its workspaces. Ten attempts per account per fifteen minutes is the real authentication limit. The correction reuses that fixture administrator's authenticated session in memory, in separate browser contexts, and reports a non-200 login response immediately. Production authentication limits are unchanged. Fresh buyer/supplier identities and their full login/onboarding flows still run.

Keep the payment/document feature branch unmerged until the release check succeeds. This correction applies only on top of the payment/document bundle you have already installed. It does not repeat or alter database migration 024.

Download `cocoatrace-browser-reviewer-session-fix.bundle` into Downloads. Use PowerShell, one block at a time; stop if any command fails. Keep Docker Desktop running.

## 1. Check the current feature branch

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git branch --show-current
git switch feat/payment-document-hardening
```

Tracked files must be clean. Your untracked personal Compose overrides can remain. Do not switch to main or pull main while applying this correction to the unmerged feature.

## 2. Apply just the correction commit

```powershell
git bundle verify "$env:USERPROFILE\Downloads\cocoatrace-browser-reviewer-session-fix.bundle"
git fetch "$env:USERPROFILE\Downloads\cocoatrace-browser-reviewer-session-fix.bundle" "HEAD:refs/remotes/bundle/browser-reviewer-session-fix"
git cherry-pick bundle/browser-reviewer-session-fix
git log -3 --oneline
git status
```

Cherry-pick the tip only. Do not merge the complete bundle history. If a conflict appears, stop and send the output; do not reset or choose whole-file overwrite resolutions.

## 3. Rerun the automated release gate

```powershell
npm run verify:release
```

The Docker harness recreates its disposable test stack, so old failed-run login counters do not need a manual reset or a fifteen-minute wait. There are no dependency changes, and no additional npm install is required for this correction.

Proceed only when it reports `Release checks: passed`. The full browser suite must finish, and the restore gate after it must also pass. If a login fails now, its HTTP status is reported directly. Do not merge if any gate fails.

```powershell
Get-Content .\release-test-results\summary.json
```

## 4. Start the local application (optional)

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
```

This correction changes the test helper and release documentation, so a fresh manual trade checklist is unnecessary. Existing app data is preserved.

## 5. Push the feature branch, including its correction

```powershell
git status
git diff --check
git -c http.version=HTTP/1.1 push -u origin feat/payment-document-hardening
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/payment-document-hardening?expand=1"
```

If the PR already exists, pushing updates it; do not open a duplicate. Otherwise Create pull request with main as the base. Wait for all required GitHub checks, then Merge pull request and Confirm merge.

## 6. Pull merged main and rebuild

```powershell
git switch main
git pull --ff-only origin main
git status
git log -3 --oneline
npm ci
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
Start-Process "http://localhost:3000"
```

Main should be up to date with origin/main, with no tracked changes. Keep local untracked overrides out of commits. For the isolated synthetic preview instead, run `npm run demo:preview:start`, then `npm run demo:preview:check`; sharing remains `npm run demo:preview:share -- "pulalbert2@gmail.com"` with a newly printed link and fresh code.
