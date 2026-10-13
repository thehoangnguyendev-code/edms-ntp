#!/bin/sh
# Physical base backup of the eQMS Postgres (SDS 15.1) and retention of the WAL archive. DEV.
# Every Sunday at 03:00 (Asia/Ho_Chi_Minh) a plain base backup is written to /backups; base backups older than KEEP_DAYS are
# removed, but the newest one is always kept. WAL segments older than the start of the oldest kept base backup are removed from
# the archive. RUN_NOW=1 makes one base backup at start-up, for testing.
set -u
KEEP_DAYS="${KEEP_DAYS:-14}"
BACKUPS=/backups
ARCHIVE=/pgdata/archive

OFFSITE=/offsite

# Copies the new base backup and the WAL segments to the off-site folder (a folder on another disk), checks their SHA-256, and applies
# the same retention there. Without the mount, the copy is skipped and the reason is logged.
offsite_copy() {
  if [ ! -d "$OFFSITE" ]; then
    echo "$(date -Iseconds) off-site copy skipped: $OFFSITE is not mounted" >&2
    return 1
  fi
  mkdir -p "$OFFSITE/base" "$OFFSITE/wal-archive" || return 1
  cp -a "$dir" "$OFFSITE/base/" || return 1
  cp -n "$ARCHIVE"/* "$OFFSITE/wal-archive/" 2>/dev/null || true
  (cd "$OFFSITE" && find base wal-archive -type f -exec sha256sum {} + > SHA256SUMS-base-wal.txt) || return 1
  newest_off=$(ls -1d "$OFFSITE"/base/base-* | tail -1)
  find "$OFFSITE/base" -maxdepth 1 -name 'base-*' -mtime +"$KEEP_DAYS" ! -path "$newest_off" -exec rm -rf {} +
  oldest_off=$(ls -1d "$OFFSITE"/base/base-* | head -1)
  off_start=$(sed -n 's/.*(file \([0-9A-F]\{24\}\)).*/\1/p' "$oldest_off/backup_label")
  [ -n "$off_start" ] && pg_archivecleanup "$OFFSITE/wal-archive" "$off_start"
  echo "$(date -Iseconds) off-site copy ok: $OFFSITE/base/$(basename "$dir")"
}

# Alerts (SDS 15.1): every alert goes to the log and, when the off-site folder is mounted, to /offsite/ALERTS.log on drive D.
MIN_FREE_MB="${MIN_FREE_MB:-5120}"
alert() {
  echo "$(date -Iseconds) ALERT $1" >&2
  if [ -d "$OFFSITE" ]; then echo "$(date -Iseconds) ALERT $1" >> "$OFFSITE/ALERTS.log"; fi
}

check_space() {
  for target in "$BACKUPS" "${OFFSITE}"; do
    [ -d "$target" ] || continue
    free_mb=$(df -Pm "$target" | awk 'NR==2 {print $4}')
    if [ "$free_mb" -lt "$MIN_FREE_MB" ]; then alert "low space: $target has ${free_mb} MB free (minimum $MIN_FREE_MB MB)"; fi
  done
}

backup_once() {
  check_space
  dir="$BACKUPS/base-$(date +%Y%m%d-%H%M%S)"
  if pg_basebackup -h "$PGHOST" -U "$PGUSER" -D "$dir" -Fp -X stream -P; then
    echo "$(date -Iseconds) base backup ok: $dir"
  else
    alert "base backup FAILED: $dir"
    rm -rf "$dir"
    return 1
  fi
  offsite_copy || echo "$(date -Iseconds) WARNING: the off-site copy of $dir did not complete" >&2
  # retention: drop base backups older than KEEP_DAYS, never the newest one
  newest=$(ls -1d "$BACKUPS"/base-* | tail -1)
  find "$BACKUPS" -maxdepth 1 -name 'base-*' -mtime +"$KEEP_DAYS" ! -path "$newest" -exec rm -rf {} +
  # WAL: remove segments older than the start of the oldest base backup that is still kept
  oldest=$(ls -1d "$BACKUPS"/base-* | head -1)
  start=$(sed -n 's/.*(file \([0-9A-F]\{24\}\)).*/\1/p' "$oldest/backup_label")
  if [ -n "$start" ]; then
    pg_archivecleanup "$ARCHIVE" "$start" && echo "$(date -Iseconds) WAL before $start removed from the archive"
  fi
}

mkdir -p "$BACKUPS"
if [ "${RUN_NOW:-0}" = "1" ]; then
  backup_once
fi
last=""
last_epoch=0
while true; do
  if [ -n "${BACKUP_EVERY_MINUTES:-}" ]; then
    # test cadence: a base backup every BACKUP_EVERY_MINUTES minutes, counted from the last one
    now=$(date +%s)
    if [ $((now - last_epoch)) -ge $((BACKUP_EVERY_MINUTES * 60)) ]; then
      last_epoch=$now
      backup_once
    fi
  else
    day=$(date +%Y%m%d)
    if [ "$(date +%u)" = "7" ] && [ "$(date +%H)" = "03" ] && [ "$last" != "$day" ]; then
      last="$day"
      backup_once
    fi
  fi
  sleep 60
done
