#!/usr/bin/env bash
# Installed as a root-owned script only after the first hosted rehearsal passes.
# Pull-based CD keeps Oracle SSH restricted to the founder's IP.
set -euo pipefail
exec 8>/run/lock/bettertrade-demo-deploy.lock
flock -n 8 || exit 0
[[ -f /etc/bettertrade/active-release ]] || exit 0
[[ ! -e /etc/bettertrade/pause-auto-deploy ]] || exit 0
cd /home/ubuntu/bettertrade
bt_git=(runuser -u ubuntu -- git)
[[ -z "$("${bt_git[@]}" status --porcelain --untracked-files=all)" ]] || {
  echo 'Auto-deployment paused: worktree has local changes.' >&2; exit 1;
}
"${bt_git[@]}" fetch --no-tags https://github.com/PaddyPul/cocoatrace.git main
bt_sha="$("${bt_git[@]}" rev-parse FETCH_HEAD)"
[[ $bt_sha =~ ^[a-f0-9]{40}$ ]] || exit 1
[[ $bt_sha != "$(cat /etc/bettertrade/active-release)" ]] || exit 0
bt_runs="$(curl --fail --silent --show-error --connect-timeout 10 --max-time 30 \
  -H 'Accept: application/vnd.github+json' \
  'https://api.github.com/repos/PaddyPul/cocoatrace/actions/workflows/ci.yml/runs?branch=main&event=push&per_page=30')"
bt_ready="$(jq -r --arg sha "$bt_sha" '
  [.workflow_runs[] | select(.head_sha == $sha and .event == "push" and .head_branch == "main"
    and .head_repository.full_name == "PaddyPul/cocoatrace")][0]
  | .status == "completed" and .conclusion == "success"' <<< "$bt_runs")"
[[ $bt_ready == true ]] || { echo "Waiting for successful main CI on $bt_sha."; exit 0; }
"${bt_git[@]}" checkout --detach "$bt_sha"
BT_ORACLE_LOCKED=true bash deploy/oracle-demo/deploy.sh update
