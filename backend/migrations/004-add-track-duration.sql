-- Migration: Add moving-time column to GpxTracks and backfill it
-- duration_s = seconds between first and last timestamped point, read from
-- the stored JSONB track data. Idempotent: re-running fills only NULL rows.

ALTER TABLE "GpxTracks" ADD COLUMN IF NOT EXISTS "duration_s" INTEGER;

UPDATE "GpxTracks" g
SET "duration_s" = sub.dur
FROM (
  SELECT
    id,
    EXTRACT(EPOCH FROM (
      (data -> (jsonb_array_length(data) - 1) ->> 'time')::timestamptz
      - (data -> 0 ->> 'time')::timestamptz
    ))::int AS dur
  FROM "GpxTracks"
  WHERE "duration_s" IS NULL
    AND jsonb_typeof(data) = 'array'
    AND jsonb_array_length(data) >= 2
    AND data -> 0 ->> 'time' IS NOT NULL
    AND data -> (jsonb_array_length(data) - 1) ->> 'time' IS NOT NULL
) sub
WHERE g.id = sub.id;
