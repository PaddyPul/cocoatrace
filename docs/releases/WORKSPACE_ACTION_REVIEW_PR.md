# PR title

fix: review custody, certificate and invitation actions and scope trade status badges

# PR body

Certificate status changes, physical custody acceptance and invitation-link replacement/revocation now show the exact target and consequences before submitting. Shared confirmation uses a named native modal, focuses Cancel, supports Escape and disables repeated interaction while processing. Failed writes preserve review. Existing API authorization and business checks remain authoritative.

Trade, goods-payment, payment-terms and transport badges now use separate semantics: accepting a trade or delivering its goods does not present settlement. Missing statuses show Unknown and unrecognized states remain neutral. Adds focused status tests to the frontend release gate and updates browser regressions for deliberate confirmation, cancellation and failed review.

Founder acceptance of the prior draft coverage closes UX-011 at156/343 (45.5%). UX-006/007 remain partial, with remaining offer/recall/custom dashboard coverage documented.

Validation: author quality, workspace/browser types, frontend boundary tests, backlog/risk checks, production web build and unchanged startup budget passed. Browser runtime and full exact-commit release require founder verification before merge. No backend or migration change.
