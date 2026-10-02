# Zero-cost supervised synthetic preview

This is a temporary demo on the founder's existing computer. It is not live staging or production. No cloud account, domain purchase, paid AI key or SMTP account is required. Cloudflare Quick Tunnels currently provide temporary HTTPS and documented `--allowed-mail` visitor authentication. The runner checks the downloaded image supports that flag and stops if it cannot prove an unauthenticated request reaches an access gate.

## Commands

- `npm run demo:preview:start`: generate independent preview secrets once; start dedicated PostgreSQL, real ClamAV scanner, private local evidence storage, API and frontend; initialize synthetic identities once and run readiness/login/logout checks.
- `npm run demo:preview:check`: automatically check local readiness, frontend, buyer and supplier identity lifecycles.
- `npm run demo:preview:share -- --emails "owner@example.com,guest@example.com"`: require exact allowed email addresses, start restricted tunnel, update public-link origin and secure-cookie configuration, verify access gate and print the temporary HTTPS URL. Remains in the foreground; Ctrl+C stops sharing. Automatic stop after two hours while this process is running.
- `npm run demo:preview:status`: show only this project's services and configured origin.
- `npm run demo:preview:stop`: stop this project and public tunnel, retaining synthetic records and private evidence.

Local URL: http://127.0.0.1:14000. Synthetic buyer: newbuyer@cocoatrace.io; supplier: newsupplier@cocoatrace.io; demo passwords: Password123!. Use the New buyer/New supplier buttons. These are shared synthetic identities, not individual customer accounts. Create demo conventional inventory and follow the existing automated-tested trade workflow; no inherited operational mock records are included at first start.

## Boundaries

Only the frontend binds to the host, on loopback. Database, API, scanner and evidence storage have no published ports. Dedicated Compose project `cocoatrace-demo-preview` and its own volumes do not reuse the normal app or test databases. The guarded fixture initializer refuses production/staging, other hosts/database/users, disabled demo mode, and an unmarked nonempty database. No developer .env, OpenAI key or external SMTP credentials are passed to this stack.

Secrets are generated in ignored `.demo-preview/environment.json`. Retain this directory for restarts: deleting it while keeping volumes breaks database credentials. It is excluded from Docker build context. Do not upload it or share it. There is deliberately no automatic reset/delete command. To start a separate fresh demo later, design an explicitly reviewed reset rather than point seed scripts at application databases.

The persistent banner requires synthetic records, simulated payments and no personal data or real documents. All selected visitors share these accounts and data, and may use other synthetic demo roles. Invite only the intended small audience; this is a supervised walkthrough, not customer enrollment. Upload only disposable test PDFs/images; real malware scanning stays enabled.

Start stops an existing tunnel before switching back to localhost. Share stops the previous tunnel before opening a new one. The allowlist requires 1–10 exact addresses, with no wildcard domains. Email PIN delivery belongs to Cloudflare, not CocoaTrace's disabled demo email driver. If the image does not support the documented gate, do not drop the flag; keep the local preview and report the blocker.

Keep the share terminal open and the PC awake. Stop with Ctrl+C or the stop command from another terminal. The timer cannot enforce expiry after an abrupt host-process crash; explicitly stop the preview if its terminal closes unexpectedly. After stop, the old URL no longer exposes the workspace. Restart creates a different URL and updates generated app links. The configured URL shown by status may be stale after stop; service status determines whether it is live.

No uptime guarantee or static address is promised. The machine, electricity and internet connection are supplied by the founder. No app email delivery, managed cloud backups, object-store replication, FX settlement or real money transfer is claimed. Cloudflare access, Docker Hub availability and first-time scanner signature downloads still require internet access.

## Verification

`npm run verify:release` retains the existing automated product gates and now includes preview command-boundary tests. CI's `synthetic-preview` job exercises actual Docker startup, a repeated start and automated readiness/login/logout checks, then stops its own preview project. Only the provider's real email PIN interaction needs a short external visitor check: allowed email reaches the app; an unlisted email cannot. This does not replace individual-app tenant authorization tests.

Authoring: 173 API unit tests, nine Node runner tests, API/web builds, browser type checks and Compose parsing passed. PostgreSQL WASM checks passed both the previous logical restore regression and fresh-preview seed/identity/inventory compatibility. Native preview containers and real Cloudflare authentication cannot be exercised in the authoring environment; require native CI and the first local start/share before marking BST-001 complete.

Official provider documentation checked 2026-10-02: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
