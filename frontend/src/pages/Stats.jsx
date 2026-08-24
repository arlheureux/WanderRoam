import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import AnimatedNumber from '../components/AnimatedNumber';
import ActivityHeatmap from '../components/ActivityHeatmap';
import api from '../services/api';

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

const DATE_PRESETS = [
  { label: 'All time', value: 'all', startDate: null, endDate: null },
  { label: 'This year', value: 'this_year', startDate: () => `${new Date().getFullYear()}-01-01`, endDate: null },
  { label: 'Last 6 months', value: '6months', startDate: () => { const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().split('T')[0]; }, endDate: null },
  { label: 'Last 30 days', value: '30days', startDate: () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; }, endDate: null },
];

const Stats = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const abortControllerRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);

  const view = searchParams.get('view') || 'all';
  const datePreset = searchParams.get('date') || 'all';
  const customStart = searchParams.get('start') || '';
  const customEnd = searchParams.get('end') || '';

  const getDateRange = useMemo(() => {
    const preset = DATE_PRESETS.find(p => p.value === datePreset);
    if (preset && preset.value !== 'all' && preset.value !== 'custom') {
      return {
        startDate: typeof preset.startDate === 'function' ? preset.startDate() : preset.startDate,
        endDate: preset.endDate
      };
    }
    if (datePreset === 'custom' && customStart) {
      return { startDate: customStart, endDate: customEnd || null };
    }
    return { startDate: null, endDate: null };
  }, [datePreset, customStart, customEnd]);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    loadStats(abortController.signal);
    return () => abortController.abort();
  }, [view, datePreset, customStart, customEnd]);

  const loadStats = async (signal) => {
    const isFirstLoad = !hasLoadedOnceRef.current;
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const params = new URLSearchParams({ view });
      if (getDateRange.startDate) params.set('startDate', getDateRange.startDate);
      if (getDateRange.endDate) params.set('endDate', getDateRange.endDate);
      const res = await api.get(`/adventures/stats?${params.toString()}`, { signal });
      setStats(res.data);
      hasLoadedOnceRef.current = true;
    } catch (err) {
      if (err.name === 'AbortError') return;
      toast.error('Failed to load stats');
    } finally {
      if (isFirstLoad) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  const setFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (key === 'date') {
      if (value === 'custom') {
        params.set('date', 'custom');
      } else {
        params.set('date', value);
        params.delete('start');
        params.delete('end');
      }
    } else if (key === 'start' || key === 'end') {
      params.set('date', 'custom');
      params.set(key, value);
    } else {
      params.set(key, value);
    }
    setSearchParams(params);
  };

  const formatDistance = (km) => {
    if (!km) return '0 km';
    return `${km.toFixed(1)} km`;
  };

  const barChartData = useMemo(() => {
    if (!stats?.byYear) return [];
    return [...stats.byYear].reverse();
  }, [stats]);

  const pieChartData = useMemo(() => {
    if (!stats?.byTransport) return [];
    return stats.byTransport.map(t => ({
      name: t.type,
      count: t.count,
      distance: t.distance,
      value: t.distance,
      color: TYPE_COLORS[t.type] || TYPE_COLORS.other
    }));
  }, [stats]);

  const showCharts = stats?.byYear?.length > 0 || stats?.byTransport?.length > 0;
  const showHeatmap = stats?.byDate?.length > 0;

  if (loading) {
    return <div className="loading-screen">Loading statistics...</div>;
  }

  const { overview } = stats || { overview: {} };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      {refreshing && (
        <div style={{
          position: 'absolute',
          top: 24,
          right: 24,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--surface)',
          padding: '6px 12px',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-md)',
          fontSize: '13px',
          color: 'var(--text-light)',
          zIndex: 10
        }}>
          <span style={{
            width: '12px',
            height: '12px',
            border: '2px solid var(--border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          Updating...
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>Statistics</h1>
        <Link to="/" style={{ textDecoration: 'none', color: 'var(--accent)' }}>← Back to Dashboard</Link>
      </div>

      <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {DATE_PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => setFilter('date', p.value)}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: datePreset === p.value ? 'var(--accent)' : 'var(--surface)',
                color: datePreset === p.value ? 'white' : 'var(--text)',
                fontWeight: 500,
                fontSize: '13px'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {datePreset === 'custom' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setFilter('start', e.target.value)}
              style={{
                padding: '6px 10px',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '13px'
              }}
            />
            <span style={{ color: 'var(--text-light)' }}>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setFilter('end', e.target.value)}
              style={{
                padding: '6px 10px',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '13px'
              }}
            />
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['owned', 'shared', 'all'].map(v => (
            <button
              key={v}
              onClick={() => setFilter('view', v)}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: view === v ? 'var(--accent)' : 'var(--surface)',
                color: view === v ? 'white' : 'var(--text)',
                fontWeight: 500,
                fontSize: '13px'
              }}
            >
              {v === 'owned' ? 'My Adventures' : v === 'shared' ? 'Shared with Me' : 'All Adventures'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--accent)' }}>
            <AnimatedNumber value={overview.adventures || 0} />
          </div>
          <div style={{ color: 'var(--text-light)', marginTop: '4px' }}>Adventures</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--accent)' }}>
            <AnimatedNumber value={overview.photos || 0} />
          </div>
          <div style={{ color: 'var(--text-light)', marginTop: '4px' }}>Photos</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--accent)' }}>
            <AnimatedNumber value={overview.waypoints || 0} />
          </div>
          <div style={{ color: 'var(--text-light)', marginTop: '4px' }}>Waypoints</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--accent)' }}>
            <AnimatedNumber value={overview.tracks || 0} />
          </div>
          <div style={{ color: 'var(--text-light)', marginTop: '4px' }}>Tracks</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--accent)' }}>
            <AnimatedNumber value={overview.distance || 0} format={formatDistance} />
          </div>
          <div style={{ color: 'var(--text-light)', marginTop: '4px' }}>Total Distance</div>
        </div>
      </div>

      {showHeatmap && (
        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Activity Heatmap</h2>
          <ActivityHeatmap byDate={stats.byDate} />
        </div>
      )}

      {showCharts && (
        <div style={{ display: 'grid', gridTemplateColumns: stats.byTransport?.length > 0 ? '1fr 1fr' : '1fr', gap: '24px', marginBottom: '24px' }}>
          {stats.byYear?.length > 0 && (
            <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px' }}>
              <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Adventures by Year</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="year" tick={{ fill: '#64748B' }} />
                  <YAxis tick={{ fill: '#64748B' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#1a1a2e',
                      border: '1px solid #E2E8F0',
                      borderRadius: '6px',
                      color: '#F8FAFC',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                    labelStyle={{ color: '#94A3B8' }}
                  />
                  <Bar dataKey="count" name="Adventures" radius={[4, 4, 0, 0]}>
                    {barChartData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill="#10B981" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {stats.byTransport?.length > 0 && (
            <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px' }}>
              <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Distance by Transport</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, props) => [formatDistance(value), props.payload.name]}
                    contentStyle={{
                      background: '#1a1a2e',
                      border: '1px solid #E2E8F0',
                      borderRadius: '6px',
                      color: '#F8FAFC',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                    labelStyle={{ color: '#94A3B8' }}
                  />
                  <Legend
                    formatter={(value) => <span style={{ color: '#0F172A' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {!showCharts && !showHeatmap && (
        <div style={{ background: 'var(--surface)', padding: '40px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🗺️</div>
          <div style={{ color: 'var(--text-light)' }}>
            No stats yet. Start creating adventures and importing GPX tracks!
          </div>
        </div>
      )}
    </div>
  );
};

export default Stats;
