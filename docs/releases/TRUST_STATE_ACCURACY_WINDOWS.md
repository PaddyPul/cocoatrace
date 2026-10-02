# Trust-state Accuracy v1 — full Windows instructions

This bundle makes new and existing trust claims honest, records independent certificate reviews and audits, and keeps marketplace/passport labels current after expiry or revocation. It preserves inventory, deals and workspace access.

Apply after the Trading Integrity and marketplace remaining-stock corrections have been merged into main. Run each command separately in PowerShell and stop on any failure. Keep Docker Desktop running.

## 1. Check your repository and pull main

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git branch --show-current
git fetch origin
git switch main
git pull --ff-only origin main
```

Tracked changes must be committed or safely preserved before switching. Your local untracked `docker-compose.real-flow.yml` files may remain; do not add them to this release. If Git reports conflicts, stop and share the output. Do not use reset or force push.

## 2. Apply the downloaded bundle

```powershell
git bundle verify "$env:USERPROFILE\Downloads\cocoatrace-trust-state-accuracy-v1.bundle"
git fetch "$env:USERPROFILE\Downloads\cocoatrace-trust-state-accuracy-v1.bundle" "HEAD:refs/remotes/bundle/trust-state-accuracy-v1"
git switch -c fix/trust-state-accuracy-v1
git cherry-pick bundle/trust-state-accuracy-v1
git status
git log -3 --oneline
```

Cherry-pick only the tip commit above; do not merge the bundle's older ancestry. If the feature branch already exists, stop rather than recreate or overwrite it. A successful cherry-pick should leave a clean tracked working tree. No dependencies changed, so reinstalling is not necessary.

## 3. Run automated checks

```powershell
npm test --workspace=api
npm run build --workspace=api
npm run build --workspace=web
npm run typecheck:browser
npm run migrations:verify --workspace=api
npm run test:migrations:docker
npm run test:integration:docker
npm run test:browser:docker
```

Require successful exit codes from every command. Expected unit tests: 159. Full integration suite: 65 tests; full browser suite: 14 tests. Test containers use disposable test databases; keep application volumes intact. The mocked marketplace/trust browser tests check UI behavior; the other identity journeys use the isolated running application. Native integration tests remain necessary for real PostgreSQL transactions and storage/scanner adapters.

Authoring checks passed: units, builds, browser type checking, migration integrity, seven mocked Chromium cases, and 41 supplemental PostgreSQL/WASM cases. Native Docker was unavailable here, so the native suites above and GitHub CI are required before merge. If any test fails, do not continue to push/merge as though it passed; share the full output.

## 4. Start the application

Use the same email-test configuration already used for the previous manual checks:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 100
```

Verify API startup and migration 021 succeeded. Stop on migration errors. No seed/reset command is needed.

## 5. Inspect correction history and trade consistency

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run trust:report
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run trust:report -- --details
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run trade:reconcile
Start-Process "http://localhost:3000"
```

The trust report is read-only. `correctionCount` may be greater than zero: it records unsupported old defaults that were corrected. It does not need to become zero. Trade reconciliation should remain `ok: true`, `issueCount: 0`. If it reports a finding, share it for investigation rather than clearing data.

## 6. Short manual UI check

Use your existing test accounts; this bundle creates no new credentials.

1. As supplier, create a new source farm and plot. They must be supplier-declared, not independently reviewed. Enter a valid latitude/longitude pair; zero is valid. A missing coordinate partner or out-of-range value must be rejected. GPS alone must not produce verified origin or EUDR readiness.
2. Publish conventional inventory. It should remain sellable, without an organic-reviewed badge. Open it as buyer in the marketplace and inspect Supply details / claim sources.
3. Open an existing organic listing. If its certificate is expired, suspended, revoked, mismatched or absent, it must not show organic reviewed. Stored legacy `attested`/`verified` fields must not override the live decision.
4. As supplier, optionally upload an externally issued certificate or supporting PDF against the relevant source/lot using its evidence action. The document must remain distinct from an independently reviewed organic claim. A clean upload must not grant a reviewed badge.
5. As buyer, review the published conventional inventory, submit an offer, and continue the guided supplier acceptance/payment/dispatch workflow. No certifier login is required. Certificate issuance, suspension, reinstatement and permanent-revocation behavior are covered by automated API tests; certifier-account manual checks are optional internal testing only.
6. A clean uploaded PDF is not automatically approved evidence. Origin and EUDR can remain declared/unknown until a real independent review workflow exists; that is expected.
7. Confirm existing deals and the guided payment/dispatch flow still open. Run `trade:reconcile` again if you create/accept a new offer.

These checks verify customer-facing wording and the migrated application. The automated regressions cover the detailed API matrix; you do not need to manually repeat every test.

## 7. Push the feature branch

After all automated checks and the short UI check pass:

```powershell
git status
git push -u origin fix/trust-state-accuracy-v1
git ls-remote --heads origin fix/trust-state-accuracy-v1
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...fix/trust-state-accuracy-v1?expand=1"
```

If HTTPS stalls again, the previously successful HTTP/1.1 option remains available:

```powershell
git -c http.version=HTTP/1.1 push --verbose --progress -u origin fix/trust-state-accuracy-v1
```

No local build output, secrets or untracked Compose overrides need committing; the bundle already contains the implementation commit.

## 8. Create and merge the pull request

On GitHub, sign in to your authorized account. Check **base: main** and **compare: fix/trust-state-accuracy-v1**, click **Create pull request**, and use:

Title: `Fix trust defaults and derive live assurance claims`

Description:

> New farms, plots and evidence no longer inherit independently reviewed status. Migration 021 records unsupported legacy corrections, and certificate issuance/attestation records actual reviewer provenance with transactional audit. Marketplace and passports derive trust from current scoped sources, including expiry, suspension and permanent revocation. Workspace approval remains separate from external verification.
>
> Validation: unit/build/type checks, native migration/integration/browser suites and the short UI smoke test. Correction report reviewed and trade reconciliation clean.

Use that validation paragraph only after you have actually passed those checks. Wait for the GitHub quality gate to pass, including production image builds, integration, browser and migration checks. Resolve any failures before clicking **Merge pull request**, then **Confirm merge**. Do not bypass failed checks. Deleting the remote feature branch after merge is optional.

## 9. Pull merged main and restart

```powershell
git switch main
git pull --ff-only origin main
git status
git log -3 --oneline
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 100
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run trust:report
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run trade:reconcile
Start-Process "http://localhost:3000"
```

Keep correction history. Do not run a database reset or remove volumes. Once native checks, CI and the merged-main smoke test pass, report that result so the backlog release gates can be ticked off. The following wave should harden live trace/recall and add automated journeys for it.
