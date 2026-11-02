#!/usr/bin/env bash
# Shared by the reviewed VM maintenance commands. Never source secret files.
export GIT_OPTIONAL_LOCKS=0

bt_die() { echo "$*" >&2; exit 1; }
bt_require_root() { [[ $EUID == 0 ]] || bt_die 'Run with sudo -n bash.'; }
bt_lock() {
  if [[ ${BT_ORACLE_LOCKED:-} != true ]]; then
    [[ -d /etc/bettertrade && ! -L /etc/bettertrade ]] || bt_die 'Private configuration directory required.'
    [[ $(stat -c %u /etc/bettertrade) == 0 && $(stat -c %a /etc/bettertrade) == 700 ]] || bt_die 'Configuration directory must be root-owned mode 700.'
    [[ ! -L /etc/bettertrade/maintenance.lock ]] || bt_die 'Refusing a symlink maintenance lock.'
    (umask 077; touch /etc/bettertrade/maintenance.lock)
    exec 8>/etc/bettertrade/maintenance.lock
    flock -n 8 || bt_die 'Another deployment or recovery operation is running.'
    export BT_ORACLE_LOCKED=true
  fi
}
bt_prepare_git() {
  # A prior sudo git status may have replaced just this index with root:0600.
  # Restore that file to the .git owner's ownership; never chmod/chown the tree.
  if [[ -d "$bt_root/.git" && -f "$bt_root/.git/index" ]]; then
    [[ ! -L "$bt_root/.git/index" ]] || bt_die 'Refusing a symlink Git index.'
    if [[ $(stat -c %u "$bt_root/.git/index") == 0 && $(stat -c %u "$bt_root/.git") != 0 ]]; then
      chown --reference="$bt_root/.git" "$bt_root/.git/index"
      echo 'Restored Git index ownership to the repository owner.'
    fi
  fi
  bt_git=(git -c "safe.directory=$bt_root")
}
bt_clean_checkout() {
  local bt_status
  if ! bt_status="$("${bt_git[@]}" status --porcelain --untracked-files=all)"; then
    bt_die 'Git status failed. Deployment stopped before any application changes.'
  fi
  [[ -z "$bt_status" ]] || bt_die 'Pending repository changes exist. Preserve them before deployment.'
}
bt_ci_passed() {
  local bt_runs bt_ready
  bt_runs="$(curl --fail --silent --show-error --connect-timeout 10 --max-time 30 \
    -H 'Accept: application/vnd.github+json' \
    'https://api.github.com/repos/PaddyPul/cocoatrace/actions/workflows/ci.yml/runs?branch=main&event=push&per_page=30')" || return 1
  bt_ready="$(jq -r --arg sha "$1" '
    [.workflow_runs[] | select(.head_sha == $sha and .event == "push" and .head_branch == "main"
      and .head_repository.full_name == "PaddyPul/cocoatrace")][0]
    | .status == "completed" and .conclusion == "success"' <<< "$bt_runs")" || return 1
  [[ $bt_ready == true ]]
}
bt_maintenance() {
  cat > /etc/caddy/Caddyfile <<'CADDY'
bettertrade-demo.duckdns.org {
    header Cache-Control "no-store"
    header X-Content-Type-Options "nosniff"
    respond "BetterTrade demo deployment is in progress. Please check back shortly." 503
}
CADDY
  caddy fmt --overwrite /etc/caddy/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  systemctl reload caddy
}
