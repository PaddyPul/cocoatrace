# CocoaTrace — Organic Cocoa Provenance Platform

> CocoaTrace is a product identity and safety network for trusted food trade, beginning with Ghana-to-EU cocoa. See the [pilot operating model](docs/PILOT_OPERATING_MODEL.md) and [production release gate](docs/PRODUCTION_READINESS.md).

Web2 provenance platform for the Ghana → Netherlands organic cocoa corridor.

The MVP now also gives traceable lots a public, QR-linked product profile with a
farm-to-fork event feed and live recall status. See
[`docs/FOOD_PROVENANCE_RESEARCH.md`](docs/FOOD_PROVENANCE_RESEARCH.md) for the
research, product audit and recommended roadmap.

The application shell, role navigation and priority workflows follow the
[`UI/UX redesign sprint`](docs/UI_UX_REDESIGN_SPRINT.md), which also tracks the
remaining responsive and accessibility work.

The product strategy and system-wide experience now follow the
[`venture-scale product blueprint`](docs/VENTURE_SCALE_PRODUCT_BLUEPRINT.md):
Control Tower → Products → Trace & Recall, with operational records available
as supporting tools.

---

## Prerequisites

| Tool | Install |
|------|---------|
| **Node.js 18+** | https://nodejs.org |
| **Docker Desktop** | https://docker.com/products/docker-desktop |

That is it. PostgreSQL runs inside Docker — nothing to install locally.

---

## Quick Start

```bash
# 1. Unzip and enter the project
cd cocoatrace

# 2. Run setup  (starts Docker postgres, installs deps, loads demo data)
bash setup.sh

# 3. Start the app
npm run dev
```

Open **http://localhost:3000**

For the shortest investor walkthrough, click **Launch investor demo** on the
login page. This opens a guided Scan → Verify → Respond story and a live,
non-destructive recall calculation using the seeded lot genealogy. The product
requirements audit and talk track are in
[`docs/INVESTOR_DEMO_PRODUCT_AUDIT.md`](docs/INVESTOR_DEMO_PRODUCT_AUDIT.md).

Two public scan demonstrations are seeded:

- `http://localhost:3000/p/akwaaba-cocoa-2026-ready` — clear commercial export lot
- `http://localhost:3000/p/cocoatrace-demo-incident-2026` — isolated demonstration incident

---

## What setup.sh does

1. Checks that `node`, `npm`, and `docker` are available
2. Runs `npm install` in `api/` and `web/`
3. Runs `docker compose up -d postgres` — starts a Postgres 16 container on port 15433
4. Waits for the container to be healthy
5. Applies versioned Knex migrations with `npm run db:migrate`
6. Loads the repeatable demo seed with `npm run db:seed`

`setup.sh` preserves the existing PostgreSQL volume. It does not erase pilot data.

---

## Manual setup

If you prefer to run steps individually:

```bash
# Start postgres
docker compose up -d postgres

# Install dependencies
npm install

# Apply schema + seed
npm run db:migrate
npm run db:seed

# Start app
npm run dev
```

---

## Demo users

All passwords: **Password123!**

| Email | Role | What you can do |
|-------|------|----------------|
| `kwame@farm.gh` | Farmer | Register farms, record harvests |
| `akosua@organiccert.gh` | Certifier | Issue certificates, attest batches |
| `ama@accragold.gh` | Exporter | Manage inventory, listings, contracts |
| `pieter@dutchcacao.nl` | Importer | Browse listings, make offers, confirm payments |
| `kofi@marecargo.gh` | Logistics | Record shipment milestones |
| `ingrid@cocobod.gh` | Regulator | View audit log, all farms, all batches |
| `admin@cocoatrace.io` | Admin | Full access |
| `newbuyer@cocoatrace.io` | New buyer | Start in a genuinely empty buyer organization |
| `newsupplier@cocoatrace.io` | New supplier | Start in a genuinely empty supplier organization |

Click the quick-login pills on the login page — no typing needed.

---

## Pre-loaded demo corridor

- **3 farms** in Ashanti region with 4 plots (C1 intentionally has no GPS — triggers an evidence gap; the incident farm is isolated)
- **2 current EU Organic certificates** issued by OrganicCert Ghana
- **3 harvest batches** — one trade-ready, one needing geolocation, one isolated incident lot
- **4 holdings** across 3 warehouses
- **2 active listings** on the marketplace
- **1 sales contract** — 8,000 kg CIF Rotterdam with Northstar Foods B.V.
- **1 active shipment** — MV Atlantic Bridge, departed Tema on 18 September 2026
- **1 payment request** — €67,200 outstanding
- **1 isolated recall graph** — distributed before the 20 September 2026 incident and never listed for sale

