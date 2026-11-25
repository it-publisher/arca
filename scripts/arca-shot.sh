#!/bin/bash
# Select a screen area → encrypted Arca note → link in the clipboard.
# Bind it to a hotkey with Shortcuts.app ("Run Shell Script"), see README.
set -euo pipefail

# Hotkey launchers start with a minimal PATH, so Homebrew's node has to be added explicitly.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

ARCA_CLI="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)/cli/arca.js"
EXPIRES="${ARCA_SHOT_EXPIRES:-30d}"

notify() {
  # Message goes in as an argument, never spliced into AppleScript source.
  osascript -e 'on run argv' -e 'display notification (item 1 of argv) with title "Arca"' -e 'end run' "$1"
}

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
shot="$workdir/screenshot-$(date +%Y-%m-%d-%H%M%S).png"

screencapture -i "$shot"
[[ -f "$shot" ]] || exit 0  # Esc pressed: nothing captured

# stdin from /dev/null: without it, a terminal run would open $EDITOR for the note text.
if ! url="$(node "$ARCA_CLI" -a "$shot" -e "$EXPIRES" < /dev/null 2>&1)"; then
  notify "Не удалось загрузить: $url"
  exit 1
fi
printf '%s' "$url" | pbcopy
notify "Ссылка на скриншот скопирована"
