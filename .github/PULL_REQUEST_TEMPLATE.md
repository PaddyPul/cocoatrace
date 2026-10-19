## Outcome

Describe the customer, safety or engineering outcome—not only the files changed.

## Tracking

- Backlog ID(s):
- Issue/ADR:
- Target phase/environment:

## Change summary

-

## Security and data review

- [ ] Resource authorization and unrelated-tenant behavior considered
- [ ] Sensitive/commercial/personal data exposure considered
- [ ] Retry, idempotency and concurrency considered
- [ ] Audit/outbox behavior considered
- [ ] File, URL or external-input handling considered where applicable
- Notes:

## Database and deployment

- Migration required: yes/no
- Backfill/lock implications:
- Rollback or compensation:
- Configuration/secrets changed:

## Defect regression

- Defect severity: none / P0 / P1 / P2
- Confirmed P0 register ID (if applicable):
- Regression test and failure behavior:
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [ ] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [ ] API build/typecheck
- [ ] Web production build
- [ ] Staging verification
- Evidence/results:

## Product and operations

- [ ] User-facing states and errors are clear
- [ ] Logs/metrics redact secrets and identify failures
- [ ] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [ ] No unsupported product claim introduced

## Follow-up work

List follow-ups with backlog IDs. “None” is acceptable only after checking.

## Backlog update

- [ ] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

