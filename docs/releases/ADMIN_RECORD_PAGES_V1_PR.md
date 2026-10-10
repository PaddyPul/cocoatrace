# PR title

Bound administration histories and isolate tenant organization access

# Replacement PR description

## Outcome

Administration screens stay searchable beyond page one without displaying failed reads as empty membership or invitation history. Tenant organization administrators see their own directory; only the platform wildcard administrator can browse every organization.

## Tracking

- Backlog IDs: PER-001 / ARC-024 (focused slices; broad items remain IN PROGRESS)
- Issue/ADR: docs/DELIVERY_BACKLOG.md; docs/runbooks/ADMIN_RECORD_PAGES.md
- Target phase/environment: pre-pilot local release, then staging

## Change summary

- Add authorized organization, member and invitation pages, literal search, scoped cursors and complete aggregate totals.
- Extract the organization screen into a focused component; show member read failures/retry instead of empty membership.
- Migrate invitations from a silently truncated 100-row array to searchable pages; preserve create/resend/revoke and full lifecycle totals.
- Bound legacy arrays before hydration; oversized complete reads fail explicitly.
- Use explicit metadata projections and no-store responses; omit organization legal/operator fields, password data and invitation tokens/hashes.
- Record founder acceptance of sourcing pages and label correction.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: organization.admin is local scope; wildcard is network scope. Members/invitations remain tenant scoped unless wildcard. Cursor binds authority and filters. Mutation authorization, token rotation/single-use and audit/email delivery stay authoritative; this wave changes reads/presentation. Search never exposes token hashes.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none
- Rollback or compensation: revert matching API/UI together; no data conversion. Do not restore global tenant directory exposure as an incidental rollback.
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 693 API unit assertions passed. Quality, workspace/browser types, API/web builds, strict compilation of both new integration files, migration integrity and backlog checks passed. Added 11 PostgreSQL regression cases and 6 browser cases; Docker/PostgreSQL/browser execution unavailable author-side. Tick integration/E2E only after exact-candidate verify:release passes, append SHA/report, and require GitHub CI before merge.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work

- PER-001 / ARC-024: pilot-feedback and remaining embedded collection boundaries.
- PER-003 / PER-004: file concurrency and representative hosted capacity/query-plan acceptance.
- Review administrative create/write permission contracts separately; this wave changes read scope.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Candidate pending exact release and merge/pull acceptance; broad items remain open.
