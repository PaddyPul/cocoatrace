# Privileged lifecycle invitation fixture isolation

Apply once on the existing controller-workflow feature branch after its privileged-lifecycle integration failure. Do not re-import the original74-file bundle. This bundle contains a single tip commit to cherry-pick; do not replay its full history. Existing untracked local files are preserved.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/controller-workflow-boundaries-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-privileged-lifecycle-fixture-fix.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status and conflicted diff.' }
    foreach ($suite in @('privilegedLifecycle.integration.test.ts', 'accessSuspension.integration.test.ts')) {
        $log = "$suite-fixture-output.txt"
        cmd.exe /d /c "npm run test:integration:docker --workspace=api -- $suite > $log 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Get-Content $log -Tail 70
            throw "$suite failed. Stop before full release."
        }
        "$suite passed."
    }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > controller-workflow-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content controller-workflow-release-output.txt -Tail 70
        throw 'Release failed. Stop before push/merge.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
    git push -u origin feat/controller-workflow-boundaries-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Keep the original controller-workflow PR body; add the isolated lifecycle invitation-role fixture correction to Changes and Validation. After review and GitHub merge, switch to main and pull with `git pull --ff-only origin main`, checking each command's exit code. Do not seed/reset a customer database. The full release owns isolated test infrastructure. Native and browser release gates are mandatory for this refactor.

## Cause and scope

Integration globalSetup applies migrations then truncates every application table, including seeded roles. Both privileged lifecycle tests read supplier_admin without provisioning it, then dereferenced role.id. Depending on another suite to create the role made execution order determine success. The access-suspension suite had the same dependency.

A shared native-test helper now creates a unique local role with no permissions for each invitation fixture, returns its ID explicitly, and reports failed creation directly. It does not restore global seed roles, add wildcard permission or change application authorization, MFA, revocation or audit code. Both affected suites use the helper. Formatting/LF scope includes these tests and the helper.

Author checks: native-suite TypeScript compilation and quality checks passed. Native PostgreSQL execution remains pending because Docker is unavailable author-side. The guarded commands run each suite separately (the runner accepts one filename), then the full exact-commit release before push.
