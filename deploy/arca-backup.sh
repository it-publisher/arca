#!/bin/bash
# Daily snapshot of Arca data, kept for KEEP_DAYS. Data is ciphertext, so copies are safe to store anywhere.
set -euo pipefail

DATA_DIR=/opt/arca/data
BACKUP_DIR=/var/backups/arca
KEEP_DAYS=7

snapshot="$BACKUP_DIR/$(date +%F)"
install -d -m 700 "$BACKUP_DIR" "$snapshot"

# .backup gives a consistent copy even while the service is writing.
sqlite3 "$DATA_DIR/arca.db" ".backup '$snapshot/arca.db'"

# Unchanged files are hard-linked to the previous snapshot, so each day costs only what changed.
link_args=()
[[ -d "$BACKUP_DIR/latest/files" ]] && link_args=(--link-dest="$BACKUP_DIR/latest/files")
rsync -a --delete "${link_args[@]}" "$DATA_DIR/files/" "$snapshot/files/"
ln -sfn "$snapshot" "$BACKUP_DIR/latest"

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +
