-- Migration: Add 'plane' to GpxTrack type enum
-- Run this SQL when database is available

-- First, check the correct enum name in your database:
-- SELECT typname, enumlabel FROM pg_type 
--   JOIN pg_enum ON pg_type.oid = pg_enum.enumtypid 
--   WHERE typname LIKE '%gpx%track%type%';

-- The enum name is typically one of:
--   enum_gpx_tracks_type (if table is gpx_tracks)
--   enum_gpxtracks_type (if table is gpxtracks)
--   enum_GpxTracks_type (if table is GpxTracks)

-- Once you find the correct enum name, run:
-- ALTER TYPE <enum_name> ADD VALUE IF NOT EXISTS 'plane';

-- Example (uncomment and adjust enum name as needed):
-- ALTER TYPE enum_gpx_tracks_type ADD VALUE IF NOT EXISTS 'plane';
