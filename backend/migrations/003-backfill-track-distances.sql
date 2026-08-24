-- Migration: Backfill NULL distances on GpxTracks
-- Recomputes haversine distance (km) from stored track points for legacy rows
-- created before server-side distance computation was added.

WITH expanded AS (
  SELECT
    t.id,
    p.ord,
    (p.val ->> 'lat')::double precision AS lat,
    (p.val ->> 'lng')::double precision AS lng
  FROM "GpxTracks" t
  CROSS JOIN LATERAL jsonb_array_elements(t.data) WITH ORDINALITY AS p(val, ord)
  WHERE t.distance IS NULL
    AND jsonb_typeof(t.data) = 'array'
),
segments AS (
  SELECT
    e1.id,
    6371 * 2 * asin(sqrt(
      power(sin(radians(e2.lat - e1.lat) / 2), 2) +
      cos(radians(e1.lat)) * cos(radians(e2.lat)) *
      power(sin(radians(e2.lng - e1.lng) / 2), 2)
    )) AS seg_km
  FROM expanded e1
  JOIN expanded e2 ON e2.id = e1.id AND e2.ord = e1.ord + 1
)
UPDATE "GpxTracks" g
SET distance = ROUND(src.total_km::numeric, 2)
FROM (
  SELECT id, SUM(seg_km) AS total_km
  FROM segments
  GROUP BY id
) src
WHERE g.id = src.id;
