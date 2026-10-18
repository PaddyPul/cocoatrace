# PR title
feat: protect long-form drafts and review same-page discards

# PR description
Leaving an entry route was guarded, but financial reviews, recovery decisions and parent record/filter changes could still discard work. This bundle extends the shared guard across the inventory in docs/ux/UNSAVED_CHANGE_COVERAGE.md and adds one accessible review before same-page close/reset/context loss. Stay retains values; successful writes clear only the submitted section; failures and refresh keep edits. Loaded defaults do not trigger warnings. No draft content is persisted or sent by the guard.

Financial/delivery/transport, recall, operations/access/team/document/support, offer/publication/source/certificate and public access-application forms are covered. Parent listing refresh retains forms through transient failure but clears retained rows on access denial. Evidence type/record switches review discarded file/explanation context. Security navigation remains available. Business permissions, MFA, payment/recall/dispatch gates and APIs are unchanged; no migration or dependency changes.

Validation: API/web/browser types, quality, production web build, unchanged startup budget (92,089/92,160 gzip bytes),12 shared transport/environment tests and backlog/risk checks passed. New record/recovery browser fixtures and expanded existing failure/refresh/payment/transport/admin tests are supplied; actual browser and full release execution remains pending. No universal accessibility or crash-draft recovery claim.

Backlog: founder acceptance of ARC-023 is recorded (155/343,45.2%). UX-011 is the closure candidate after full release/merge (156/343,45.5%). UX-006 and device-wide accessibility remain separately open.
