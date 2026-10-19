# Workspace state closure — sprint batch2 — Windows handoff

Download `bettertrade-workspace-state-closure-v1.bundle` into Downloads. This is a new branch from the accepted first resilience batch. Apply the tip once; do not re-import old bundles. Preserve all local Compose files, logs and untracked files. No database reset is needed.

Run from the existing repository:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
    git switch -c feat/workspace-state-closure-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch exists or creation failed. Do not re-import; send git status.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-workspace-state-closure-v1.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status; preserve conflicts for review.' }

}
```

Focused native check recommended after import and before starting preview (one filename per runner invocation):

```powershell
& {
    $ErrorActionPreference = 'Stop'
    cmd.exe /d /c "npm run test:integration:docker --workspace=api -- operationsWorkers.integration.test.ts > workspace-state-native-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content workspace-state-native-output.txt -Tail 80
        throw 'Focused native check failed. Stop before full release.'
    }
}
```

Acceptance focus: source/detail failures stay explicit; named retries perform reads without replaying writes; product identity failure never means absent/create; malformed safety rows fail visibly and retained holds override clear display. Keyboard-test shared search/mobile navigation/feedback for names, focus containment, Escape and retained drafts. No universal accessibility or35-item closure is implied.

Optional focused browser checks before full release (these suites mock API requests): build web, start preview terminal A, then run terminal B with the temporary origin.

Terminal A:

```powershell
npm run build --workspace=web
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
npm run preview --workspace=web -- --host 127.0.0.1 --port 13009 --strictPort
```

Terminal B:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $previousOrigin = $env:COCOATRACE_BROWSER_BASE_URL
    try {
        $env:COCOATRACE_BROWSER_BASE_URL = 'http://127.0.0.1:13009'
        cmd.exe /d /c "npm run test:browser -- detailReadRecovery.spec.ts sourceDetailFailures.spec.ts tradeReadRecovery.spec.ts adminAuthResilience.spec.ts serviceStatus.spec.ts catalogPages.spec.ts --repeat-each=2 > workspace-state-closure-focused-output.txt 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Select-String -Path '.\workspace-state-closure-focused-output.txt' -Pattern 'FAILED:' -Context 0,25
            throw 'Focused tests failed. Stop here.'
        }
        'Focused checks passed. Stop preview with Ctrl+C before full release.'
    } finally { $env:COCOATRACE_BROWSER_BASE_URL = $previousOrigin }
}
```

Run full release after import (and focused checks, if used). Stop preview first:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes exist.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > workspace-state-closure-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Select-String -Path '.\workspace-state-closure-release-output.txt' -Pattern 'FAILED:|FAIL |Error:' -Context 0,20
        throw 'Release failed. Stop before push/merge; send the first specific failure.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
    git push -u origin feat/workspace-state-closure-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Never recreate the branch or re-import an already applied bundle. Merge only after required CI and review; use the main pull block below after GitHub merge.

Author checks cover quality, workspace/browser types, frontend regressions, backlog/risk checks and production build/budget. Actual browser/native/full release remains founder-side. New private metrics API endpoint/instrumentation; no schema migration. Baseline164/343 (47.8%); sprint target199/343 (58.0%) across multiple verified batches. This second batch advances universal items without prematurely closing them. Public status targets OPS016; private metrics explicitly limit coverage. See docs/SPRINT_35_CLOSURE_TARGETS_2026-10-19.md and docs/ux/WORKSPACE_STATE_AUDIT.md.


Create the PR with the accompanying title/body. Wait for required CI, review and merge on GitHub. Only after merge:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
    git status --short
}
```

