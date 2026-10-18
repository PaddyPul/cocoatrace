# PR title
feat: standardize API failures and protect unsaved workspace entries

# PR description
Manual auth/controller errors previously omitted stable codes, and malformed validation responses could crash frontend error handling. JSON failures now share a bounded, redacted error/code/requestId envelope while preserving status, existing domain codes, Retry-After and safe domain metadata. The shared frontend ApiError retains diagnostic metadata and handles offline failures without automatically replaying writes.

Seven long entry workflows now use a shared accessible route-leave review and best-effort browser unload warning: inventory, farm/plot, harvest, onboarding, sourcing, supply publishing and evidence contribution. Failed saves retain protection; successful saves clear it before redirects. React Router's supported data-router blocker handles in-app/back navigation. Security redirects remain possible. No draft content is persisted or sent by the guard.

Validation: 1,479 API unit tests and 12 shared web-boundary tests passed, as did API/web/browser types, quality, authorization, migration integrity, backlog and risk checks. API/web production builds passed; initial entry92,052 gzip bytes stays within the unchanged92,160-byte budget. Five mocked browser regressions are supplied, execution pending. Native errorEnvelope.integration.test.ts and browser unsavedChanges.spec.ts are supplied; actual database/browser/full release acceptance must run on the candidate. No migration, new package or secret.

Backlog: mark PAY-012 accepted following founder-reported billing release/merge; accepted progress154/343 (44.9%). ARC-023 may close after this release/merge (155/343,45.2%). UX-011 stays partial: reviewed financial/admin forms and same-page editor-close/mobile acceptance remain open. See docs/ux/UNSAVED_CHANGE_COVERAGE.md. This does not claim complete accessibility, OpenAPI or whole-app draft recovery.
