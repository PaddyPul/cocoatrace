# PR title

fix: recover workspace detail reads and improve shared keyboard interaction

## Outcome

Users can retry failed detail reads without misleading empty/clear states or replaying writes. Shared search, mobile navigation and feedback expose named controls and contained keyboard focus.

## Changes

- Explicit contract/payment/transport read retries and permission-error regressions.
- Source detail retry/stale/malformed response handling; independent batch product identity loading/error/absence and post-publication refresh handling.
- Product safety validation with retained holds overriding contradictory clear status.
- Named keyboard-safe shared native dialogs, linked feedback fields/pressed ratings, active navigation and skip-to-main.
- Record acceptance of the prior seven-item sprint at164/343 and define35 evidence-gated targets across multiple batches.

## Validation

Author quality, workspace/browser types, frontend boundary tests, backlog/risk checks and production build/budget. Focused mocked failure/keyboard suites supplied and automatically included in browser CI/release. Actual browser/native/full release must pass in founder environment before push/merge. No backend or migration change.

## Remaining work

Sprint goal199/343 (58.0%), +10.20 percentage points across multiple bundles. This first batch does not claim35 closures or universal error/accessibility/device coverage. Whole-route retention/empty-state audit, actual keyboard/mobile-browser acceptance, typed architecture, requirement policy and private operational evidence remain in the linked sprint plan. Legal/customer/hosted decisions are not inferred from code.
