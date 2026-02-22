import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import { useAuth } from '../services/AuthContext';

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

const GpxMap = () => {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleAdventures, setVisibleAdventures] = useState({});
  const [hoveredAdventure, setHoveredAdventure] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    try {
      const res = await api.get('/adventures/all-gpx');
      setTracks(res.data.tracks);
      
      const adventures = {};
      res.data.tracks.forEach(t => {
        adventures[t.adventureId] = true;
      });
      setVisibleAdventures(adventures);
    } catch (err) {
      console.error('Failed to load tracks:', err);
    } finally {
      setLoading(false);
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

  const uniqueAdventures = [...new Set(tracks.map(t => JSON.stringify({ id: t.adventureId, name: t.adventureName, color: t.color })))].map(s => JSON.parse(s));

  const visibleTracks = tracks.filter(t => visibleAdventures[t.adventureId]);

  if (loading) {
    return <div className="loading-screen">Loading tracks...</div>;
  }

  return (
    <div>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/" className="back-link">← Back</Link>
        </div>
        <h1>All GPX Tracks</h1>
        <div className="header-actions">
          <span>Welcome, {user?.username}</span>
          <button onClick={logout} className="btn btn-outline btn-sm">Logout</button>
        </div>
      </header>

      <div className="container" style={{ display: 'flex', gap: '24px', marginTop: '24px' }}>
        {/* Sidebar */}
        <div className="sidebar" style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Adventure Legend */}
          <div className="sidebar-section">
            <h3 style={{ marginBottom: '16px' }}>
              Adventures
              <span style={{ fontWeight: 400, color: 'var(--text-light)', marginLeft: '8px' }}>
                ({uniqueAdventures.length})
              </span>
            </h3>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button onClick={() => toggleAll(true)} className="btn btn-outline btn-sm" style={{ flex: 1 }}>Show All</button>
              <button onClick={() => toggleAll(false)} className="btn btn-outline btn-sm" style={{ flex: 1 }}>Hide All</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {uniqueAdventures.map(adv => (
                <label 
                  key={adv.id}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: hoveredAdventure === adv.id || visibleAdventures[adv.id] ? adv.color + '15' : 'transparent',
                    border: `1px solid ${visibleAdventures[adv.id] ? adv.color : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={() => setHoveredAdventure(adv.id)}
                  onMouseLeave={() => setHoveredAdventure(null)}
                >
                  <input
                    type="checkbox"
                    checked={!!visibleAdventures[adv.id]}
                    onChange={() => toggleAdventure(adv.id)}
                    style={{ accentColor: adv.color, width: '16px', height: '16px' }}
                  />
                  <span 
                    style={{ 
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      background: adv.color,
                      flexShrink: 0
                    }} 
                  />
                  <span style={{ fontSize: '0.9rem', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {adv.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                    {tracks.filter(t => t.adventureId === adv.id).length}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Selected Track Info */}
          {selectedTrack && (
            <div className="sidebar-section">
              <h3 style={{ marginBottom: '12px' }}>Selected Track</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{selectedTrack.name}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                  Adventure: {selectedTrack.adventureName}
                </div>
                {selectedTrack.distance && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                    Distance: {selectedTrack.distance.toFixed(1)} km
                  </div>
                )}
                {selectedTrack.adventureDate && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                    Date: {new Date(selectedTrack.adventureDate).toLocaleDateString()}
                  </div>
                )}
                {selectedTrack.ownerName && !selectedTrack.isOwner && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                    Shared by: {selectedTrack.ownerName}
                  </div>
                )}
                <button 
                  onClick={() => navigate(`/adventure/${selectedTrack.adventureId}`)}
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '8px' }}
                >
                  View Adventure
                </button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="sidebar-section">
            <h3 style={{ marginBottom: '8px' }}>Statistics</h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
              <div>Visible tracks: {visibleTracks.length}</div>
              <div>Total tracks: {tracks.length}</div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {tracks.length === 0 ? (
            <div className="empty-state">
              <h3>No tracks found</h3>
              <p>Add GPX tracks to your adventures to see them here</p>
              <Link to="/" className="btn btn-primary">Go to Dashboard</Link>
            </div>
          ) : (
            <>
              <div className="adventure-map-card" style={{ flex: 1, minHeight: '600px' }}>
                <div className="adventure-card-header">
                  <h3>Map</h3>
                  <span style={{ fontWeight: 400, color: 'var(--text-light)', fontSize: '0.85rem' }}>
                    {visibleTracks.length} tracks visible • Click track for details
                  </span>
                </div>
                <div className="adventure-map-container" style={{ height: 'auto', flex: 1 }}>
                  <MapContainer 
                    center={[46.2276, 2.2137]} 
                    zoom={5} 
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> & CartoDB'
                      url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    />
                    <MapBounds tracks={visibleTracks} />
                    {visibleTracks.map(track => (
                      <Polyline
                        key={track.id}
                        positions={track.data.map(p => [p.lat, p.lng])}
                        pathOptions={{ 
                          color: track.color, 
                          weight: 6, 
                          opacity: (hoveredAdventure && hoveredAdventure !== track.adventureId) || (selectedTrack && selectedTrack.id !== track.id) ? 0.3 : 1
                        }}
                        eventHandlers={{
                          click: () => setSelectedTrack(track)
                        }}
                      />
                    ))}
                  </MapContainer>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GpxMap;
