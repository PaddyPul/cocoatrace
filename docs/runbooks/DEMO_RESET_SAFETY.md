# Explicit synthetic demo reset

ENV-016 covers the existing explicit demo reset job. It is never a startup task. Reset permanently replaces the selected local synthetic demo scenario; do not use it on customer records. Ordinary application start, public sharing stop and production migration never invoke it.

`npm run demo:reset` explicitly selects the incident scenario through api/scripts/demo.ts. The API host script calls assertDemoResetAllowed before constructing the pool or running reset SQL. The guard unconditionally rejects APP_ENV staging/production, even if DEMO_MODE is true or a legacy override was supplied. Other profiles require DEMO_MODE true and a simple postgres/postgresql URL on localhost/127.0.0.1/[::1] with database cocoatrace, cocoatrace_demo or cocoatrace_test. Query parameters and fragments are forbidden: driver options can override an apparently local URL host. Remote targets and unrecognized names cannot be bypassed by COCOATRACE_ALLOW_REMOTE_DEMO_RESET; that legacy setting/argument is retained for parsing compatibility only and no longer grants a reset exemption.

Only run after confirming the configured profile and connection identify your disposable local synthetic database. The label/localhost rule does not inspect data or turn real records into demo records. Keep demo resources isolated. No reset is run as part of this bundle handoff or release tests.

For the hardened API container, npm/npx are intentionally absent. A reviewed operator who has deliberately configured a local synthetic target uses Node maintenance directly:

```
node --import tsx api/scripts/demo.ts incident
```

Docker service addresses such as postgres are not loopback and are intentionally refused by this command. Use the host command against a known local published disposable demo DB; do not weaken the guard to make a staging or remote target pass. Public preview retains its separate synthetic setup; stopping sharing preserves data, and this change does not add a remote preview-reset capability.

Regression sources: api/src/demoDataGuard.test.ts tests both blocked deployment profiles with both override values, disabled demo mode, remote/unrecognized targets, host/service/options query overrides, scheme/fragment rejection and allowed loopback IPv6. Existing demo transaction rolls back failed resets, but no production/staging reset rehearsal is permitted or claimed.