### Deterministic demo scenarios

These commands intentionally reset only a recognized local demo database and
preserve Knex migration history. They refuse to run with `NODE_ENV=production`.

```bash
npm run demo:seed:fresh       # identities only; empty new-customer workspaces
npm run demo:seed:commercial  # coherent sourcing-to-shipment story, no incident
npm run demo:seed:incident    # full commercial story plus isolated recall
npm run demo:validate         # verify quantities, dates, evidence and safety rules
```

`npm run demo:reset` is an alias for the complete incident scenario. Ordinary
`setup.sh` remains non-destructive and never invokes the reset command.
- **3 evidence documents** — certificate, weighing ticket, bill of lading

---

## Testing the workflows

### Full trade lifecycle (Exporter + Importer)

```
Log in as ama@accragold.gh (Exporter)
→ Dashboard  — see inventory, active contract, shipment progress
→ Batches    — click 📋 on any batch to see its live provenance pack
→ Inventory  — split a holding into two lots
→ Listings   — create a new listing on an available holding

Log in as pieter@dutchcacao.nl (Importer)
→ Dashboard  — see available listings with prices and organic status
→ Browse Listings → Make offer on any listing

Log in as ama@accragold.gh again
→ Offers     — accept the pending offer (creates a sales contract)
→ Contracts  → 🚢 Ship — request a shipment on the new contract
```

### Attestation (Certifier)

```
Log in as akosua@organiccert.gh
→ Dashboard  — see "1 batch awaiting attestation"
→ Click Attest → — runs 3 live policy checks against the DB:
   ✅ Certificate active on harvest date
   ✅ Certificate covers this farm
   ✅ Certifier is the issuing organization
→ Attestation is written to DB with SHA-256 provenance hash
```

### Shipment milestone tracking (Logistics)

```
Log in as kofi@marecargo.gh
→ Shipments  — MV Atlantic Bridge currently at "departed"
→ + Record milestone → advance to "arrived"
→ Try going backward — API blocks it:
   "Cannot go from arrived to loaded. Milestones must progress forward."
```

### EUDR and provenance pack

```
Log in as ama@accragold.gh
→ Batches → open the ready 2026 Asante harvest lot
→ Provenance pack shows:
   - 83% completeness (EUDR due-diligence reference missing)
   - 4/6 policy checks passed
   - Chain of custody with hashes
   - Evidence documents with SHA-256 hashes

Log in as pieter@dutchcacao.nl
→ Contracts → Details → Add EUDR ref
→ Pack completeness rises to 100%
```

---

## API reference

Base URL: `http://localhost:3001`

```bash
# Get a token
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ama@accragold.gh","password":"Password123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# Use it
curl http://localhost:3001/batches -H "Authorization: Bearer $TOKEN"
```

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | — | Login → JWT |
| GET | `/me` | ✓ | Current user + permissions |
| GET | `/farms` | ✓ | List farms (scoped by role) |
| POST | `/farms` | ✓ | Register farm |
| GET | `/farms/:id` | ✓ | Farm + plots + certificates |
| POST | `/farms/:id/plots` | ✓ | Add plot |
| GET | `/farms/:id/eudr` | ✓ | EUDR readiness breakdown |
| GET | `/certificates` | ✓ | List certificates |
| POST | `/certificates` | certifier | Issue certificate |
| POST | `/certificates/:id/suspend` | certifier | Suspend |
| POST | `/certificates/:id/revoke` | certifier | Revoke |
| GET | `/batches` | ✓ | List batches |
| POST | `/batches` | ✓ | Record harvest |
| POST | `/batches/:id/attest` | certifier | Attest (policy checks run) |
| GET | `/holdings` | ✓ | List holdings |
| POST | `/holdings` | exporter | Create holding |
| POST | `/holdings/:id/transfer` | ✓ | Request custody transfer |
| POST | `/holdings/:id/split` | ✓ | Split holding |
| POST | `/transfers/:id/accept` | ✓ | Accept transfer |
| GET | `/listings` | ✓ | Active listings |
| POST | `/listings` | exporter | Create listing |
| POST | `/listings/:id/offers` | importer | Make offer |
| GET | `/offers` | ✓ | My offers |
| POST | `/offers/:id/accept` | exporter | Accept → creates contract |
| POST | `/offers/:id/reject` | exporter | Reject |
| GET | `/contracts` | ✓ | My contracts |
| GET | `/contracts/:id` | ✓ | Contract detail + shipment |
| PATCH | `/contracts/:id/eudr` | importer | Add EUDR reference |
| POST | `/contracts/:id/shipments` | exporter | Request shipment |
| POST | `/contracts/:id/payment-requests` | exporter | Create invoice |
| GET | `/shipments` | ✓ | My shipments |
| GET | `/shipments/:id` | ✓ | Shipment + milestone history |
| POST | `/shipments/:id/milestones` | logistics | Record milestone |
| GET | `/payment-requests` | ✓ | Payment requests |
| POST | `/payment-requests/:id/pay` | importer | Confirm payment |
| POST | `/evidence` | ✓ | Upload file (multipart) |
| GET | `/evidence` | ✓ | List evidence |
| GET | `/provenance/batches/:id` | ✓ | Live provenance pack |
| GET | `/audit/events` | regulator | Audit log |
| GET | `/public/products/:slug` | — | Public product profile, journey and safety status |
| GET | `/public/products/:slug/qr.svg` | — | Stable QR code for a published profile |
| POST | `/product-profiles` | batch creator | Create or update a lot profile |
| POST | `/product-profiles/:id/publish` | batch creator | Publish a product profile |
| GET | `/traceability/lots` | batch reader | Source, production and packaging lots |
| GET | `/traceability/lots/:id/trace-back` | batch reader | Required sources for a lot or quantity |
| GET | `/traceability/lots/:id/trace-forward` | batch reader | Descendants, distributions and recipients |
| POST | `/traceability/recall-impact` | recall manager | Multi-lot recall impact preview |
| GET | `/recalls` | recall manager | Recall notices with calculated lot scope |
| POST | `/recalls` | recall manager | Calculate, persist and activate a lot recall |
| POST | `/recalls/:id/resolve` | recall manager | Resolve an active recall |

