# Pilot evidence and native fixture foundations

## Repository claim review

The architecture/security overview explains the current modular monolith and trust boundaries using source links. It is an engineering overview, not a hosted assurance certificate, legal review or independent audit. The current-versus-roadmap matrix links23 capabilities to existing backlog acceptance and files. Current means founder-reported local release/merge acceptance of those criteria; it does not prove hosted operation or an investment valuation.

To change a claim, inspect implementation and relevant acceptance first. Edit docs/investor/capabilities.json, then explicitly run `node scripts/pilot-evidence.mjs --write`. Run `npm run check:pilot-evidence` before commit. Release and CI reject missing/unsafe evidence paths, unknown backlog IDs, unsupported current claims and stale generated output. Windows CRLF is equivalent to LF. Generated Markdown must not be edited directly. These checks validate traceability and classification, not whether every statement is semantically complete or every edge case is safe.

Hosted isolation, pilot corridors/legal approval, partner usage, full outbound lifecycle emails, independent security review, complete translation, representative load and registered logistics-provider marketplace remain separately tracked. Do not combine a code completion percentage with a valuation target or imply manual provider details mean verified-provider onboarding exists.

## Typed PostgreSQL fixtures

api/test/integration/support/fixtures.ts provides createActor, createSupply, createListing, createOffer, createContract and createShipment. Every write entry guards TEST_DATABASE_URL/DATABASE_URL with requireDisposableTestDatabase before SQL or input dereferencing. Actors receive a unique verified organization, user, explicit role assignment and real HTTP login. No fixed identity, demo seed or privileged-session bypass is used. Defaults supply required physical source, location, currency and Incoterm fields; overrides are typed and positive quantities/prices are checked.

Transport timing, dispatch acknowledgement and notification native suites now share these builders while retaining their scenario assertions, lock/conflict/audit failure checks and disposable rate-counter isolation. The new fixture contract suite checks unrelated actors, linked mandatory values, live permission reduction and refusal for production-like database URLs.

These builders set up database state for targeted scenarios; inserting a contract fixture is not evidence that offer acceptance, reservation or custody settlement succeeds. Use real application operations in tests of those business transitions. Do not use helpers in production scripts, apply global database resets, bypass the guard or migrate every existing suite merely to reduce duplication. Incremental adoption should preserve scenario intent and meaningful negative coverage.

## Verification and deployment

No production business behavior, routes, migrations, secrets or dependencies change. A new check:pilot-evidence script gates release/CI before runtime tests. Native suite selection accepts one suite filename per invocation, or none for all; do not pass multiple suite names together. Full exact-commit release and required CI remain mandatory before merge. The API runtime has no npm/npx; normal Node startup migrates if needed. Preserve founder stashes, local Compose overrides and output logs.
