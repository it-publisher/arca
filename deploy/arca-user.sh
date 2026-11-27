#!/bin/bash
# Manage Arca users on the server: add, reset a token, remove, list.
# The access code is the only thing printed to stdout, so from your computer
#   ssh arca arca-user add anna | pbcopy
# puts it straight into the clipboard without showing it on screen.
set -euo pipefail

ARCA_DIR="${ARCA_DIR:-/opt/arca}"
ENV_FILE="$ARCA_DIR/.env"
NAME_PATTERN='^[A-Za-z0-9_-]+$'

usage() {
  cat >&2 <<'USAGE'
Usage:
  arca-user add <name>      create a user and print their access code
  arca-user reset <name>    new token (leaked or lost code), print the new access code
  arca-user remove <name>   revoke access
  arca-user list            list user names
USAGE
  exit 2
}

fail() {
  echo "arca-user: $*" >&2
  exit 1
}

has_user() {
  grep -qE "^ARCA_USERS=(.*,)?$1:" "$ENV_FILE"
}

new_token() {
  node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
}

# token + a fresh history key. The key is generated here once and never stored on the server.
# The token goes through the environment, not argv, so other local users can't see it in `ps`.
access_code() {
  ARCA_TOKEN="$1" node --input-type=module -e "
    import { createAccessCode } from '$ARCA_DIR/shared/client.js';
    console.log(await createAccessCode(process.env.ARCA_TOKEN));"
}

# Applies a sed edit to .env and restarts Arca; if it doesn't come up with the new list, rolls back.
edit_users() {
  cp -p "$ENV_FILE" "$ENV_FILE.bak"
  sed -i -E "$1" "$ENV_FILE"
  systemctl restart arca
  sleep 1
  if ! systemctl is-active --quiet arca; then
    mv "$ENV_FILE.bak" "$ENV_FILE"
    systemctl restart arca || true
    fail "Arca did not start with the new user list, change rolled back. See: journalctl -u arca -n 20"
  fi
  rm -f "$ENV_FILE.bak"
}

add_user() {
  local name=$1 token code
  has_user "$name" && fail "user \"$name\" already exists. Lost or leaked code? Run: arca-user reset $name"
  token=$(new_token)
  code=$(access_code "$token")
  # Appends to a non-empty list, or fills an empty one (first user right after deploy).
  edit_users "/^ARCA_USERS=./s/$/,$name:$token/; s/^ARCA_USERS=$/ARCA_USERS=$name:$token/"
  echo "$code"
  echo "arca-user: added \"$name\". Hand over the access code once and ask them to keep it in a password manager." >&2
}

reset_user() {
  local name=$1 token code
  has_user "$name" || fail "no user \"$name\""
  token=$(new_token)
  code=$(access_code "$token")
  edit_users "/^ARCA_USERS=/s/([=,])$name:[^,]*/\1$name:$token/"
  echo "$code"
  echo "arca-user: new access code for \"$name\". The old one no longer works." >&2
}

remove_user() {
  local name=$1
  has_user "$name" || fail "no user \"$name\""
  edit_users "/^ARCA_USERS=/{s/([=,])$name:[^,]*,?/\1/; s/,$//}"
  echo "arca-user: removed \"$name\". Links to their notes keep working until they expire." >&2
}

list_users() {
  grep -m1 '^ARCA_USERS=' "$ENV_FILE" | cut -d= -f2- | tr ',' '\n' | cut -d: -f1 | grep -v '^$' || true
}

main() {
  [[ $# -ge 1 ]] || usage
  [[ $EUID -eq 0 ]] || fail "run as root"
  [[ -f "$ENV_FILE" ]] || fail "$ENV_FILE not found"
  grep -q '^ARCA_USERS=' "$ENV_FILE" || echo 'ARCA_USERS=' >> "$ENV_FILE"

  local command=$1
  if [[ $command == list ]]; then
    list_users
    return
  fi
  [[ $# -eq 2 ]] || usage
  [[ $2 =~ $NAME_PATTERN ]] || fail "name may contain only latin letters, digits, - and _"
  case $command in
    add) add_user "$2" ;;
    reset) reset_user "$2" ;;
    remove) remove_user "$2" ;;
    *) usage ;;
  esac
}

main "$@"
