# Language foundation

This slice translates the signed-in workspace shell: navigation, page headers/descriptions, account navigation controls and permission-filtered command search. English is the default and French is the first additional engineering catalog. The selector explicitly says **Navigation only**. Trade forms, guided dashboard decisions, onboarding, public identity screens, API errors and outgoing emails remain English. This is not a claim that the full app or legal documents are translated.

## Boundaries and ownership

- `web/src/i18n/catalogs.ts`: stable named English/French message catalogs. French keys must cover every shell key. React renders strings as text; no HTML injection or external translation service.
- `locale.ts`: English fallback, supported-language validation, device preference storage and pure display helpers. Unknown keys can supply an explicit fallback; inherited object properties cannot become translations.
- `LanguageProvider.tsx`: account-keyed context, browser document language and selector. Remounting on identity changes prevents another account inheriting session state. Existing permission checks and routes remain authoritative.
- Preferences are saved to `ct_language_v1:<user UUID>` in localStorage. They contain only `en` or `fr`, no credentials. They are device-specific, not server preferences. Anonymous browsing has a separate key. Storage failures apply the selection for the session and display a notice; reloading defaults to English when storage is inaccessible.
- The untranslated page body is explicitly `lang="en"` for assistive technology. A future translated page should override this with its locale. Contracts, quantities, currencies, user content and source documents are not rewritten.
- New display helpers accept canonical values and explicit currency precision snapshots. They do not parse localized commercial input, convert currency, determine payment gates or replace exact server-side money arithmetic. Dates accept only validated ISO calendar dates and format in UTC to prevent date shifts.

## Automated checks

`npm run test:locale` validates catalog parity/fallback, unsupported preferences, denied storage, account separation, French/English separators, historical two-decimal JPY and ISO date rejection. It is required by `npm run verify:release`.

`e2e/languageFoundation.spec.ts` uses actual approval/onboarding identities and the real UI. Buyer and supplier tests select French, reload, search in French, navigate to contracts, sign out, create a different account and confirm its English default, then sign back into the original account. A separate test blocks language storage and verifies the notice/fallback. These tests run in the existing disposable Docker browser suite. No manual end-to-end trade replay is required for this change.

## Remaining work

LNG-001: select actual pilot languages with design partners and persist preferences on the server with self-only authorization and cross-device tests. LNG-002: add stable backend message/action keys and translate whole buyer/supplier trade journeys, forms, API errors and identity flows. LNG-003: localize actual recipient emails and integrate display helpers throughout financial/quantity/date views; design strict localized numeric entry without ambiguous parsing. LNG-004 retains original authoritative contract/document language. LNG-005 requires human linguistic review, responsive/long-text and RTL/accessibility validation. French is an initial engineering choice, not completed pilot validation.

Rollback: revert this frontend commit and rebuild. No database migration, data rewrite, secret, service or provider configuration is introduced. Removing the preference keys is optional; leaving them is harmless to the English-only previous application.
