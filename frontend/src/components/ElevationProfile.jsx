import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  useActiveTooltipDataPoints
} from 'recharts';

const MAX_PHOTO_SNAP_M = 400;

const TYPE_COLORS = {
  walking: '#DC2626',
  hiking: '#EA580C',
  cycling: '#65A30D',
  bus: '#2563EB',
  metro: '#DB2777',
  train: '#0891B2',
  boat: '#4F46E5',
  car: '#52525B',
  plane: '#6366F1',
  other: '#0D9488'
};

const ELEVATION_TYPES = ['car', 'walking', 'hiking', 'cycling'];

const HoveredPointTracker = ({ onHover, onRowIndex }) => {
  const activePoints = useActiveTooltipDataPoints();

  useEffect(() => {
    if (activePoints && activePoints.length > 0) {
      const point = activePoints.find(p => p && p._point);
      if (point) {
        onHover({ lat: point._point.lat, lng: point._point.lng });
        onRowIndex(point._point.idx ?? null);
        return;
      }
    }
    onHover(null);
    onRowIndex(null);
  }, [activePoints, onHover, onRowIndex]);

  return null;
};

const ElevationProfile = ({ tracks, photos, onPhotoClick, onHover }) => {
  const [activeIndex, setActiveIndex] = useState(null);

  const filteredTracks = useMemo(() => {
    if (!tracks) return [];
    return tracks.filter(t => ELEVATION_TYPES.includes(t.type));
  }, [tracks]);

  const { chartData, trackMeta, minEle, maxEle, totalGain, totalLoss, maxDist, photoIdxMap } = useMemo(() => {
    const noPhotos = new Map();
    if (!filteredTracks || filteredTracks.length === 0) {
      return { chartData: [], trackMeta: [], minEle: 0, maxEle: 0, totalGain: 0, totalLoss: 0, maxDist: 0, photoIdxMap: noPhotos };
    }

    const chartRows = [];
    const meta = [];
    const allElevations = [];

    filteredTracks.forEach((track, ti) => {
      const points = track.data || [];
      const color = track.color || TYPE_COLORS[track.type] || TYPE_COLORS.other;
      const key = `t${ti}`;
      meta.push({ key, name: track.name, type: track.type, color });

      let cumulativeDist = chartRows.length > 0 ? chartRows[chartRows.length - 1].distance : 0;

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (p.ele == null) {
          cumulativeDist += i > 0 ? distanceTo(points[i - 1], p) : 0;
          continue;
        }

        if (i > 0) {
          cumulativeDist += distanceTo(points[i - 1], p);
        }

        const row = {
          distance: +(cumulativeDist / 1000).toFixed(3),
          _point: { lat: p.lat, lng: p.lng, ele: p.ele, idx: chartRows.length },
        };
        row[key] = Math.round(p.ele);
        allElevations.push(row[key]);
        chartRows.push(row);
      }
    });

    if (chartRows.length === 0) {
      return { chartData: [], trackMeta: [], minEle: 0, maxEle: 0, totalGain: 0, totalLoss: 0, maxDist: 0, photoIdxMap: noPhotos };
    }

    const byRow = new Map();
    if (photos && photos.length > 0) {
      photos.forEach(ph => {
        const lat = parseFloat(ph.latitude);
        const lng = parseFloat(ph.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < chartRows.length; i++) {
          const pt = chartRows[i]._point;
          if (!pt) continue;
          const d = distanceTo({ lat, lng }, pt);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0 && bestDist <= MAX_PHOTO_SNAP_M) {
          if (!byRow.has(bestIdx)) byRow.set(bestIdx, []);
          byRow.get(bestIdx).push({
            id: ph.id,
            thumbnail_url: ph.thumbnail_url,
            filename: ph.filename
          });
        }
      });
      byRow.forEach((list, idx) => {
        chartRows[idx]._photos = list;
      });
    }

    let gain = 0;
    let loss = 0;
    for (let i = 1; i < chartRows.length; i++) {
      const prev = chartRows[i - 1];
      const curr = chartRows[i];
      const prevEle = getActiveEle(prev, meta);
      const currEle = getActiveEle(curr, meta);
      if (prevEle != null && currEle != null) {
        const diff = currEle - prevEle;
        if (diff > 0) gain += diff;
        else loss += Math.abs(diff);
      }
    }

    return {
      chartData: chartRows,
      trackMeta: meta,
      minEle: Math.min(...allElevations),
      maxEle: Math.max(...allElevations),
      totalGain: Math.round(gain),
      totalLoss: Math.round(loss),
      maxDist: chartRows[chartRows.length - 1].distance,
      photoIdxMap: byRow
    };
  }, [filteredTracks, photos]);

  const handleChartClick = useCallback(() => {
    if (!onPhotoClick || activeIndex == null) return;
    const list = photoIdxMap.get(activeIndex);
    if (list && list.length > 0) onPhotoClick(list[0]);
  }, [onPhotoClick, activeIndex, photoIdxMap]);

  const handleDotClick = useCallback((list) => {
    if (onPhotoClick && list && list.length > 0) onPhotoClick(list[0]);
  }, [onPhotoClick]);

  const photoTotal = useMemo(
    () => [...photoIdxMap.values()].reduce((n, list) => n + list.length, 0),
    [photoIdxMap]
  );

  const renderPhotoDot = useCallback((m) => (dotProps) => {
    const { cx, cy, payload } = dotProps;
    if (cx == null || cy == null || !payload || payload[m.key] == null || !payload._photos) return null;
    return (
      <g onClick={() => handleDotClick(payload._photos)} style={{ cursor: onPhotoClick ? 'pointer' : 'default' }}>
        <circle cx={cx} cy={cy} r={6} fill="#7C3AED" stroke="#fff" strokeWidth={1.5} />
        <text x={cx} y={cy + 2.5} textAnchor="middle" fontSize={7}>📷</text>
      </g>
    );
  }, [handleDotClick, onPhotoClick]);

  const handleRowIndex = useCallback((idx) => {
    setActiveIndex(idx);
  }, []);

  if (chartData.length === 0) return null;

  const formatXAxis = (value) => `${value.toFixed(1)} km`;
  const formatTooltipDist = (value) => `${value.toFixed(2)} km`;
  const formatTooltipEle = (value) => `${value} m`;

  return (
    <div className="elevation-profile-card">
      <div className="elevation-profile-header">
        <h3>Elevation Profile</h3>
        <div className="elevation-stats">
          <div className="elevation-stat">
            <span className="elevation-stat-value">+{totalGain} m</span>
            <span className="elevation-stat-label">Gain</span>
          </div>
          <div className="elevation-stat">
            <span className="elevation-stat-value">-{totalLoss} m</span>
            <span className="elevation-stat-label">Loss</span>
          </div>
          <div className="elevation-stat">
            <span className="elevation-stat-value">{maxEle} m</span>
            <span className="elevation-stat-label">Max</span>
          </div>
          <div className="elevation-stat">
            <span className="elevation-stat-value">{minEle} m</span>
            <span className="elevation-stat-label">Min</span>
          </div>
          <div className="elevation-stat">
            <span className="elevation-stat-value">{maxDist.toFixed(1)} km</span>
            <span className="elevation-stat-label">Distance</span>
          </div>
        </div>
      </div>
      <div className="elevation-profile-chart">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            onClick={handleChartClick}
          >
            <defs>
              {trackMeta.map((m, i) => (
                <linearGradient key={`grad-${i}`} id={`elevGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={m.color} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={m.color} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="distance"
              tick={{ fill: 'var(--text-light)', fontSize: 11 }}
              tickFormatter={formatXAxis}
              label={{ value: 'Distance (km)', position: 'insideBottom', offset: -2, fill: 'var(--text-light)', fontSize: 11 }}
            />
            <YAxis
              tick={{ fill: 'var(--text-light)', fontSize: 11 }}
              tickFormatter={(v) => `${v}m`}
              domain={['dataMin - 10', 'dataMax + 10']}
            />
            <HoveredPointTracker onHover={onHover} onRowIndex={handleRowIndex} />
            <Tooltip
              formatter={(value, name, props) => {
                const photoList = props?.payload?._photos;
                const track = trackMeta.find(m => m.key === name);
                if (photoList && track) {
                  return [`${formatTooltipEle(value)} · 📷 ${photoList.length}`, track.name];
                }
                if (!value && !track) return null;
                return [formatTooltipEle(value), track ? track.name : 'Elevation'];
              }}
              labelFormatter={(label) => formatTooltipDist(label)}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            />
            {trackMeta.map((m, i) => (
              <Area
                key={m.key}
                type="monotone"
                dataKey={m.key}
                stroke={m.color}
                strokeWidth={2}
                fill={`url(#elevGrad-${i})`}
                dot={renderPhotoDot(m)}
                activeDot={activeIndex !== null ? { r: 4, fill: m.color, stroke: '#fff', strokeWidth: 2 } : false}
                connectNulls={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="elevation-legend">
        {trackMeta.map(m => (
          <span key={m.key} className="elevation-legend-item">
            <span className="elevation-legend-dot" style={{ backgroundColor: m.color }} />
            {m.name}
          </span>
        ))}
        {photoTotal > 0 && (
          <span className="elevation-legend-item">
            <span className="elevation-legend-dot" style={{ backgroundColor: '#7C3AED' }} />
            📷 Photos ({photoTotal})
          </span>
        )}
      </div>
    </div>
  );
};

function distanceTo(a, b) {  const dlat = (b.lat - a.lat) * Math.PI / 180;
  const dlng = (b.lng - a.lng) * Math.PI / 180;
  const c = 2 * Math.asin(Math.sqrt(
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dlng / 2) ** 2
  ));
  return 6371000 * c;
}

function getActiveEle(row, meta) {
  for (const m of meta) {
    if (row[m.key] != null) return row[m.key];
  }
  return null;
}

export default ElevationProfile;
