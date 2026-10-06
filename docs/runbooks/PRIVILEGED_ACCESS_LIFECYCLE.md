# Reviewed privileged access lifecycle

## Boundary and meaning

Normal UI/HTTP controls continue to refuse platform-administration organizations, including their ordinary members. There is no new public privileged-mutation endpoint. The server-console procedure requires two distinct active wildcard platform administrators with separate, valid, freshly signed passkey sessions (less than five minutes old). Organization administrators, certifiers and suppliers cannot approve it. Reviewers cannot approve their own account; for organization decisions neither reviewer can belong to the affected organization.

Supported decisions:

| Target | Decision | Result |
| --- | --- | --- |
| User | suspend | Temporary login block; all sessions, pending reset links/ceremonies and invitations issued by that user revoked; keys preserved |
| User | restore | Clear suspension only; organization must be active, user must not be deactivated; old sessions/invitations never revived |
| User | deactivate | Set active=false; preserve trade/audit records; revoke sessions, keys, reset links, ceremonies and invitations issued by that user |
| Organization | suspend | Block all members; revoke member sessions, reset links, ceremonies, recovery windows and organization invitations |
| Organization | restore | Clear organization hold only; member suspensions/deactivation remain; old sessions/invitations never revived |

Organization deletion/deactivation and user reactivation are excluded. Data-erasure/legal-retention handling needs a separate reviewed policy. Reviewed passkey recovery never clears suspension or active=false. There is no one-admin, email or database-edit fallback when independent reviewers are unavailable.

A disabling decision preserves at least two active, approved, passkey-enrolled wildcard administrators outside the affected target. This is two-account continuity, not proof of two independent humans, separate devices or available operators. Pilot onboarding must establish actual reviewer independence and backup factors. The procedure supports ordinary users too, so deactivation does not bypass the two-reviewer requirement.

## Review preparation

1. Confirm the target UUID, incident/change ticket and intended temporary/permanent effect independently. Reviewers must explicitly agree; do not collect tokens without their consent.
2. Confirm owner identity, least privilege, impact on incident response and backup administrators. For an organization hold, enumerate affected members and commercial consequences.
3. Both reviewers sign in and complete a fresh signed passkey assertion on the configured app origin. Each provides their own current session token over the operator's protected channel. Never send tokens into chat, PRs, logs, command arguments or repository files. Existing sign-in responses contain accessToken; handle it as a session secret.
4. Use the protected server operator console within five minutes. This CLI is not an internet-facing administration service. Tokens are short-lived in this review because assurance expires, even if the underlying login session lasts longer.

## Command contract

Run the compiled/runtime image's TypeScript operator script:

```text
node --import tsx api/scripts/review-privileged-access.ts
```

Provide one JSON object via stdin, never via command-line arguments:

```json
{
  "kind": "users",
  "id": "the-target-user-uuid",
  "action": "suspend",
  "ticket": "SEC_123",
  "reason": "Reviewed account compromise and containment decision",
  "reviewerTokens": ["first-reviewer-session-secret", "second-reviewer-session-secret"]
}
```

The placeholders are not credentials. The target must be a UUID; ticket is 3–100 characters using letters, digits, underscore or hyphen; reason is 10–1000 characters. Unknown fields/actions and organization deactivation fail before accessing identity state. Keep the reason free of secrets or unnecessary personal data. Input is capped at 20KB. Errors produce no raw input, tokens or database messages.

A protected PowerShell operator session can obtain token input without placing it in shell history:

```powershell
$firstSecret = Read-Host "First consenting reviewer session token" -AsSecureString
$secondSecret = Read-Host "Second consenting reviewer session token" -AsSecureString
$reviewInput = @{
  kind = "users"
  id = Read-Host "Target user UUID"
  action = Read-Host "suspend, restore or deactivate"
  ticket = Read-Host "Review ticket ID"
  reason = Read-Host "Reviewed reason (no secrets)"
  reviewerTokens = @(
    ([System.Net.NetworkCredential]::new("reviewer", $firstSecret)).Password
    ([System.Net.NetworkCredential]::new("reviewer", $secondSecret)).Password
  )
}
try {
  $reviewInput | ConvertTo-Json -Compress |
    docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml exec -T api node --import tsx api/scripts/review-privileged-access.ts
  if ($LASTEXITCODE -ne 0) { throw "Decision failed. No bypass; refresh assurance and review the request." }
} finally {
  $reviewInput = $null
  $firstSecret.Dispose()
  $secondSecret.Dispose()
  Remove-Variable firstSecret,secondSecret,reviewInput -ErrorAction SilentlyContinue
}
```

This example is for the local rehearsal Compose files. Production uses the operator's protected deployment console; do not expose server ports or reuse demo identities. Plaintext secrets exist briefly in process memory for stdin transport; do not enable transcripts/debug traces or echo the object. Do not run against real customer targets as a smoke test.

## Verification and operations

Output contains only target UUID, action, changed and revoked-session count. Repeating a completed decision returns changed=false and creates no duplicate audit. Review the committed `access.reviewed.users.*` / `access.reviewed.organizations.*` audit/security event under authorized access, including second reviewer, ticket and revocation counts. Failure rolls back access and revocation together.

The ordinary suspension path, console decisions and passkey recovery share one transaction-scoped advisory lock before identity locks. It is a deliberately serialized low-volume administration boundary, not a lock on every trade. Organization/user/session/key locks recheck reviewer state through commit. Changes serialize with normal session issuance and factor removal; direct database operators remain trusted and must not bypass the procedure.

Run `npm run verify:release`: unit tests cover malformed requests and independent reviewers; PostgreSQL integration tests cover real signed enrollment, stale/revoked/future assurance, organization-admin denial, target isolation, restoration, deactivation, concurrency, audit rollback, recovery non-reactivation and HTTP bypass refusal. Existing browser suspension/passkey journeys remain in the release suite. No lengthy new manual journey is required for this console-only wave. Physical reviewer independence, recovery/incident drill, external notification/alert delivery and hosted operator authorization remain separate pilot gates.
