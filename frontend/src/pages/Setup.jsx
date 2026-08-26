import React, { useState } from 'react';
import api from '../services/api';

function isNative() {
  return window.Capacitor?.isNativePlatform?.() || false;
}

const Setup = () => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConnect = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const trimmed = url.trim().replace(/\/+$/, '');
    if (!trimmed) {
      setError('Please enter a server URL');
      setSaving(false);
      return;
    }

    try {
      new URL(trimmed);
    } catch {
      setError('Please enter a valid URL (e.g. https://wanderroam.example.com)');
      setSaving(false);
      return;
    }

    try {
      await api.setServerUrl(trimmed);
      if (isNative()) {
        const { registerPlugin } = await import('@capacitor/core');
        const ServerLoader = registerPlugin('ServerLoader');
        await ServerLoader.loadServerUrl({ url: trimmed });
      } else {
        window.location.reload();
      }
    } catch (err) {
      setError('Failed to save: ' + err.message);
      setSaving(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--background)',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'var(--surface)',
        borderRadius: '16px',
        padding: '40px 32px',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center'
      }}>
        <img
          src="/logo.svg"
          alt="WanderRoam"
          style={{ width: '64px', height: '64px', marginBottom: '24px' }}
        />
        <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Welcome to WanderRoam</h1>
        <p style={{ color: 'var(--text-light)', marginBottom: '24px' }}>
          Enter the URL of your WanderRoam server to get started.
        </p>

        <form onSubmit={handleConnect}>
          <div style={{ marginBottom: '16px', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              marginBottom: '6px'
            }}>
              Server URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://wanderroam.example.com"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--background)',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              background: '#FFEBEE',
              color: '#C62828',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
          >
            {saving ? 'Connecting...' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Setup;