---

## Database commands

```bash
# View postgres logs
docker compose logs -f postgres

# Connect to the database directly
docker compose exec postgres psql -U cocoa -d cocoatrace

# Useful queries
\dt                          -- list all tables
SELECT * FROM audit_events ORDER BY occurred_at DESC LIMIT 10;
SELECT * FROM harvest_batches;
SELECT * FROM sales_contracts;

# Stop postgres (data is preserved in Docker volume)
docker compose stop

# Restart postgres
docker compose start

# Wipe everything and start fresh
docker compose down -v
bash setup.sh
```

---

## Project structure

```
cocoatrace/
├── api/
│   ├── src/
│   │   ├── app.ts            ← Express application and route composition
│   │   ├── db.ts             ← PostgreSQL connection pool
│   │   ├── middleware/
│   │   │   └── auth.ts       ← Session/bearer verification + permission guard
│   │   └── services/
│   │       └── audit.ts      ← Audit log writer + SHA-256 helper
│   ├── scripts/
│   │   ├── migrate.ts        ← Apply versioned migrations
│   │   ├── seed.ts           ← Non-destructively load db/seed.sql
│   │   ├── demo.ts           ← Guarded scenario reset runner
│   │   └── validate-demo.ts  ← Demo integrity gate
│   └── package.json
├── web/
│   ├── src/                  ← React + TypeScript application
│   ├── vite.config.ts        ← Development server and API proxy
│   └── package.json
├── db/
│   ├── schema.sql            ← Full PostgreSQL schema (25 tables)
│   ├── seed.sql              ← Coherent 2026 Ghana → NL demo corridor
│   └── demo-*.sql            ← Reset and scenario isolation helpers
├── docker-compose.yml        ← PostgreSQL 16 container
├── .env                      ← Environment variables
├── package.json              ← Root: npm run dev starts both API + Web
├── setup.sh                  ← One-command setup
└── README.md
```

---

## Troubleshooting

**Docker not running**
```bash
# Start Docker Desktop, then:
docker compose up -d postgres
```

**Port 5432 already in use** (local postgres running)
```bash
# Option 1: stop local postgres
brew services stop postgresql   # macOS
sudo service postgresql stop    # Linux

# Option 2: use a different port in docker-compose.yml
#   ports: ["5433:5432"]
# and update DATABASE_URL in .env to port 5433
```

**Port 3001 or 3000 in use**
```bash
# Edit .env and change PORT and/or WEB_PORT
# Then restart with npm run dev
```

**"Invalid credentials" on login**
```bash
# Re-run the seed to reset passwords
npm run db:seed
```

**Want to reset all data**
```bash
npm run demo:reset        # guarded local reset to the full coherent demo
npm run demo:validate     # confirm the story is internally consistent
```
