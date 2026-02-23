import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../services/AuthContext';
import api from '../services/api';

const Logo = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '12px' }}>
    <g transform="rotate(45 16 16)">
      <rect x="5" y="5" width="10" height="10" fill="#00B894"/>
      <rect x="5" y="17" width="10" height="10" fill="#00B894"/>
      <rect x="17" y="5" width="10" height="10" fill="#00B894"/>
      <rect x="17" y="17" width="10" height="10" fill="#00B894"/>
    </g>
  </svg>
);

const fixLeafletIcons = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
};
fixLeafletIcons();

const MapBounds = ({ tracks }) => {
  const map = useMap();

  useEffect(() => {
    if (tracks && tracks.length > 0) {
      const allPoints = tracks
        .filter(t => t.data && t.data.length > 0)
        .flatMap(t => t.data.map(p => [p.lat, p.lng]));

      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [tracks, map]);

  return null;
};

const Dashboard = () => {
  const [adventures, setAdventures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newAdventure, setNewAdventure] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('sortBy') || 'adventure_date');
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('sortOrder') || 'DESC');
  const [activeTab, setActiveTab] = useState('adventures');
  const [allTracks, setAllTracks] = useState([]);
  const [visibleAdventures, setVisibleAdventures] = useState({});
  const [appVersion, setAppVersion] = useState({ version: '', tag: '' });
  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadAdventures();
    loadTags();
    api.getVersion().then(v => setAppVersion(v)).catch(() => {});
  }, [sortBy, sortOrder, selectedTags]);

  useEffect(() => {
    if (activeTab === 'map') {
      loadAllTracks();
    }
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('sortBy', sortBy);
    localStorage.setItem('sortOrder', sortOrder);
  }, [sortBy, sortOrder]);

  const loadTags = async () => {
    try {
      const res = await api.getTags();
      setAllTags(res.data.tags || []);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  const loadAdventures = async () => {
    try {
      const tagsParam = selectedTags.length > 0 ? `&tags=${selectedTags.join(',')}` : '';
      const res = await api.get(`/adventures?sort=${sortBy}&order=${sortOrder}${tagsParam}`);
      setAdventures(res.data.adventures);
    } catch (err) {
      console.error('Failed to load adventures:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllTracks = async () => {
    try {
      const res = await api.get('/adventures/all-gpx');
      setAllTracks(res.data.tracks);
      
      const adventures = {};
      res.data.tracks.forEach(t => {
        adventures[t.adventureId] = true;
      });
      setVisibleAdventures(adventures);
    } catch (err) {
      console.error('Failed to load tracks:', err);
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

  const toggleAdventure = (adventureId) => {
    setVisibleAdventures(prev => ({
      ...prev,
      [adventureId]: !prev[adventureId]
    }));
  };

  const toggleAll = (show) => {
    const adventures = {};
    Object.keys(visibleAdventures).forEach(id => {
      adventures[id] = show;
    });
    setVisibleAdventures(adventures);
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

  const uniqueAdventures = [...new Set(allTracks.map(t => JSON.stringify({ id: t.adventureId, name: t.adventureName, color: t.color })))].map(s => JSON.parse(s));

  if (loading && activeTab === 'adventures') {
    return <div className="loading-screen">Loading adventures...</div>;
  }

  return (
    <div>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Logo />
          <h1>WanderRoam</h1>
          {appVersion.version && (
            <span style={{ marginLeft: '12px', fontSize: '0.75rem', color: 'var(--text-light)', background: 'var(--background)', padding: '4px 8px', borderRadius: '4px' }}>
              {appVersion.version} ({appVersion.tag})
            </span>
          )}
        </div>
        <div className="header-actions">
          <Link to="/settings" className="btn btn-outline btn-sm">Settings</Link>
          <span>Welcome, {user?.username}</span>
          <button onClick={logout} className="btn btn-outline btn-sm">Logout</button>
        </div>
      </header>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        padding: '12px 0', 
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ 
          display: 'flex', 
          gap: '4px', 
          padding: '4px',
          background: 'var(--background)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <button
            onClick={() => setActiveTab('adventures')}
            className={`tab-btn ${activeTab === 'adventures' ? 'active' : ''}`}
          >
            📋 Adventures
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
          >
            🗺️ All Tracks
          </button>
        </div>
      </div>

      {activeTab === 'adventures' && (
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            <h2>My Adventures</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Sort by:</span>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)' }}
              >
                <option value="adventure_date">Date</option>
                <option value="createdAt">Created</option>
                <option value="name">Name</option>
              </select>
              <button 
                onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
                className="btn btn-outline btn-sm"
                title={sortOrder === 'ASC' ? 'Ascending' : 'Descending'}
              >
                {sortOrder === 'ASC' ? '↑' : '↓'}
              </button>
              <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ marginLeft: '8px' }}>
                + New Adventure
              </button>
            </div>
          </div>

          {allTags.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginRight: '8px' }}>Filter:</span>
              <button
                onClick={() => setSelectedTags([])}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  borderRadius: '12px',
                  border: selectedTags.length === 0 ? '1px solid #2196F3' : '1px solid var(--border)',
                  background: selectedTags.length === 0 ? '#E3F2FD' : 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  marginBottom: '8px'
                }}
              >
                All
              </button>
              {['activity', 'location'].map(type => {
                const typeTags = allTags.filter(t => t.type === type);
                if (typeTags.length === 0) return null;
                return (
                  <div key={type} style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {type === 'activity' ? 'Activities' : 'Locations'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {typeTags.map(tag => {
                        const isSelected = selectedTags.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTags(selectedTags.filter(id => id !== tag.id));
                              } else {
                                setSelectedTags([...selectedTags, tag.id]);
                              }
                            }}
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.8rem',
                              borderRadius: '12px',
                              border: `1px solid ${isSelected ? tag.color : 'var(--border)'}`,
                              background: isSelected ? tag.color + '20' : 'transparent',
                              color: 'var(--text)',
                              cursor: 'pointer'
                            }}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
                    {adventure.adventure_date && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '-8px' }}>
                        {new Date(adventure.adventure_date).toLocaleDateString(undefined, { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </p>
                    )}
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
                      {adventure.tags && adventure.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                          {adventure.tags.map(tag => (
                            <span
                              key={tag.id}
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.7rem',
                                borderRadius: '10px',
                                background: tag.color + '30',
                                color: tag.color,
                                border: `1px solid ${tag.color}`
                              }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'map' && (
        <div className="container">
          {allTracks.length === 0 ? (
            <div className="empty-state">
              <h3>No tracks found</h3>
              <p>Add GPX tracks to your adventures to see them here</p>
            </div>
          ) : (
            <>
              <div style={{ 
                marginTop: '16px', 
                marginBottom: '16px', 
                padding: '12px', 
                background: 'var(--surface)', 
                borderRadius: '8px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: 600 }}>Adventures:</span>
                <button onClick={() => toggleAll(true)} className="btn btn-outline btn-sm">Show All</button>
                <button onClick={() => toggleAll(false)} className="btn btn-outline btn-sm">Hide All</button>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginLeft: '8px' }}>
                  {uniqueAdventures.map(adv => (
                    <label 
                      key={adv.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: visibleAdventures[adv.id] ? adv.color + '20' : 'transparent',
                        border: `1px solid ${visibleAdventures[adv.id] ? adv.color : 'var(--border)'}`,
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!visibleAdventures[adv.id]}
                        onChange={() => toggleAdventure(adv.id)}
                        style={{ accentColor: adv.color }}
                      />
                      <span style={{ fontSize: '0.85rem' }}>{adv.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ height: 'calc(100vh - 280px)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <MapContainer 
                  center={[46.2276, 2.2137]} 
                  zoom={5} 
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapBounds tracks={allTracks.filter(t => visibleAdventures[t.adventureId])} />
                  {allTracks.filter(t => visibleAdventures[t.adventureId]).map(track => (
                    <Polyline
                      key={track.id}
                      positions={track.data.map(p => [p.lat, p.lng])}
                      pathOptions={{ color: track.color, weight: 3, opacity: 0.8 }}
                    >
                      <Popup>
                        <div style={{ minWidth: '150px' }}>
                          <strong>{track.name}</strong><br />
                          <span style={{ fontSize: '0.85rem', color: '#666' }}>
                            Adventure: {track.adventureName}
                          </span>
                          {track.adventureDate && (
                            <><br /><span style={{ fontSize: '0.85rem', color: '#666' }}>
                              {new Date(track.adventureDate).toLocaleDateString()}
                            </span></>
                          )}
                          {track.ownerName && !track.isOwner && (
                            <><br /><span style={{ fontSize: '0.85rem', color: '#666' }}>
                              Shared by: {track.ownerName}
                            </span></>
                          )}
                        </div>
                      </Popup>
                    </Polyline>
                  ))}
                </MapContainer>
              </div>

              <div style={{ marginTop: '16px', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                {allTracks.filter(t => visibleAdventures[t.adventureId]).length} tracks visible • Click on a track to see details
              </div>
            </>
          )}
        </div>
      )}

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
