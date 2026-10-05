# Dependency security boundary

Backlog: SEC-014 (partial: image/OS scanning remains open).

`npm run check:dependencies` runs both production-only and complete npm audits. Registry failures, malformed reports, new advisories and expired exceptions fail the command. The full release command and pull-request CI include it. A weekly scheduled workflow records the same report; Dependabot proposes reviewed npm and Docker updates, without automatic merging.

The tool records a summary in `dependency-test-results/summary.json`. Npm advisory information changes independently of the repository; a previously passing revision can fail when a new advisory appears. Recheck the exact finding and affected dependency before selecting an upgrade. Do not use `npm audit fix --force` as a release procedure.

## Current remediation

- Vitest 4.1.11 removes the vulnerable old UI and redirect-mock versions. Tests stay in run mode; do not publish test/UI servers.
- Vite 6.4.3 is pinned consistently so test tooling cannot retain an older vulnerable Vite/esbuild tree.
- React Router DOM 7.18.2 fixes the relevant redirect/RSC advisory ranges while keeping React 18 and the existing declarative BrowserRouter API. Native browser journeys are required before merge.
- Express 4.22.3 resolves patched qs 6.16.0 within its supported dependency range, replacing the vulnerable query-parser version. A regression exercises the hostile constructor parse/stringify case.
- Unused npm crypto, uuid and uuid type packages are removed. Node's built-in crypto imports remain.

## Unpatched build-tool advisory

GHSA-vfj7-8cjw-p6xm has no published braces patch as of 2026-10-05. The complete audit includes braces and its affected parent packages in the Tailwind/build-tool tree. This is one leaf advisory, not several independent vulnerabilities.

The exception in `security/dependency-exceptions.json` is exact advisory/package/version, requires every affected lockfile node to be development-only, and expires at 00:00 UTC on 2026-11-05. Production-only findings can never use it. Inputs must remain trusted repository-controlled patterns; do not accept customer-controlled build patterns or publish build/watch servers. Removing this dependency through a separately tested Tailwind/build migration, or applying an upstream patch, remains required. The exception is an explicit temporary engineering risk decision, not a fix or a claim of zero vulnerabilities.

References:
- https://github.com/advisories/GHSA-5xrq-8626-4rwp
- https://github.com/advisories/GHSA-82fw-gwwq-j7x9
- https://github.com/advisories/GHSA-4mjr-xmp4-gh2g
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-qwww-vcr4-c8h2

Npm production classification is not a scan of actual container contents, OS packages, database, scanner or tunnel images. The API currently retains development tooling for TS maintenance scripts. Image scanning, runtime reduction and supported base-image upgrades remain SEC-014 follow-ups; this wave does not close them or certify production readiness.
