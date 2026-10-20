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

Use the full local Compose stack from the repository root. Preserve an existing `.env`; on a fresh checkout, copy `.env.demo.example` to `.env` first. The frontend independently requires `VITE_DEMO_MODE=true` at build time; an API setting alone cannot expose demo controls in a production web bundle.

```bash
test -f .env || cp .env.demo.example .env
docker compose up -d --build
docker compose ps
```

Wait for PostgreSQL, ClamAV and the API to become healthy. Initial scanner signature loading can take several minutes. The API applies migrations at startup but does **not** seed or reset data. Only for a new, isolated synthetic demo database, initialize example records explicitly:

```bash
docker compose exec -T api node --import tsx api/scripts/seed.ts
```

Open `http://localhost:3000`. The hardened API image has no npm/npx; use its documented Node entry points. Default Compose ports are published and this stack must not be exposed as a public pilot. `docker compose stop` preserves volumes; never reset customer data to resolve startup or login failures.

For host development, use `.env.example`, install with `npm ci`, configure the required services, apply migrations with `npm run db:migrate`, then use `npm run dev`. Root `.env` takes precedence over `api/.env`. Development scanner/storage modes are not deployed assurance. The older `setup.sh` starts only PostgreSQL while its demo template expects ClamAV; use the full Compose path above for an evidence-ready synthetic demonstration.

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

Provider-independent staging preparation is documented in [`runbooks/STAGING_PREPARATION.md`](runbooks/STAGING_PREPARATION.md). Use `.env.staging.example` as a secret-key inventory and run `npm run check:staging` only with the selected host's staging variables injected. `npm run verify:release` runs the isolated repository release gates through one command. Neither command provisions cloud infrastructure.
