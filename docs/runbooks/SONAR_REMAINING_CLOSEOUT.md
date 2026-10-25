# Remaining Sonar findings: individual closeout, 2026-10-25

The founder supplied a complete 47-item unresolved main export after PR #153. It contains 46 security findings and one reliability finding. All IDs still belong to the original 211-item baseline: 164 baseline IDs are absent from this unresolved export. Absence is not evidence of a particular terminal resolution. The old ledger now records that distinction.

## Outcome and limitations

- One source correction: the final onboarding pilot-feedback checkbox has a directly associated visible text label and separate accessible description. The choice and save behavior are unchanged.
- 35 individual false-positive decisions: 25 Moto-only S3 fixture findings and ten public synthetic seed hashes. No real AWS endpoint, production key revocation or production credential rotation is claimed.
- 11 accepted residual risks: four intentional local development database passwords and seven trusted local executable-discovery sites. These are accepted local-development/toolchain assumptions, not fixed vulnerabilities. SEC-006 stays open for hosted secrets and toolchain controls.

The complete per-ID rationale and exact reviewed source digests are in `docs/quality/sonar-closeout-2026-10-25.json`. The tool is limited to these IDs in `PaddyPul_cocoatrace`; it does not create exclusions, change the gate, resolve the source fix manually or dismiss new findings. Source digests normalize Windows CRLF to LF but reject content changes.

## Release first

Apply the bundle on updated main, capture the candidate commit before verification, run the full release and push only matching passed evidence. Merge only after CI and Sonar pass. Pull merged main before the external review step. The source issue should be FIXED by the analysis of that merged code; a passing quality gate alone does not prove it is fixed.

## Inspect decisions without credentials or network

```powershell
node scripts/sonar-closeout.mjs --plan
```

This prints every proposed decision and reason. Review the 11 accepted risks as residual risks; do not relabel them as code fixes. If any rationale is no longer true, keep that issue open and update the review through another reviewed change.

## Apply the reviewed decisions in SonarCloud

This requires an account token with Browse and Administer Issues permission for this project. Create the token under SonarCloud account Security. Never paste it into chat, a tracked file, a command argument or a release log. The following block prompts locally using masked input, performs a live read-only preflight, and then applies the exact documented decisions. The token exists only in this PowerShell process environment and is restored/removed afterward.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $hadToken = Test-Path Env:SONAR_TOKEN
    $previousToken = $env:SONAR_TOKEN
    try {
        if (!$env:SONAR_TOKEN) {
            $secureToken = Read-Host 'SonarCloud token (input hidden)' -AsSecureString
            $env:SONAR_TOKEN = [System.Net.NetworkCredential]::new('', $secureToken).Password
        }
        node scripts/sonar-closeout.mjs
        if ($LASTEXITCODE -ne 0) { throw 'Live preflight failed. No review writes started.' }
        node scripts/sonar-closeout.mjs --apply
        if ($LASTEXITCODE -ne 0) {
            throw 'Closeout stopped. Inspect sonar-closeout-results/summary.json before continuing.'
        }
    } finally {
        if ($hadToken) { $env:SONAR_TOKEN = $previousToken }
        else { Remove-Item Env:SONAR_TOKEN -ErrorAction SilentlyContinue }
    }
}
```

The tool revalidates every issue identity before any write, then rechecks each issue immediately before writing. It adds the specific review comment before applying the decision. It never retries an HTTP write. On a partial/unknown outcome it stops and retains a redacted summary. A rerun reads the actual statuses, skips the desired statuses and skips an already persisted identical comment. A concurrent state/update change stops rather than overwriting another reviewer. Rerun only after inspecting the partial summary. A 401/403 requires correcting the account/token permissions, not weakening the tool.

## Verification and final accounting

`sonar-closeout-results/summary.json` is ignored, contains only issue IDs/results and has no token or server response bodies. `review_actions_completed` means the requested review actions returned the expected statuses. It does not mean no accepted risks or no new issues exist.

After the merged scan and review actions, inspect Sonar's OPEN/CONFIRMED view. Expected outcome for this snapshot: one FIXED, 35 FALSE_POSITIVE, 11 ACCEPTED. Confirm all 47 exact IDs. If any remain open, inspect them rather than adding an exclusion or bulk resolution. The eight previously mentioned dependency-risk details were not included in either issue export and remain separately unverified under SEC-006.

No database migration, data reset, deployment or paid resource is involved. Roll back the source fix with Git if necessary; reopen each reviewed Sonar issue in the UI to undo an external review decision. Git revert alone does not undo Sonar state changes.

## Source references

- SonarCloud issue editing and the distinction between accepted and false positive: https://docs.sonarsource.com/sonarqube-cloud/managing-your-projects/issues/editing
- Exact baseline reconciliation: `docs/quality/sonar-triage-2026-10-24.json`
- Earlier context evidence: `docs/security/SONAR_REVIEW_DISPOSITIONS_2026-10-24.md`
