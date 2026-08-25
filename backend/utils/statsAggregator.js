// Aggregates GPX track data ({lat,lng,ele,time} points stored in JSONB) into
// distance / elevation / moving-time figures. Shared by the global stats and
// per-series statistics endpoints.
const { computeDistanceKm } = require('./gpxParser');

const computeGainLoss = (points) => {
  let gain = 0;
  let loss = 0;
  let ref = null;
  for (const p of points) {
    if (p.ele == null) continue;
    if (ref === null) {
      ref = p.ele;
      continue;
    }
    const diff = p.ele - ref;
    if (diff >= 3) {
      gain += diff;
      ref = p.ele;
    } else if (diff <= -3) {
      loss += -diff;
      ref = p.ele;
    }
  }
  return { gain: Math.round(gain), loss: Math.round(loss) };
};

const movingTimeSeconds = (points) => {
  let first = null;
  let last = null;
  for (const p of points) {
    if (p.time == null) continue;
    if (first === null) first = p.time;
    last = p.time;
  }
  if (!first || !last) return null;
  const ms = new Date(last).getTime() - new Date(first).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : null;
};

const emptyTotals = () => ({ distanceKm: 0, gainM: 0, lossM: 0, seconds: 0 });

const trackDistanceKm = (track) => {
  if (track.distance != null) return track.distance;
  const pts = Array.isArray(track.data) ? track.data : [];
  return computeDistanceKm(pts);
};

const aggregateTracks = (tracks) =>
  tracks.reduce((acc, t) => {
    const pts = Array.isArray(t.data) ? t.data : [];
    if (pts.length === 0) return acc;
    const { gain, loss } = computeGainLoss(pts);
    acc.distanceKm += trackDistanceKm(t);
    acc.gainM += gain;
    acc.lossM += loss;
    const secs = movingTimeSeconds(pts);
    if (secs) acc.seconds += secs;
    return acc;
  }, emptyTotals());

const addInto = (target, totals) => {
  target.distanceKm += totals.distanceKm;
  target.gainM += totals.gainM;
  target.lossM += totals.lossM;
  target.seconds += totals.seconds;
};

module.exports = { computeGainLoss, movingTimeSeconds, emptyTotals, aggregateTracks, addInto };
