# CocoaTrace environments

CocoaTrace has five explicit application environments. `APP_ENV` controls application safety rules; `NODE_ENV` remains available to Node tooling and dependency optimizations.

| Environment | Intended data | Demo controls | Security posture |
| --- | --- | --- | --- |
| `development` | local developer data | off by default | local HTTP and development secret allowed |
| `test` | disposable automated-test data | off | isolated database required by the test harness |
| `demo` | synthetic, resettable demonstration data | explicitly enabled | must never contain customer data |
| `staging` | synthetic or approved test data | off | HTTPS, secure cookie and strong secret required |
| `production` | real customer data | prohibited | fails startup on insecure configuration |

## Local demo

`setup.sh` creates `.env` from `.env.demo.example` on first setup. Demo reset commands require `APP_ENV=demo` and `DEMO_MODE=true`. The frontend independently requires `VITE_DEMO_MODE=true` at build or development-server startup; this prevents a runtime API setting from accidentally exposing seeded credentials in a production web bundle.

```bash
bash setup.sh
npm run dev
```

The Docker Compose file is also an explicitly local demo stack. It builds the web UI with demo controls enabled and runs the API with `APP_ENV=demo`. API startup applies migrations but does **not** seed or reset data. Initialize a fresh demo deliberately:

```bash
docker compose up -d postgres
docker compose run --rm api npx tsx api/scripts/demo.ts incident
docker compose up -d
```

## Staging and production

Do not deploy `docker-compose.yml`. Supply environment-scoped secrets and infrastructure configuration through the hosting platform. At minimum:

- `APP_ENV=staging` or `APP_ENV=production`
- `DEMO_MODE=false`
- a unique `JWT_SECRET` of at least 32 characters with no placeholder wording
- `DATABASE_URL` and the appropriate TLS settings
- exact HTTPS `WEB_URL` and `PUBLIC_WEB_URL` values
- `COOKIE_SECURE=true`
- `APP_VERSION` set to the immutable release identifier
- both `OPENAI_API_KEY` and `OPENAI_MODEL`, or neither

Invalid deployed configuration terminates startup before the server accepts traffic. Production additionally rejects demo mode. Seed and demo-reset scripts reject staging and production.

Databases, object-storage buckets, secrets and service identities must be separate for demo, staging and production. Completing that infrastructure is tracked by `ENV-004` and is not implied by this configuration layer.

The evidence-dependency incident and immutable-image rollback sequence is documented in [`runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md`](runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md). It must be adapted to the selected hosting provider and exercised in staging before it counts as an operational control.
