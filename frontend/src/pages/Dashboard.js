import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import api from '../services/api';

const Dashboard = () => {
  const [adventures, setAdventures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newAdventure, setNewAdventure] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadAdventures();
  }, []);

  const loadAdventures = async () => {
    try {
      const res = await api.get('/adventures');
      setAdventures(res.data.adventures);
    } catch (err) {
      console.error('Failed to load adventures:', err);
    } finally {
      setLoading(false);
    }
  };

  const createAdventure = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await api.post('/adventures', newAdventure);
      navigate(`/adventure/${res.data.adventure.id}/edit`);
    } catch (err) {
      console.error('Failed to create adventure:', err);
    } finally {
      setCreating(false);
      setShowModal(false);
    }
  };

  const getTypeColor = (type) => {
    const colors = {
      hiking: 'var(--gpx-hiking)',
      cycling: 'var(--gpx-cycling)',
      running: 'var(--gpx-running)',
      climbing: 'var(--gpx-climbing)',
      other: 'var(--gpx-other)'
    };
    return colors[type] || colors.other;
  };

  if (loading) {
    return <div className="loading-screen">Loading adventures...</div>;
  }

  return (
    <div>
      <header className="header">
        <h1>AdventureShare</h1>
        <div className="header-actions">
          <span>Welcome, {user?.username}</span>
          <Link to="/settings" className="btn btn-outline btn-sm">Settings</Link>
          <button onClick={logout} className="btn btn-outline btn-sm">Logout</button>
        </div>
      </header>

      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
          <h2>My Adventures</h2>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            + New Adventure
          </button>
        </div>

        {adventures.length === 0 ? (
          <div className="empty-state">
            <h3>No adventures yet</h3>
            <p>Create your first adventure to get started</p>
          </div>
        ) : (
            <div className="adventures-grid">
              {adventures.map(adventure => (
                <div 
                  key={adventure.id} 
                  className="adventure-card"
                  onClick={() => navigate(`/adventure/${adventure.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="adventure-card-preview">
                    {adventure.preview_picture ? (
                      <img 
                        src={adventure.preview_picture.thumbnail_base64 || adventure.preview_picture.thumbnail_url} 
                        alt={adventure.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        background: 'var(--background)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '3rem'
                      }}>
                        🗺️
                      </div>
                    )}
                    <div style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '12px',
                      color: 'white',
                      fontWeight: 600
                    }}>
                      {adventure.gpxCount} tracks
                    </div>
                  </div>
                  <div className="adventure-card-body">
                  <h3>{adventure.name}</h3>
                  {adventure.description && (
                    <p>{adventure.description.substring(0, 80)}...</p>
                  )}
                  <div className="adventure-stats">
                    <span className="stat">
                      📷 {adventure.pictureCount} photos
                    </span>
                    {adventure.gpxByType && Object.keys(adventure.gpxByType).map(type => (
                      <span 
                        key={type}
                        className="stat-badge"
                        style={{ backgroundColor: getTypeColor(type) }}
                      >
                        {adventure.gpxByType[type]} {type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>New Adventure</h2>
            <form onSubmit={createAdventure}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={newAdventure.name}
                  onChange={(e) => setNewAdventure({ ...newAdventure, name: e.target.value })}
                  placeholder="My Great Adventure"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={newAdventure.description}
                  onChange={(e) => setNewAdventure({ ...newAdventure, description: e.target.value })}
                  placeholder="A brief description..."
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
