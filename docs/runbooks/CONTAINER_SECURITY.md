# Container security release gate

SEC-014 remains partial pending native evidence and remaining build-tool/third-party image work.

`npm run check:containers` builds the API and web with fresh base pulls, verifies runtime boundaries and scans actual saved images with Trivy 0.75.0. The same command is in verify:release and CI. It does not require a host Trivy install or expose the Docker daemon socket to the scanner. Temporary image archives are deleted; vulnerability JSON and the summary remain in container-test-results. The named cocoatrace-trivy-cache volume caches public scanner databases only.

High, critical, unknown-severity findings, scanner/download failures, malformed reports, missing OS/API Node inventory and end-of-support OS metadata block the gate. Unfixed findings are not ignored. Low and medium findings remain visible in reports and require triage. The npm build-tool exception is not an image-scanning exception. Do not bypass a failure by disabling scans, using ignore-unfixed or trusting an old report.

## Runtime changes

- API uses Node 24 Alpine build and runtime stages. Only API production dependencies are installed in runtime; root lint and workspace development tools are excluded. tsx is now an explicit runtime dependency because existing migration, demo, recovery and maintenance commands use TypeScript.
- Original migration files, names and manifest checks remain unchanged. Compiled code, database baseline and reviewed TS sources/maintenance scripts remain; test files, type declarations and source maps are removed from runtime.
- Startup invokes installed tsx through node --import, without npx downloading tooling. Tracked Compose/test commands invoke Node directly. Runtime npm, npx, Yarn and Corepack are removed after installation; host npm commands remain available.
- Container demo/test/deployed profiles use structured logs. The pretty formatter is limited to local development. Redaction stays enabled.
- Web build uses Node 24; serving uses nginxinc/nginx-unprivileged:stable-alpine-slim, retains port 3000 and existing API proxy configuration. The config check maps api to loopback only inside its short-lived check container.
- Build contexts exclude local env files, evidence/upload directories, node_modules, dist and Git bundles. Application evidence volumes and database storage are not reset.

## Evidence and remaining work

The authoring environment has no Docker daemon. Author checks prove the production-only dependency install and migration/logger imports, types, units and runner policy; they cannot prove Alpine image assembly, Nginx startup or actual CVE results. Founder and CI must pass check:containers plus migration, integration, browser and restore gates before merge. Reports identify installed versions and CVEs; a new upstream advisory can block the same code later.

Node and Nginx tags are refreshed with build --pull. Promotion of reviewed immutable digests, scanner image digest verification, third-party Postgres/ClamAV/tunnel/storage image inventory, secret/image-misconfiguration scanning, and resolution of the remaining npm build-tool advisory remain separate follow-ups. No whole-platform vulnerability-free claim is made. The web build still has its bundle-size warning.

References:
- https://nodejs.org/en/about/previous-releases
- https://github.com/nginx/docker-nginx-unprivileged
- https://trivy.dev/docs/latest/references/configuration/cli/trivy_image/
- https://trivy.dev/docs/latest/guide/coverage/language/nodejs/

The static web runtime uses the upstream slim variant, omitting optional image-processing modules. The runtime check requires non-root execution, TIFF package absence and a valid nginx configuration before scanning. High/critical findings still block, including newly discovered advisories. No CVE exception is added. Native image build and scan must pass before merge.
