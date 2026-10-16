# PR title

feat: introduce BetterTrade identity with compatibility and agreement safeguards

# PR body

## Outcome

Customers see BetterTrade in the web identity, metadata and current transactional email templates. Trade agreement presentation identifies the unsigned platform record without denying the recorded commercial terms or promising a legal outcome. Existing installations retain database, volume, session, preference, evidence/link, repository and export identities. A required compatibility guard catches accidental global renaming before infrastructure checks.

## Tracking

- Backlog ID(s): BRD-001, BRD-002, TRD-016 closure targets; PRD-001 partial claim cleanup.
- Reconciled acceptance: PRD-002/005/009/012 from the corrected founder-reported release/merge.
- Issue/ADR: branding/BETTERTRADE_COMPATIBILITY.md; branding/compatibility-v1.json.
- Target phase/environment: customer presentation and local/CI compatibility; BRD-003 internal migration and BRD-004 domain/legal approval remain separate.

## Change summary

- Rename web/auth/onboarding/public presentation and title/description metadata; update current identity, overdue-payment and recall email copy. Qualify sourcing and transformation language.
- Preserve established identifiers through a reviewed 23-anchor versioned inventory and mandatory release/CI check, with tests for accidental cookie/volume replacement and stale customer copy.
- Use trade agreement wording in customer headings/navigation/download presentation; state that signatures are not captured by this platform record and its legal effect depends on applicable terms/law.
- Add buyer/supplier × English/French brand/preference/cookie/trade-view browser matrix, public access metadata and unsigned agreement/export regression definitions.
- Keep route, API/DB/audit names, existing export payload/filenames and historical messages/documents intact.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: no policy/session/tenant authority is broadened. JWT issuer/audience, cookie reader/writer, passkey RP origin and storage pointers remain unchanged. Email recipients, categories, configured-origin token URLs and sender identities stay unchanged; no historical outbox/audit rewrite or real message send occurs in author checks. A branding/source guard does not prove deployed resource retention or independent verification. No new legal entity, domain availability, regulated service, certification or signature claim.

## Database and deployment

- Migration required: no; frozen assets unchanged.
- Backfill/lock implications: none; no volume rename, object movement, data rewrite or reset.
- Rollback or compensation: revert presentation/guard code together; existing data, token URLs and historical records remain usable. No destructive compensation.
- Configuration/secrets changed: no dependencies, credential/domain/sender change or paid provider. Existing Compose project/directory and npm commands must be retained; terminal package names can still say cocoatrace. Do not change COMPOSE_PROJECT_NAME or use down -v.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 1,142 API cases, five branding/compatibility tests, frontend HTTP/environment and locale tests, release gate contracts, quality, types/builds and initial JavaScript budget passed. Captured identity email tests verify new subjects and unchanged recipients/categories/token URLs. Browser definitions compile; Chromium and Docker are unavailable on author host. Exact-commit full release and required CI must pass before merge, including real auth/passkey/trade, fresh/upgrade and backup/restore suites. Enter passing SHA/date and CI link and check applicable runtime boxes after that run.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: legal effect is qualified; no signature feature is added. New branding matrix checks both shell locales, not a claim of fully translated trade workflows. Existing legacy filenames, package/diagnostic namespaces and configured sender domains remain intentionally compatible. Domain ownership or independent organizational verification does not follow from this rename.

## Follow-up work

- BRD-003: separately reviewed aliases/data/session/object migration before any internal identifier or domain move.
- BRD-004: founder approval of name/domain/legal availability before public launch; no availability research or professional legal review asserted.
- LNG/UX/PER: complete translation/human QA, mobile/accessibility and hosted performance evidence.
- PRD-001: complete global unsupported-claim/dead-control/demo-data inventory remains open; selected copy cleanup is not full closure.
- Hosted ENV/OPS/SAF gates and logistics-provider marketplace remain separate.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Corrected founder workspace acceptance yields119/343 (34.7%). BRD-001/002 and TRD-016 target122/343 (35.6%) after review/full release/merge. Core11/28 and provider-inclusive11/40 are unchanged; roadmap closure is not a pilot safety or valuation metric.
