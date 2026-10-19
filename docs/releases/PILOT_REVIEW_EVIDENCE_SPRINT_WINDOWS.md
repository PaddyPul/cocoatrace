# Pilot review and evidence sprint — Windows handoff

Download `bettertrade-pilot-review-evidence-sprint-v1.bundle` into Downloads. This is a new branch from the accepted workspace review closure. Apply the tip once; do not re-import old bundles. Preserve all local Compose files, logs and untracked files. No database reset is needed.

Run from the existing repository:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
    git switch -c feat/pilot-review-evidence-sprint-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch exists or creation failed. Do not re-import; send git status.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-pilot-review-evidence-sprint-v1.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status; preserve conflicts for review.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > pilot-review-evidence-sprint-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Select-String -Path '.\pilot-review-evidence-sprint-release-output.txt' -Pattern 'FAILED:|FAIL |Error:' -Context 0,20
        throw 'Release failed. Stop before push/merge; send the first specific failure.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
    git push -u origin feat/pilot-review-evidence-sprint-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

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

Acceptance focus: named offer, goods-receipt, terms and permanent QR publication reviews must not write on Cancel; failures remain visible. Existing real buyer/seller journeys exercise money and terms confirmation before continuing. Anonymous /platform-role survives reload and explicitly excludes all six regulated/professional roles. No customer blending/repacking entry or invented physical transformation is claimed. Review the critical scenario report, P0 defect policy, unit economics hypotheses and defensibility evidence.

Seven candidate closure targets: UX-006, RCL-011, LEG-007, QLT-008, QLT-015, INV-012, INV-014. Accepted baseline157/343 (45.8%); after full acceptance164/343 (47.8%), +2.04 percentage points. Do not close hosted readiness, legal approval, actual economics or customer traction based on this bundle.

Author checks: quality, workspace/browser types, frontend boundary tests, regression checker/tests, release-runner tests, backlog/risk checks, production build/budget. Browser/native/full release execution remains founder-side. No API or database migration change. P0 register is prospective and starts empty; no historical severity classification is invented. Coverage reporting is an81-scenario evidence inventory over seven domains, not measured line/branch execution percentage.
