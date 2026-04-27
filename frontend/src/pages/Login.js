import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import api from '../services/api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/config')
      .then(res => setRegistrationEnabled(res.data.registrationEnabled))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g transform="rotate(45 16 16)">
              <rect x="5" y="5" width="10" height="10" fill="var(--accent)"/>
              <rect x="5" y="17" width="10" height="10" fill="var(--accent)"/>
              <rect x="17" y="5" width="10" height="10" fill="var(--accent)"/>
              <rect x="17" y="17" width="10" height="10" fill="var(--accent)"/>
            </g>
          </svg>
        </div>
        
        <h2>Welcome Back</h2>
        <p className="auth-subtitle">Sign in to continue your adventures</p>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {registrationEnabled && (
          <p style={{ textAlign: 'center', marginTop: '16px', color: 'var(--text-light)' }}>
            Don't have an account? <Link to="/register">Create one</Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default Login;
