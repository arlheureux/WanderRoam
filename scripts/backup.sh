#!/bin/bash
# WanderRoam Backup Script
# Run manually: ./scripts/backup.sh
# Or add to cron: 0 2 * * * /path/to/scripts/backup.sh

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="${CONTAINER_NAME:-wanderroam-db}"
VOLUME_NAME="${VOLUME_NAME:-wanderroam-postgres_data}"
DB_NAME="${DB_NAME:-wanderroam}"
DB_USER="${DB_USER:-wanderroam}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "=== WanderRoam Backup ==="
echo "Date: $(date)"
echo "Backup directory: $BACKUP_DIR"

# Backup PostgreSQL database
echo "Backing up PostgreSQL database..."
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/wanderroam_db_$DATE.sql"

# Compress the backup
echo "Compressing backup..."
gzip "$BACKUP_DIR/wanderroam_db_$DATE.sql"

# Keep only last 7 backups
echo "Cleaning up old backups (keeping last 7)..."
ls -t "$BACKUP_DIR"/wanderroam_db_*.sql.gz | tail -n +8 | xargs -r rm

echo "=== Backup Complete ==="
echo "Backup saved to: $BACKUP_DIR/wanderroam_db_$DATE.sql.gz"
echo "Backup size: $(du -h "$BACKUP_DIR/wanderroam_db_$DATE.sql.gz" | cut -f1)"

# Optional: Upload to cloud storage (uncomment and configure)
# rclone copy "$BACKUP_DIR/wanderroam_db_$DATE.sql.gz" remote:backups/

exit 0
