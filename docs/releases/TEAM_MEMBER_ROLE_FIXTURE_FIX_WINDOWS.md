# Team member role-fixture correction

The integration globalSetup truncates application tables after migrations, including roles. Earlier fixture assignments therefore inserted no user_roles rows and API requests correctly returned403. The suite now seeds its three required bounded customer roles, verifies each assignment, and restores any preexisting role permissions afterward so full-suite ordering cannot supply an incompatible role definition. Test accounts remain explicitly verified, with real passkey enrollment. A poisoned-role regression and safe status/code diagnostics are included. Only test fixtures change; application authorization and production role defaults stay unchanged.

This correction follows the already-applied verified-organization fix. No reset, migration edit or dependency install is needed.

Download bettertrade-team-member-role-fixture-fix.bundle to Downloads. Apply only the tip on the existing feature branch. Preserve local logs/Compose files/stash.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/team-access-review-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-team-member-role-fixture-fix.bundle'
    if (-not (Test-Path $bundle)) { throw 'Bundle missing from Downloads.' }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" 'HEAD:refs/remotes/bundle/team-member-role-fixture-fix'
    if ($LASTEXITCODE -ne 0) { throw 'Bundle fetch failed.' }
    git cherry-pick bundle/team-member-role-fixture-fix
    if ($LASTEXITCODE -ne 0) { throw 'Cherry-pick failed. Send git status; do not choose whole-file ours/theirs.' }
    cmd.exe /d /c "npm run test:integration:docker --workspace=api -- teamMembers.integration.test.ts > team-member-role-fixture-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content team-member-role-fixture-output.txt -Tail 70
        throw 'Focused test failed. Send the first specific failure.'
    }
    'Focused team tests passed.'
}
```

After that passes, run the full release once:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes exist.' }
    cmd.exe /d /c "npm run verify:release > team-access-review-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content team-access-review-release-output.txt -Tail 80
        throw 'Release failed. Stop before push/merge; send the first specific failure.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed during verification.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared during verification.' }
    git push -u origin feat/team-access-review-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Use the existing TEAM_ACCESS_REVIEW_PR.md full title/body and add the passing SHA/CI evidence. This correction belongs in that same PR. Required GitHub CI must pass before merge. After merge follow the existing main pull/start block. No backlog completion credit until the combined release is accepted.

Author validation: strict native test compilation and quality checks; Docker runtime integration remains to be run on the founder host.
