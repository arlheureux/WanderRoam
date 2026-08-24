-- Migration: Clear cached base64 thumbnails from pictures table
-- Thumbnails are no longer persisted; they are served live via /api/immich/thumbnail/:assetId
-- Run this SQL when database is available

UPDATE "Pictures" SET thumbnail_url = NULL WHERE thumbnail_url LIKE 'data:%';
