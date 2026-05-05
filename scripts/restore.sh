#!/bin/bash
# WanderRoam Restore Script
# Restores: PostgreSQL database + GPX uploads + configuration
# Usage: ./scripts/restore.sh <backup_file.tar.gz>

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <backup_file.tar.gz>"
  echo "Example: $0 ./backups/wanderroam_backup_20240505_123456.tar.gz"
  exit 1
fi

BACKUP_FILE="$1"
RESTORE_DIR="/tmp/wanderroam_restore_$$"
CONTAINER_NAME="${CONTAINER_NAME:-wanderroam-db}"
DB_NAME="${DB_NAME:-wanderroam}"
DB_USER="${DB_USER:-wanderroam}"
UPLOAD_VOLUME="${UPLOAD_VOLUME:-wanderroam_upload_data}"

echo "=== WanderRoam Restore ==="
echo "Backup file: $BACKUP_FILE"
echo ""

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Create temp directory
mkdir -p "$RESTORE_DIR"
trap "rm -rf $RESTORE_DIR" EXIT

# Extract backup
echo "Extracting backup archive..."
tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR"
echo "  ✓ Backup extracted to $RESTORE_DIR"
echo ""

# Find extracted files
DB_FILE=$(ls "$RESTORE_DIR"/db_*.sql.gz 2>/dev/null | head -1)
UPLOADS_FILE=$(ls "$RESTORE_DIR"/uploads_*.tar.gz 2>/dev/null | head -1)
ENV_FILE=$(ls "$RESTORE_DIR"/env_* 2>/dev/null | grep -v "_full$" | head -1)
METADATA_FILE=$(ls "$RESTORE_DIR"/metadata_*.json 2>/dev/null | head -1)

# Show metadata if available
if [ -f "$METADATA_FILE" ]; then
  echo "Backup metadata:"
  cat "$METADATA_FILE"
  echo ""
fi

# Confirm restore
echo "⚠️  WARNING: This will OVERWRITE the current database and uploads!"
echo "  Database: $DB_NAME"
echo "  Upload volume: $UPLOAD_VOLUME"
echo "  Backup contains:"
[ -f "$DB_FILE" ] && echo "    ✓ Database backup"
[ -f "$UPLOADS_FILE" ] && echo "    ✓ Uploads backup"
[ -f "$ENV_FILE" ] && echo "    ✓ Config backup"
echo ""
read -p "Continue with restore? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Restore cancelled."
  exit 0
fi

echo ""
echo "=== Starting Restore ==="

# 1. Restore PostgreSQL database
if [ -f "$DB_FILE" ]; then
  echo "1/3: Restoring PostgreSQL database..."
  gunzip < "$DB_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" "$DB_NAME"
  echo "  ✓ Database restored"
else
  echo "1/3: ⚠️  No database file found in backup, skipping"
fi

# 2. Restore GPX uploads
if [ -f "$UPLOADS_FILE" ]; then
  echo ""
  echo "2/3: Restoring GPX uploads..."
  
  # Ensure volume exists (create if not)
  docker volume inspect "$UPLOAD_VOLUME" >/dev/null 2>&1 || \
    docker volume create "$UPLOAD_VOLUME" >/dev/null
  
  # Clear existing uploads and restore
  docker run --rm -v ${UPLOAD_VOLUME}:/uploads -v $(pwd)/$RESTORE_DIR:/backups alpine \
    sh -c "rm -rf /uploads/* && mkdir -p /uploads && tar -xzf /backups/$(basename $UPLOADS_FILE) -C /uploads"
  echo "  ✓ Uploads restored"
else
  echo ""
  echo "2/3: ⚠️  No uploads file found in backup, skipping"
fi

# 3. Restore .env file
if [ -f "$ENV_FILE" ]; then
  echo ""
  echo "3/3: Restoring configuration..."
  cp "$ENV_FILE" .env
  echo "  ✓ Configuration restored to .env"
  echo "    ⚠️  Check .env for correctness (passwords were stripped)"
  echo "    Full config available at: $RESTORE_DIR/env_*_full"
else
  echo ""
  echo "3/3: ⚠️  No .env file found in backup, skipping"
fi

echo ""
echo "=== Restore Complete ==="
echo ""
echo "Next steps:"
echo "  1. Review .env file for correct configuration"
echo "  2. Restart containers: docker compose down && docker compose up -d"
echo "  3. Restore Immich photos separately through your Immich instance"
echo "  4. The 'plane' track type should now be available (fresh DB)"
