#!/usr/bin/env bash
# Run from a reviewed checkout: sudo -n bash deploy/oracle-demo/deploy.sh first
set -euo pipefail
umask 077

[[ $EUID == 0 ]] || { echo 'Run this script with sudo -n bash.' >&2; exit 1; }
if [[ ${BT_ORACLE_LOCKED:-} != true ]]; then
  exec 8>/run/lock/bettertrade-demo-deploy.lock
  flock -n 8 || { echo 'Another deployment is running.' >&2; exit 1; }
fi
bt_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$bt_root"
bt_git=(git -c "safe.directory=$bt_root")
bt_sha="$("${bt_git[@]}" rev-parse HEAD)"
[[ $bt_sha =~ ^[a-f0-9]{40}$ ]] || exit 1
bt_main="$(git ls-remote https://github.com/PaddyPul/cocoatrace.git refs/heads/main | cut -f1)"
[[ $bt_sha == "$bt_main" ]] || { echo 'Deploy only the current accepted main commit.' >&2; exit 1; }
bt_runs="$(curl --fail --silent --show-error --connect-timeout 10 --max-time 30 \
  -H 'Accept: application/vnd.github+json' \
  'https://api.github.com/repos/PaddyPul/cocoatrace/actions/workflows/ci.yml/runs?branch=main&event=push&per_page=30')"
bt_ready="$(jq -r --arg sha "$bt_sha" '
  [.workflow_runs[] | select(.head_sha == $sha and .event == "push" and .head_branch == "main"
    and .head_repository.full_name == "PaddyPul/cocoatrace")][0]
  | .status == "completed" and .conclusion == "success"' <<< "$bt_runs")"
[[ $bt_ready == true ]] || { echo "Successful main quality-gate required for $bt_sha." >&2; exit 1; }
[[ -z "$("${bt_git[@]}" status --porcelain --untracked-files=all)" ]] || {
  echo 'Deployment requires a clean reviewed checkout.' >&2; exit 1;
}
bt_mode="${1:-update}"
[[ $bt_mode == first || $bt_mode == update ]] || { echo 'Use first or update.' >&2; exit 1; }
[[ -f /etc/bettertrade/demo.env && -f /etc/bettertrade/smtp.env ]] || {
  echo 'Run configure.py and complete Gmail configuration first.' >&2; exit 1;
}
if [[ $bt_mode == first && -e /etc/bettertrade/active-release ]]; then
  echo 'An installation already exists. Use update; do not bootstrap again.' >&2; exit 1
fi
if [[ $bt_mode == update && ! -f /etc/bettertrade/active-release ]]; then
  echo 'No successful installation recorded. Use first for initial installation.' >&2; exit 1
fi
export BT_RELEASE_SHA="$bt_sha"
bt_compose=(docker compose --env-file /etc/bettertrade/demo.env -f deploy/oracle-demo/compose.yml)
"${bt_compose[@]}" config --quiet
bt_free_kb="$(df --output=avail /var/lib/docker | tail -1 | tr -d ' ')"
(( bt_free_kb >= 8 * 1024 * 1024 )) || { echo 'At least 8 GiB free disk required.' >&2; exit 1; }
echo "Building candidate $bt_sha; existing traffic stays available during build."
"${bt_compose[@]}" build
[[ $bt_sha == "$("${bt_git[@]}" rev-parse HEAD)" ]] || {
  echo 'Checkout changed during build. Nothing deployed.' >&2; exit 1;
}

bt_backup="/var/backups/bettertrade/$(date -u +%Y%m%dT%H%M%SZ)-$bt_sha"
mkdir -p "$bt_backup"
chmod 700 /var/backups/bettertrade "$bt_backup"
cp /etc/caddy/Caddyfile "$bt_backup/Caddyfile"
cp /etc/bettertrade/demo.env /etc/bettertrade/smtp.env "$bt_backup/"
cat > /etc/caddy/Caddyfile <<'CADDY'
bettertrade-demo.duckdns.org {
    header Cache-Control "no-store"
    header X-Content-Type-Options "nosniff"
    respond "BetterTrade demo deployment is in progress. Please check back shortly." 503
}
CADDY
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy
echo 'Maintenance page enabled. A failed deployment will leave it in place.'
bt_failed() {
  bt_status=$?
  trap - ERR
  cat > /etc/caddy/Caddyfile <<'CADDY'
bettertrade-demo.duckdns.org {
    header Cache-Control "no-store"
    respond "BetterTrade demo deployment is in progress. Please check back shortly." 503
}
CADDY
  systemctl reload caddy || true
  echo "Deployment stopped. Maintenance retained; inspect containers and backup $bt_backup." >&2
  exit "$bt_status"
}
trap bt_failed ERR

if [[ $bt_mode == update ]]; then
  cp /etc/bettertrade/active-release "$bt_backup/previous-release"
  "${bt_compose[@]}" stop web api
  "${bt_compose[@]}" exec -T postgres pg_dump -U bettertrade -d bettertrade_demo --format=custom > "$bt_backup/database.dump"
  [[ -s "$bt_backup/database.dump" ]] || { echo 'Database backup is empty.' >&2; exit 1; }
  "${bt_compose[@]}" run --rm --no-deps -T api tar -C /app/private-evidence -czf - . > "$bt_backup/evidence.tar.gz"
  tar -tzf "$bt_backup/evidence.tar.gz" >/dev/null
  echo "Pre-migration database and evidence backup: $bt_backup"
fi

"${bt_compose[@]}" up -d --wait --wait-timeout 1200 postgres clamav
# Normal API startup runs manifest-verified migrations. No seed or reset commands.
"${bt_compose[@]}" up -d --wait --wait-timeout 300 api

if [[ $bt_mode == first && ! -f /etc/bettertrade/admin-bootstrapped ]]; then
  echo 'Create your private administrator. Save its password in your password manager.'
  python3 -c 'import getpass,json,sys; print("Administrator email: ",file=sys.stderr,end="",flush=True); email=open("/dev/tty").readline().strip(); password=getpass.getpass("New unique administrator password (20–72 bytes): "); confirmation=getpass.getpass("Repeat administrator password: "); assert password == confirmation, "Passwords differ"; print(json.dumps({"email":email,"password":password}))' \
    | "${bt_compose[@]}" run --rm --no-deps -T api node --import tsx api/scripts/bootstrap-hosted-admin.ts
  printf '%s\n' "$bt_sha" > /etc/bettertrade/admin-bootstrapped
fi

"${bt_compose[@]}" up -d --wait --wait-timeout 180 web
curl --fail --silent --show-error --max-time 20 http://127.0.0.1:14000/api/health/ready >/dev/null
cat > /etc/caddy/Caddyfile <<'CADDY'
bettertrade-demo.duckdns.org {
    header X-Content-Type-Options "nosniff"
    header X-Robots-Tag "noindex, nofollow, noarchive"
    reverse_proxy 127.0.0.1:14000
}
CADDY
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy
curl --fail --silent --show-error --max-time 30 https://bettertrade-demo.duckdns.org/api/health/ready >/dev/null
printf '%s\n' "$bt_sha" > /etc/bettertrade/active-release
echo "Deployed candidate: $bt_sha"
echo 'Open https://bettertrade-demo.duckdns.org and enroll your administrator passkey.'
echo 'Next: rehearse Request access, approval and invitation delivery with buyer and supplier accounts.'
