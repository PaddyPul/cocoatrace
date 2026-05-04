#!/bin/bash
# CocoaTrace — Setup script
# Uses Docker for PostgreSQL, Node for API and Web

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

export DATABASE_URL="${DATABASE_URL:-postgresql://cocoa:cocoa_dev@localhost:15433/cocoatrace}"
export JWT_SECRET="${JWT_SECRET:-cocoatrace_dev_secret_change_in_production}"
export PORT="${PORT:-3001}"
export WEB_PORT="${WEB_PORT:-3000}"
export WEB_URL="${WEB_URL:-http://localhost:3000}"

echo ""
echo "🫘 CocoaTrace Setup"
echo "==================="
echo ""

check() {
  if ! command -v "$1" &>/dev/null; then
    echo "❌ Required: $1 not found. Please install it first."
    exit 1
  fi
  echo "✓ $1 found"
}

check node
check npm
check docker

echo ""
echo "📦 Installing dependencies..."
npm install --silent
echo "✓ Dependencies installed"

echo ""
echo "🐳 Starting PostgreSQL in Docker..."
docker compose down -v --remove-orphans 2>/dev/null || true
docker compose up -d postgres

echo -n "   Waiting for Postgres"
for i in $(seq 1 40); do
  if docker compose exec -T postgres pg_isready -U cocoa -d cocoatrace -q 2>/dev/null; then
    echo " ✓"
    break
  fi
  printf "."
  sleep 1
  if [ "$i" -eq 40 ]; then
    echo ""
    echo "❌ Postgres did not become ready. Run: docker compose logs postgres"
    exit 1
  fi
done

echo ""
echo "⚙️  Applying schema..."
docker compose exec -T postgres psql -U cocoa -d cocoatrace < "$ROOT/db/schema.sql"
echo "✓ Schema applied"

echo ""
echo "🌱 Loading seed data..."
docker compose exec -T postgres psql -U cocoa -d cocoatrace < "$ROOT/db/seed.sql"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Start the app:"
echo "  npm run dev"
echo ""
echo "  API  →  http://localhost:3001"
echo "  Web  →  http://localhost:3000"
echo ""
echo "Database commands:"
echo "  docker compose stop       stop postgres (keeps data)"
echo "  docker compose start      restart postgres"
echo "  docker compose down -v    wipe all data and start fresh"
echo ""
