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

module.exports = { parseGpxData };
