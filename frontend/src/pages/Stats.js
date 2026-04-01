import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

const TYPE_COLORS = {
  walking: '#FF6B6B',
  hiking: '#FF9F43',
  cycling: '#4ECDC4',
  bus: '#A55EEA',
  metro: '#26DE81',
  train: '#45B7D1',
  boat: '#2D98DA',
  car: '#FC5C65',
  other: '#9B59B6'
};

const Stats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('all');

  useEffect(() => {
    loadStats();
  }, [view]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/adventures/stats?view=${view}`);
      setStats(res.data);
    } catch (err) {
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const formatDistance = (km) => {
    if (!km) return '0 km';
    return `${km.toFixed(1)} km`;
  };

  if (loading) {
    return <div className="loading-screen">Loading statistics...</div>;
  }

  const { overview, byYear, byTransport } = stats || { overview: {}, byYear: [], byTransport: [] };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>Statistics</h1>
        <Link to="/" style={{ textDecoration: 'none', color: 'var(--accent)' }}>← Back to Dashboard</Link>
      </div>

      <div style={{ marginBottom: '24px', display: 'flex', gap: '8px' }}>
        {['owned', 'shared', 'all'].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              background: view === v ? 'var(--accent)' : 'var(--surface)',
              color: view === v ? 'white' : 'var(--text)',
              fontWeight: 500
            }}
          >
            {v === 'owned' ? 'My Adventures' : v === 'shared' ? 'Shared with Me' : 'All Adventures'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--accent)' }}>{overview.adventures || 0}</div>
          <div style={{ color: 'var(--text-light)', marginTop: '4px' }}>Adventures</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--accent)' }}>{overview.photos || 0}</div>
          <div style={{ color: 'var(--text-light)', marginTop: '4px' }}>Photos</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--accent)' }}>{overview.waypoints || 0}</div>
          <div style={{ color: 'var(--text-light)', marginTop: '4px' }}>Waypoints</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--accent)' }}>{overview.tracks || 0}</div>
          <div style={{ color: 'var(--text-light)', marginTop: '4px' }}>Tracks</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--accent)' }}>{formatDistance(overview.distance)}</div>
          <div style={{ color: 'var(--text-light)', marginTop: '4px' }}>Total Distance</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '16px' }}>By Year</h2>
          {byYear.length === 0 ? (
            <div style={{ color: 'var(--text-light)', textAlign: 'center', padding: '20px' }}>No data</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Year</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Adventures</th>
                </tr>
              </thead>
              <tbody>
                {byYear.map(item => (
                  <tr key={item.year} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px' }}>{item.year}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 500 }}>{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '8px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '16px' }}>By Transport Mode</h2>
          {byTransport.length === 0 ? (
            <div style={{ color: 'var(--text-light)', textAlign: 'center', padding: '20px' }}>No data</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Tracks</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Distance</th>
                </tr>
              </thead>
              <tbody>
                {byTransport.map(item => (
                  <tr key={item.type} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px' }}>
                      <span style={{ 
                        display: 'inline-block', 
                        width: '12px', 
                        height: '12px', 
                        borderRadius: '50%', 
                        background: TYPE_COLORS[item.type] || TYPE_COLORS.other,
                        marginRight: '8px'
                      }} />
                      {item.type}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 500 }}>{item.count}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{formatDistance(item.distance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Stats;
