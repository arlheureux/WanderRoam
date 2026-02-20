import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import api from '../services/api';

const Settings = () => {
  const { user, updateSettings } = useAuth();
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
          <h1>Settings</h1>
        </div>
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

        <div className="settings-section">
          <h3>Account</h3>
          <p><strong>Username:</strong> {user?.username}</p>
          <p><strong>Email:</strong> {user?.email}</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
