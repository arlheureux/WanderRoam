const extractPoints = (xml, tag) => {
  const points = [];
  const regex = new RegExp(`<${tag}[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>`, 'g');
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);

    let ele = null;
    let time = null;

    const eleMatch = xml.substring(match.index, match.index + 500).match(/<ele>([^<]+)<\/ele>/);
    if (eleMatch) ele = parseFloat(eleMatch[1]);

    const timeMatch = xml.substring(match.index, match.index + 500).match(/<time>([^<]+)<\/time>/);
    if (timeMatch) time = timeMatch[1];

    if (!isNaN(lat) && !isNaN(lng)) {
      points.push({ lat, lng, ele, time });
    }
  }

  return points;
};

const parseGpxData = (xml) => {
  const trkpts = extractPoints(xml, 'trkpt');
  const rtepts = extractPoints(xml, 'rtept');
  const wpts = extractPoints(xml, 'wpt');
  return [...trkpts, ...rtepts, ...wpts];
};

const computeDistanceKm = (points) => {
  if (!Array.isArray(points) || points.length < 2) return 0;

  let total = 0;
  let last = null;
  for (const p of points) {
    if (p.lat == null || p.lng == null) continue;

    if (last) {
      const dLat = ((p.lat - last.lat) * Math.PI) / 180;
      const dLng = ((p.lng - last.lng) * Math.PI) / 180;
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((last.lat * Math.PI) / 180) * Math.cos((p.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      total += 6371 * 2 * Math.asin(Math.sqrt(h));
    }
    last = p;
  }

  return Math.round(total * 100) / 100;
};

module.exports = { parseGpxData, computeDistanceKm };
