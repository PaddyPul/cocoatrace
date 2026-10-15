# Production route splitting and initial JavaScript budget

UX-009 acceptance baseline: 2026-10-15, production `npm run build --workspace=web`.

Every page imported by the application router uses `React.lazy`; record pages import their actual module rather than the `DataPages` barrel. The auth, language and toast providers remain mounted above the router's suspense boundary. Existing public, authenticated, onboarding and passkey decisions still wrap each page. The loading fallback exposes `role=status`; rejected module loads reach the existing error boundary and its Reload page recovery action.

Measured initial JavaScript: **221,029 raw bytes; 72,214 gzip bytes; one initial chunk**. Vite emitted 93 manifest entries including 48 dynamic entries. Route dependencies may share chunks; those are fetched when required. These are build transfer sizes, not measured mobile browser timings.

The enforceable initial budget is **92,160 gzip bytes (90 KiB)**, approximately 28% headroom over this baseline. `scripts/check-web-budget.mjs` traverses the production manifest's entry and all transitive static imports, deduplicates emitted assets, and sums their individual gzip byte lengths. Dynamic route imports do not count until navigation. Missing or ambiguous entry manifests fail rather than reporting zero. Tests cover transitive/shared imports, exclusion of lazy downloads, malformed manifests and a genuinely oversized compressed asset.

Run the production build before `npm run check:web-budget`. CI and release verification must run this check after building. Do not increase this budget to accommodate accidental eager page imports; evaluate route and shared dependency changes first. Any deliberate budget adjustment needs measured output and a reviewed justification.

PER-005 remains incomplete: buyer/supplier journeys on representative mobile devices or emulation, interaction/render latency, accessibility and network-performance thresholds still require their own acceptance evidence. The build budget alone does not close those criteria.
