#!/usr/bin/env bash
# A short maintenance window; no seed, migration, reset or volume deletion.
set -euo pipefail
umask 077
bt_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$bt_root/deploy/oracle-demo/common.sh"
bt_require_root
bt_lock
cd "$bt_root"
[[ $# == 0 ]] || bt_die 'This snapshot command takes no arguments.'
export BT_RELEASE_SHA="$(cat /etc/bettertrade/active-release)"
[[ $BT_RELEASE_SHA =~ ^[a-f0-9]{40}$ ]] || bt_die 'Invalid active release marker.'
bt_compose=(docker compose --env-file /etc/bettertrade/demo.env -f deploy/oracle-demo/compose.yml)
"${bt_compose[@]}" config --quiet
bt_free_kb="$(df --output=avail /var/lib/docker | tail -1 | tr -d ' ')"
(( bt_free_kb >= 8 * 1024 * 1024 )) || bt_die 'At least 8 GiB free disk required.'
mkdir -p /var/backups/bettertrade
chmod 700 /var/backups/bettertrade
bt_backup="$(mktemp -d "/var/backups/bettertrade/$(date -u +%Y%m%dT%H%M%SZ)-snapshot-XXXXXXXX")"
cp /etc/caddy/Caddyfile "$bt_backup/Caddyfile"
cp /etc/bettertrade/demo.env /etc/bettertrade/smtp.env "$bt_backup/"
bt_maintenance
trap 'echo "Snapshot stopped; maintenance retained. Inspect $bt_backup before resuming existing containers." >&2' ERR
"${bt_compose[@]}" stop web api
python3 deploy/oracle-demo/recovery.py snapshot "$bt_backup"
# Start existing containers: never recreate/rebuild a different release during backup.
"${bt_compose[@]}" start --wait --wait-timeout 300 api web
curl --fail --silent --show-error --max-time 20 http://127.0.0.1:14000/api/health/ready >/dev/null
cp "$bt_backup/Caddyfile" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy
curl --fail --silent --show-error --max-time 30 https://bettertrade-demo.duckdns.org/api/health/ready >/dev/null
echo "Snapshot complete; live service resumed. Verify with: sudo -n python3 deploy/oracle-demo/recovery.py verify $bt_backup"
