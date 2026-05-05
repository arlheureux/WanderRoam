#!/bin/bash
# WanderRoam Full Backup Script
# Backups: PostgreSQL database + GPX uploads + configuration
# Run manually: ./scripts/backup.sh
# Or add to cron: 0 2 * * * /path/to/scripts/backup.sh

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="${CONTAINER_NAME:-wanderroam-db}"
VOLUME_NAME="${VOLUME_NAME:-wanderroam_upload_data}"
DB_NAME="${DB_NAME:-wanderroam}"
DB_USER="${DB_USER:-wanderroam}"
UPLOAD_VOLUME="${UPLOAD_VOLUME:-wanderroam_upload_data}"
ENV_FILE="${ENV_FILE:-.env}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "=== WanderRoam Full Backup ==="
echo "Date: $(date)"
echo "Backup directory: $BACKUP_DIR"

# Create temp directory for staging
TEMP_DIR="$BACKUP_DIR/temp_$DATE"
mkdir -p "$TEMP_DIR"

# 1. Backup PostgreSQL database
echo ""
echo "1/4: Backing up PostgreSQL database..."
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$TEMP_DIR/db_$DATE.sql"
gzip "$TEMP_DIR/db_$DATE.sql"
echo "  ✓ Database backed up ($(du -h "$TEMP_DIR/db_$DATE.sql.gz" | cut -f1))"

# 2. Backup GPX uploads (from Docker volume)
echo ""
echo "2/4: Backing up GPX uploads..."
if docker volume inspect "$UPLOAD_VOLUME" >/dev/null 2>&1; then
  docker run --rm -v ${UPLOAD_VOLUME}:/uploads -v $(pwd)/$TEMP_DIR:/backups alpine \
    tar -czf /backups/uploads_$DATE.tar.gz -C /uploads . 2>/dev/null || echo "  ⚠️  No uploads found or volume empty"
  
  if [ -f "$TEMP_DIR/uploads_$DATE.tar.gz" ]; then
    echo "  ✓ Uploads backed up ($(du -h "$TEMP_DIR/uploads_$DATE.tar.gz" | cut -f1))"
  fi
else
  echo "  ⚠️  Volume $UPLOAD_VOLUME not found, skipping uploads backup"
fi

# 3. Backup .env file
echo ""
echo "3/4: Backing up configuration..."
if [ -f "$ENV_FILE" ]; then
  # Remove sensitive passwords from backup (optional)
  grep -v "PASSWORD\|SECRET\|KEY\|TOKEN" "$ENV_FILE" > "$TEMP_DIR/env_$DATE" 2>/dev/null || true
  # Also backup original (user can choose which to restore)
  cp "$ENV_FILE" "$TEMP_DIR/env_${DATE}_full" 2>/dev/null || true
  echo "  ✓ Configuration backed up (passwords stripped in env_$DATE)"
  echo "    Full config saved as env_${DATE}_full (handle securely!)"
else
  echo "  ⚠️  No $ENV_FILE file found"
fi

# 4. Create metadata file
echo ""
echo "4/4: Creating metadata..."
cat > "$TEMP_DIR/metadata_$DATE.json" << EOF
{
  "version": "$(node -p "require('./backend/package.json').version" 2>/dev/null || echo 'unknown')",
  "backup_date": "$(date -Iseconds)",
  "database": "db_$DATE.sql.gz",
  "uploads": "uploads_$DATE.tar.gz",
  "config": "env_$DATE",
  "includes": {
    "database": true,
    "uploads": $([ -f "$TEMP_DIR/uploads_$DATE.tar.gz" ] && echo true || echo false),
    "config": $([ -f "$TEMP_DIR/env_$DATE" ] && echo true || echo false)
  },
  "note": "Immich photos must be backed up separately through your Immich instance"
}
EOF

# 5. Create single archive
ARCHIVE_NAME="wanderroam_backup_$DATE.tar.gz"
echo ""
echo "Creating full backup archive: $ARCHIVE_NAME..."
tar -czf "$BACKUP_DIR/$ARCHIVE_NAME" -C "$TEMP_DIR" .

BACKUP_SIZE=$(du -h "$BACKUP_DIR/$ARCHIVE_NAME" | cut -f1)
echo "  ✓ Full backup created ($BACKUP_SIZE)"

# Clean up temp directory
rm -rf "$TEMP_DIR"

# 6. Keep only last 7 backups
echo ""
echo "Cleaning up old backups (keeping last 7)..."
ls -t "$BACKUP_DIR"/wanderroam_backup_*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -v

echo ""
echo "=== Backup Complete ==="
echo "Saved to: $BACKUP_DIR/$ARCHIVE_NAME"
echo "Size: $BACKUP_SIZE"
echo ""
echo "⚠️  Note: To backup Immich photos, use Immich's built-in backup feature"
echo "    Immich URLs and API keys are saved in the env backup"
