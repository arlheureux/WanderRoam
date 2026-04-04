import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { useMapContext } from '../contexts/MapContext';
import api from '../services/api';

const Settings = () => {
  const { user, updateSettings } = useAuth();
  const { mapProvider, setMapProvider, mapboxToken, setMapboxToken } = useMapContext();
  const navigate = useNavigate();
  
  const [immichUrl, setImmichUrl] = useState(user?.immich_url || '');
  const [immichApiKey, setImmichApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState({ connected: false, checking: true });
  const [message, setMessage] = useState('');

  useEffect(() => {
    checkImmichStatus();
  }, []);

  const checkImmichStatus = async () => {
    try {
      const res = await api.get('/immich/status');
      setStatus({ 
        connected: res.data.connected, 
        checking: false,
        url: res.data.url
      });
    } catch (err) {
      setStatus({ connected: false, checking: false });
    }
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    setConnecting(true);
    setMessage('');

    try {
      const res = await api.post('/immich/connect', {
        immich_url: immichUrl,
        immich_api_key: immichApiKey
      });
      
      setStatus({ connected: true, checking: false, url: res.data.url });
      setMessage('Connected to Immich successfully!');
      await updateSettings({ immich_url: immichUrl, immich_api_key: immichApiKey });
    } catch (err) {
      setMessage(err.message || 'Failed to connect to Immich');
      setStatus({ connected: false, checking: false });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/" className="back-link">← Back</Link>
        </div>
        <h1>Settings</h1>
        <div style={{ width: '100px' }}></div>
      </header>

      <div className="container" style={{ maxWidth: '600px' }}>
        <div className="settings-section">
          <h3>Immich Integration</h3>
          <p style={{ color: 'var(--text-light)', marginBottom: '16px' }}>
            Connect to your Immich instance to add photos to your adventures.
          </p>

          {status.checking ? (
            <p>Checking connection status...</p>
          ) : (
            <>
              <div className="immich-status">
                <span className={`status-dot ${status.connected ? 'connected' : 'disconnected'}`}></span>
                <span>
                  {status.connected 
                    ? `Connected to ${status.url}` 
                    : 'Not connected'}
                </span>
              </div>

              {message && (
                <div className={message.includes('success') ? '' : 'error-message'} 
                     style={{ 
                       padding: '12px', 
                       borderRadius: '8px', 
                       marginBottom: '16px',
                       background: message.includes('success') ? '#E8F5E9' : '#FFEBEE',
                       color: message.includes('success') ? '#2E7D32' : '#C62828'
                     }}>
                  {message}
                </div>
              )}

              <form onSubmit={handleConnect}>
                <div className="form-group">
                  <label>Immich URL</label>
                  <input
                    type="url"
                    value={immichUrl}
                    onChange={(e) => setImmichUrl(e.target.value)}
                    placeholder="http://localhost:2283"
                  />
                </div>
                <div className="form-group">
                  <label>API Key</label>
                  <input
                    type="password"
                    value={immichApiKey}
                    onChange={(e) => setImmichApiKey(e.target.value)}
                    placeholder="Enter your Immich API key"
                  />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '4px' }}>
                    Get your API key from Immich Admin Settings → API Keys
                  </p>
                </div>
                <button type="submit" className="btn btn-primary" disabled={connecting}>
                  {connecting ? 'Connecting...' : status.connected ? 'Update Connection' : 'Connect'}
                </button>
              </form>

              {status.connected && (
                <div style={{ marginTop: '24px', padding: '16px', background: 'var(--background)', borderRadius: '8px' }}>
                  <h4 style={{ marginBottom: '12px' }}>How to add photos:</h4>
                  <ol style={{ paddingLeft: '20px', color: 'var(--text-light)' }}>
                    <li>Go to your adventure and click "Edit"</li>
                    <li>Click "+ Add from Immich" in the Pictures section</li>
                    <li>Select photos that have GPS coordinates</li>
                    <li>Photos will appear on the map</li>
                  </ol>
                </div>
              )}
            </>
          )}
        </div>

        <div className="settings-section" style={{ marginTop: '32px' }}>
          <h3>Map Provider</h3>
          <p style={{ color: 'var(--text-light)', marginBottom: '16px' }}>
            Choose which map service to use. Mapbox offers 3D terrain and globe view.
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => setMapProvider('osm')}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: mapProvider === 'osm' ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: mapProvider === 'osm' ? 'var(--primary)' + '15' : 'var(--background)',
                cursor: 'pointer',
                flex: 1
              }}
            >
              <div style={{ fontWeight: 600 }}>OpenStreetMap</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>Free, always available</div>
            </button>
            <button
              type="button"
              onClick={() => setMapProvider('mapbox')}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: mapProvider === 'mapbox' ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: mapProvider === 'mapbox' ? 'var(--primary)' + '15' : 'var(--background)',
                cursor: 'pointer',
                flex: 1
              }}
            >
              <div style={{ fontWeight: 600 }}>Mapbox</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>3D terrain, globe view</div>
            </button>
          </div>

          {mapProvider === 'mapbox' && (
            <div style={{ padding: '16px', background: 'var(--background)', borderRadius: '8px' }}>
              <div className="form-group">
                <label>Mapbox Access Token</label>
                <input
                  type="text"
                  value={mapboxToken}
                  onChange={(e) => setMapboxToken(e.target.value)}
                  placeholder="pk.eyJ1..."
                />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '4px' }}>
                  Get your free token at{' '}
                  <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer">
                    mapbox.com
                  </a>
                </p>
              </div>
              {!mapboxToken && (
                <div style={{ 
                  padding: '12px', 
                  background: '#FFF3E0', 
                  borderRadius: '8px', 
                  color: '#E65100',
                  fontSize: '0.85rem'
                }}>
                  ⚠️ Enter your Mapbox token to use Mapbox maps
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
