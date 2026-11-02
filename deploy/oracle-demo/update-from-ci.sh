#!/usr/bin/env bash
# Installed as a root-owned script only after the first hosted rehearsal passes.
# Pull-based CD keeps Oracle SSH restricted to the founder's IP.
set -euo pipefail
bt_root=/home/ubuntu/bettertrade
source "$bt_root/deploy/oracle-demo/common.sh"
bt_require_root
bt_lock
[[ -f /etc/bettertrade/active-release ]] || exit 0
[[ ! -e /etc/bettertrade/pause-auto-deploy ]] || exit 0
cd "$bt_root"
bt_prepare_git
bt_clean_checkout
# Fetch and checkout as the repository owner so new Git/worktree files stay usable.
bt_owner="$(stat -c %U "$bt_root/.git")"
bt_git=(runuser -u "$bt_owner" -- git)
"${bt_git[@]}" fetch --no-tags https://github.com/PaddyPul/cocoatrace.git main
bt_sha="$("${bt_git[@]}" rev-parse FETCH_HEAD)"
[[ $bt_sha =~ ^[a-f0-9]{40}$ ]] || exit 1
[[ $bt_sha != "$(cat /etc/bettertrade/active-release)" ]] || exit 0
bt_ci_passed "$bt_sha" || { echo "Waiting for successful main CI on $bt_sha."; exit 0; }
bt_previous="$(cat /etc/bettertrade/active-release)"
[[ $bt_previous =~ ^[a-f0-9]{40}$ ]] || bt_die 'Invalid active release marker.'
"${bt_git[@]}" merge-base --is-ancestor "$bt_previous" "$bt_sha" || bt_die 'Refusing an older or divergent release.'
"${bt_git[@]}" checkout --detach "$bt_sha"
BT_ORACLE_LOCKED=true bash deploy/oracle-demo/deploy.sh update
