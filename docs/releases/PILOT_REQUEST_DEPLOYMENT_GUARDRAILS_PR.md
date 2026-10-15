# PR title

feat: bound request parsing and document deployment compatibility guardrails

# PR body

## Outcome

Oversized queries fail before ordinary Express parsing, and malformed/oversized JSON produces stable redacted errors. Signed evidence content retains its separate capability and admission checks. Migration and environment runbooks define the conditions required before rolling deployment, rollback or public ingress. The previously merged architecture bundle is reconciled in progress counts.

## Tracking

- Backlog ID(s): ENV-012, ENV-018 closure targets; SEC-010 partial.
- Reconciled acceptance: UX-009, ARC-009, ENV-016.
- Issue/ADR: ADR001/003; runbooks/MIGRATION_COMPATIBILITY.md; runbooks/ENVIRONMENT_INGRESS.md; security/REQUEST_INGRESS_LIMITS.md.
- Target phase/environment: repository/local/CI pilot preparation; hosted acceptance remains open.

## Change summary

- Bound raw query bytes, repeated parameter count, decoded key/value bytes and nesting before existing parser execution; reject rather than truncate.
- Preserve existing 100KiB JSON limit explicitly; distinguish generic request overflow from evidence overflow and return redacted malformed JSON errors.
- Test ordinary repeated/nested query compatibility and boundaries through real Express HTTP requests; retain existing upload/resource gates.
- Publish expand/transition/contract, mixed-version and recovery rules, including older images refusing newly applied ledger names on startup.
- Document actual per-environment origin/cookie/passkey/CORS and ingress behavior, DNS/TLS requirements and proxy trust limitations.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: no authorization relaxation, business mutation or new external call. Request failures do not echo submitted values. Evidence content bypasses JSON parsing even with a JSON MIME claim; existing signed capability, durable rate and transfer-concurrency controls remain. Test-only rate persistence bypass is scoped to the ingress suite. Ordinary-request global admission and deployed load evidence are not claimed.

## Database and deployment

- Migration required: no; frozen assets unchanged.
- Backfill/lock implications: none executed; policy requires explicit bounded backfill and lock rehearsal for future schema changes.
- Rollback or compensation: application changes can be reverted together; no data compensation required. Do not infer that an older image can start against a newer ledger without the rehearsed compatibility procedure.
- Configuration/secrets changed: no new variable, dependency, provider, credential or paid service. Default development ports remain unsuitable for public deployment; no blanket proxy trust is introduced.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [ ] Web production build
- [ ] Staging verification
- Evidence/results: author 1,126 API cases (including 12 ingress HTTP/limit cases) passed; workspace/browser types, API build, quality and authorization/backlog/risk checks passed. Exact-commit full release and required CI remain necessary; enter passing candidate/date and check applicable runtime/build boxes after the run. No hosted, Docker or full browser runtime claim from author checks.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: no UI changes. Generic JSON overflow intentionally changes from evidence-specific error code to REQUEST_BODY_TOO_LARGE; malformed JSON now returns REQUEST_JSON_INVALID. Current limitations copy remains accurate. Global query rejection is not a resource-existence statement or edge DDoS guarantee.

## Follow-up work

- SEC-010/PER-004: ordinary-request simultaneous admission, deployed edge enforcement and capacity evidence.
- ENV-011/009/013/014/017: controlled release migration job, immutable promotion, deployed smoke/stamp readback and deployment concurrency.
- ENV-004/005/006: real isolated/private hosted resources and verified TLS/cookie/origin behavior.
- OPS-009/QLT-017: provider-specific rollback and long-running migration rehearsal. Publishing a policy does not complete those operational exercises.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Founder-accepted prior bundle makes113/343 (32.9%). After policy review/release/merge, ENV-012 and ENV-018 target115/343 (33.5%). SEC-010 stays partial. Core11/28 and provider-inclusive11/40 remain unchanged.
