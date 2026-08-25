const coverUrlFor = p => p && p.immich_asset_id
  ? `/api/immich/thumbnail/${p.immich_asset_id}?size=preview`
  : null;

module.exports = { coverUrlFor };
