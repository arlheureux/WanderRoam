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

  const getBounds = () => {
    const visibleTracks = tracks.filter(t => visibleAdventures[t.adventureId]);
    if (visibleTracks.length === 0) return [[46.2276, 2.2137], [46.2276, 2.2137]];
    
    const allPoints = visibleTracks
      .filter(t => t.data && t.data.length > 0)
      .flatMap(t => t.data.map(p => [p.lat, p.lng]));
    
    if (allPoints.length === 0) return [[46.2276, 2.2137], [46.2276, 2.2137]];
    
    return allPoints;
  };

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

      <div className="container">
        {tracks.length === 0 ? (
          <div className="empty-state">
            <h3>No tracks found</h3>
            <p>Add GPX tracks to your adventures to see them here</p>
            <Link to="/" className="btn btn-primary">Go to Dashboard</Link>
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

            <div style={{ height: 'calc(100vh - 200px)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <MapContainer 
                center={[46.2276, 2.2137]} 
                zoom={5} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapBounds tracks={tracks.filter(t => visibleAdventures[t.adventureId])} />
                {tracks.filter(t => visibleAdventures[t.adventureId]).map(track => (
                  <Polyline
                    key={track.id}
                    positions={track.data.map(p => [p.lat, p.lng])}
                    pathOptions={{ color: track.color, weight: 4, opacity: 0.8 }}
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
              {tracks.filter(t => visibleAdventures[t.adventureId]).length} tracks visible • Click on a track to see details
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GpxMap;
