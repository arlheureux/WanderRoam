import React, { useMemo, useCallback, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

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

const ElevationProfile = ({ tracks, onHover }) => {
  const [activeIndex, setActiveIndex] = useState(null);

  const { chartData, trackMeta, minEle, maxEle, totalGain, totalLoss, maxDist } = useMemo(() => {
    if (!tracks || tracks.length === 0) {
      return { chartData: [], trackMeta: [], minEle: 0, maxEle: 0, totalGain: 0, totalLoss: 0, maxDist: 0 };
    }

    const chartRows = [];
    const meta = [];
    const allElevations = [];

    tracks.forEach((track, ti) => {
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
          _point: { lat: p.lat, lng: p.lng, ele: p.ele },
        };
        row[key] = Math.round(p.ele);
        allElevations.push(row[key]);
        chartRows.push(row);
      }
    });

    if (chartRows.length === 0) {
      return { chartData: [], trackMeta: [], minEle: 0, maxEle: 0, totalGain: 0, totalLoss: 0, maxDist: 0 };
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
      maxDist: chartRows[chartRows.length - 1].distance
    };
  }, [tracks]);

  const handleMouseMove = useCallback((state) => {
    if (!state?.activePayload?.[0]?.payload) {
      setActiveIndex(null);
      if (onHover) onHover(null);
      return;
    }
    const row = state.activePayload[0].payload;
    setActiveIndex(state.activeTooltipIndex);
    if (onHover && row._point) {
      onHover({ lat: row._point.lat, lng: row._point.lng });
    }
  }, [onHover]);

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null);
    if (onHover) onHover(null);
  }, [onHover]);

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
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
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
            <Tooltip
              formatter={(value, name, props) => {
                const track = trackMeta.find(m => m.key === name);
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
                dot={false}
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
      </div>
    </div>
  );
};

function distanceTo(a, b) {
  const dlat = (b.lat - a.lat) * Math.PI / 180;
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
