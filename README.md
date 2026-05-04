# CocoaTrace — Organic Cocoa Provenance Platform

Web2 provenance platform for the Ghana → Netherlands organic cocoa corridor.

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

---

## What setup.sh does

1. Checks that `node`, `npm`, and `docker` are available
2. Runs `npm install` in `api/` and `web/`
3. Runs `docker compose up -d postgres` — starts a Postgres 16 container on port 5432
4. Waits for the container to be healthy
5. Applies `db/schema.sql` via `node api/scripts/migrate.js`
6. Loads `db/seed.sql` via `node api/scripts/seed.js`

---

## Manual setup

If you prefer to run steps individually:

```bash
# Start postgres
docker compose up -d postgres

# Install deps
cd api && npm install && cd ..
cd web && npm install && cd ..

# Apply schema + seed
node api/scripts/migrate.js
node api/scripts/seed.js

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

Click the quick-login pills on the login page — no typing needed.

---

## Pre-loaded demo corridor

- **2 farms** in Ashanti region with 4 plots (P3 intentionally has no GPS — triggers EUDR warning)
- **2 EU Organic certificates** issued by OrganicCert GH
- **3 harvest batches** — 2 attested, 1 awaiting attestation
- **4 holdings** across 3 warehouses
- **2 active listings** on the marketplace
- **1 sales contract** — 8,000 kg CIF Rotterdam with DutchCacao B.V.
- **1 active shipment** — MV Cape Harmony, currently at "departed" Tema Port
- **1 payment request** — €98,400 outstanding
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
→ Shipments  — MV Cape Harmony currently at "departed"
→ + Record milestone → advance to "arrived"
→ Try going backward — API blocks it:
   "Cannot go from arrived to loaded. Milestones must progress forward."
```

### EUDR and provenance pack

```
Log in as ama@accragold.gh
→ Batches → click 📋 on GH-2024-0847
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
│   │   ├── index.js          ← Express API — all routes (~800 lines)
│   │   ├── db.js             ← PostgreSQL connection pool
│   │   ├── middleware/
│   │   │   └── auth.js       ← JWT verify + permission guard
│   │   └── services/
│   │       └── audit.js      ← Audit log writer + SHA-256 helper
│   ├── scripts/
│   │   ├── migrate.js        ← Apply db/schema.sql
│   │   └── seed.js           ← Load db/seed.sql
│   └── package.json
├── web/
│   ├── public/
│   │   └── index.html        ← Complete frontend, single file, no build step
│   ├── server.js             ← Express static file server
│   └── package.json
├── db/
│   ├── schema.sql            ← Full PostgreSQL schema (25 tables)
│   └── seed.sql              ← Ghana → NL demo corridor data
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
node api/scripts/seed.js
```

**Want to reset all data**
```bash
docker compose down -v    # removes the postgres volume
bash setup.sh             # rebuilds from scratch
```
