#!/bin/bash
# WanderRoam restic Backup Script
# Snapshots PostgreSQL dump + uploads volume + .env into a restic repository
# Fully env-driven: configure RESTIC_REPOSITORY (+ RESTIC_PASSWORD or RESTIC_PASSWORD_FILE)
#
# Repository examples:
#   /mnt/nas/wanderroam            (local disk / mount)
#   sftp:user@host:/srv/backup     (SSH target)
#   b2:bucket-name/path            (object storage, needs B2_ACCOUNT_ID / B2_ACCOUNT_KEY)
#
# Run manually: ./scripts/backup-restic.sh
# Cron example (nightly 02:00):
#   0 2 * * * RESTIC_REPOSITORY=/mnt/nas/wanderroam RESTIC_PASSWORD_FILE=/root/.restic-pass /opt/WanderRoam/scripts/backup-restic.sh >> /var/log/wanderroam-restic.log 2>&1
#
# Restore:
#   restic snapshots
#   restic restore latest --target /tmp/restore

set -e

CONTAINER_NAME="${CONTAINER_NAME:-wanderroam-db}"
DB_NAME="${DB_NAME:-wanderroam}"
DB_USER="${DB_USER:-wanderroam}"
ENV_FILE="${ENV_FILE:-.env}"
UPLOAD_VOLUME="${UPLOAD_VOLUME:-wanderroam_upload_data}"
RETENTION="${RETENTION:---keep-daily 7 --keep-weekly 4 --keep-monthly 6}"

if [ -z "${RESTIC_REPOSITORY}" ]; then
  echo "ERROR: RESTIC_REPOSITORY not set (e.g. /mnt/nas/wanderroam, sftp:user@host/srv/backup, b2:bucket/path)"
  exit 1
fi
if [ -z "${RESTIC_PASSWORD}" ] && [ -z "${RESTIC_PASSWORD_FILE}" ]; then
  echo "ERROR: Set RESTIC_PASSWORD or RESTIC_PASSWORD_FILE"
  exit 1
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "=== WanderRoam restic Backup ==="
echo "Date: $(date)"
echo "Repository: ${RESTIC_REPOSITORY}"

mkdir -p "$TMP_DIR/db" "$TMP_DIR/uploads"

echo "--- Dumping database"
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$TMP_DIR/db/wanderroam.sql"

echo "--- Copying uploads volume"
UPLOAD_MOUNT="$(docker volume inspect "$UPLOAD_VOLUME" --format '{{.Mountpoint}}' 2>/dev/null || true)"
if [ -n "$UPLOAD_MOUNT" ] && [ -r "$UPLOAD_MOUNT" ]; then
  cp -a "$UPLOAD_MOUNT/." "$TMP_DIR/uploads/"
else
  echo "Volume not readable from host; copying via helper container"
  docker run --rm -v "$UPLOAD_VOLUME":/from:ro -v "$TMP_DIR/uploads":/to alpine sh -c 'cp -a /from/. /to/'
fi

if [ -f "$ENV_FILE" ]; then
  echo "--- Including $ENV_FILE"
  cp "$ENV_FILE" "$TMP_DIR/env-file"
fi

echo "--- Creating snapshot"
restic backup "$TMP_DIR"

echo "--- Applying retention (${RETENTION})"
# shellcheck disable=SC2086
restic forget $RETENTION --prune

echo "=== Backup complete ==="
