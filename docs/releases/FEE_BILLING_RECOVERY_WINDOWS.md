# Fee billing delivery and external refund recovery

Use after the fee-enforcement PR is merged and main updated. Import the tip once. If this branch already exists, stop and resume its verification; do not create the branch again or re-import. Preserve local overrides, logs, stashes and original files. Migrations 050/051 retain financial history and add the fee email outbox. No bank calls, tax calculation, automatic collection or goods-payment refunds are supplied.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
    git switch -c feat/fee-billing-recovery-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch exists or creation failed. Do not re-import.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-fee-billing-recovery-v1.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status; preserve both audit histories.' }

    foreach ($suite in @(
        'feeRefunds.integration.test.ts',
        'feeStatementDelivery.integration.test.ts',
        'operationsEmailRecovery.integration.test.ts'
    )) {
        $log = "$suite-output.txt"
        cmd.exe /d /c "npm run test:integration:docker --workspace=api -- $suite > $log 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Get-Content $log -Tail 120
            throw "$suite failed. Stop before full release."
        }
        "$suite passed."
    }
}
```

After all three focused suites pass, run verification only:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if ((git branch --show-current).Trim() -ne 'feat/fee-billing-recovery-v1') { throw 'Wrong branch.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes exist.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > fee-billing-recovery-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content fee-billing-recovery-release-output.txt -Tail 180
        throw 'Release failed. Stop before push/merge; send the first specific failure.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed during verification.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared during verification.' }
    git push -u origin feat/fee-billing-recovery-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Use FEE_BILLING_RECOVERY_PR.md for the PR title/body; replace pending verification with actual results. Wait for required CI/review before merge. After merge, switch to main and pull `--ff-only`; rebuild the existing stack. Hardened API startup applies migrations through Node, not npm inside the runtime image. Never reset the database or remove volumes to resolve a failure.

Author validation is recorded in the final handoff. Native/browser/full release runtime remains required. No backlog completion credit is claimed for payment channels, tax, automatic collection, goods refunds, provider-confirmed transfers or broad financial operations closure.

After the PR is merged on GitHub:

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

Author checks: 1,472 API unit tests passed; API/web/browser types, strict compilation of four affected native suites, API/web builds, code quality, 236-route authorization inventory, migration integrity, backlog/risk checks and compressed entry budget passed. Native/browser/full release execution remains pending. Accepted progress remains 153/343 (44.6%); accepting PAY-012 after full release/merge would make 154/343 (44.9%).
