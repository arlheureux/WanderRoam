import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

const fixLeafletIcons = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
};

const createCustomIcon = (color, scale = 1) => {
  const size = 24 * scale;
  const half = size / 2;
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half]
  });
};

const createWaypointIcon = (icon, scale = 1) => {
  const size = 21 * scale; // 25% smaller (28 * 0.75)
  return L.divIcon({
    className: 'waypoint-marker',
    html: `<div style="
      position: relative;
      width: ${size}px;
      height: ${size * 1.4}px;
      display: flex;
      flex-direction: column;
      align-items: center;
    ">
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: #FF6B6B;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      ">
        <span style="
          transform: rotate(45deg);
          font-size: ${size * 0.55}px;
          line-height: 1;
        ">${icon}</span>
      </div>
      <div style="
        width: 0;
        height: 0;
        border-left: ${size * 0.2}px solid transparent;
        border-right: ${size * 0.2}px solid transparent;
        border-top: ${size * 0.3}px solid #FF6B6B;
      "></div>
    </div>`,
    iconSize: [size, size * 1.4],
    iconAnchor: [size/2, size * 1.4],
    popupAnchor: [0, -size * 1.2]
  });
};

const MapBounds = ({ tracks, pictures, waypoints }) => {
  const map = useMap();

  useEffect(() => {
    const allPoints = [];
    
    if (tracks && tracks.length > 0) {
      const trackPoints = tracks
        .filter(t => t.data && t.data.length > 0)
        .flatMap(t => t.data.map(p => [p.lat, p.lng]));
      allPoints.push(...trackPoints);
    }
    
    if (pictures && pictures.length > 0) {
      const picturePoints = pictures
        .filter(p => p.latitude && p.longitude)
        .map(p => [p.latitude, p.longitude]);
      allPoints.push(...picturePoints);
    }

    if (waypoints && waypoints.length > 0) {
      const waypointPoints = waypoints.map(w => [w.latitude, w.longitude]);
      allPoints.push(...waypointPoints);
    }

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [tracks, pictures, map]);

  return null;
};

const AdventureView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [adventure, setAdventure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [hoveredTrackId, setHoveredTrackId] = useState(null);
  const [viewingPicture, setViewingPicture] = useState(null);
  const [pictureIndex, setPictureIndex] = useState(0);
  const [hoveredPictureId, setHoveredPictureId] = useState(null);

  useEffect(() => {
    fixLeafletIcons();
    loadAdventure();
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!viewingPicture) return;
      if (e.key === 'ArrowLeft') prevPicture();
      if (e.key === 'ArrowRight') nextPicture();
      if (e.key === 'Escape') setViewingPicture(null);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingPicture, pictureIndex]);

  const loadAdventure = async () => {
    try {
      const res = await api.get(`/adventures/${id}`);
      setAdventure(res.data.adventure);
    } catch (err) {
      console.error('Failed to load adventure:', err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const deleteAdventure = async () => {
    if (!window.confirm('Are you sure you want to delete this adventure?')) return;
    
    try {
      await api.delete(`/adventures/${id}`);
      navigate('/');
    } catch (err) {
      console.error('Failed to delete adventure:', err);
    }
  };

  const openPicture = (picture, index) => {
    setPictureIndex(index);
    setViewingPicture(picture);
  };

  const nextPicture = () => {
    const nextIndex = (pictureIndex + 1) % pictures.length;
    setPictureIndex(nextIndex);
    setViewingPicture(pictures[nextIndex]);
  };

  const prevPicture = () => {
    const prevIndex = (pictureIndex - 1 + pictures.length) % pictures.length;
    setPictureIndex(prevIndex);
    setViewingPicture(pictures[prevIndex]);
  };

  if (loading) {
    return <div className="loading-screen">Loading adventure...</div>;
  }

  if (!adventure) {
    return <div className="loading-screen">Adventure not found</div>;
  }

  const gpxTracks = adventure.GpxTracks || [];
  const pictures = adventure.Pictures || [];
  const waypoints = adventure.Waypoints || [];
  
  const defaultCenter = [parseFloat(adventure.center_lat) || 46.2276, parseFloat(adventure.center_lng) || 2.2137];
  const defaultZoom = adventure.zoom || 10;

  return (
    <div>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/" className="back-link">← Back</Link>
        </div>
        <h1 style={{ flex: 1, textAlign: 'center', margin: 0 }}>{adventure.name}</h1>
        <div className="header-actions">
          <Link to={`/adventure/${id}/edit`} className="btn btn-outline btn-sm">Edit</Link>
          <button onClick={deleteAdventure} className="btn btn-danger btn-sm">Delete</button>
        </div>
      </header>

      <div className="container">
        {/* Row 1: Date (30%) + Description (70%) */}
        <div className="adventure-info-row" style={{ marginBottom: '16px' }}>
          {adventure.adventure_date && (
            <div className="sidebar-section" style={{ flex: '0 0 30%' }}>
              <h3>Date</h3>
              <div style={{ 
                padding: '12px', 
                background: 'var(--background)', 
                borderRadius: '8px',
                fontSize: '0.9rem',
                color: 'var(--text-light)'
              }}>
                {new Date(adventure.adventure_date).toLocaleDateString(undefined, { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          )}

          <div className="sidebar-section" style={{ flex: '1' }}>
            <h3>Description</h3>
            <div style={{ 
              padding: '12px', 
              background: 'var(--background)', 
              borderRadius: '8px',
              fontSize: '0.9rem',
              color: adventure.description ? 'var(--text-light)' : 'var(--text-light)',
              fontStyle: adventure.description ? 'normal' : 'italic',
              opacity: adventure.description ? 1 : 0.5,
              minHeight: '60px'
            }}>
              {adventure.description || 'No description'}
            </div>
          </div>
        </div>

        {/* Row 2: Transportation (100%) */}
        <div className="sidebar-section" style={{ marginBottom: '16px' }}>
          <h3>
            Transportation
            <span style={{ fontWeight: 400, color: 'var(--text-light)', marginLeft: '8px' }}>
              {gpxTracks.length}
            </span>
          </h3>

          {gpxTracks.length === 0 ? (
            <p style={{ color: 'var(--text-light)' }}>No GPX tracks</p>
          ) : (
            <div className="gpx-list">
              {gpxTracks.map(track => (
                <div 
                  key={track.id} 
                  className="gpx-item"
                  style={{ 
                    borderLeftColor: track.color || TYPE_COLORS[track.type],
                    background: hoveredTrackId === track.id ? 'var(--background)' : 'transparent'
                  }}
                  onClick={() => setSelectedTrack(track)}
                  onMouseEnter={() => setHoveredTrackId(track.id)}
                  onMouseLeave={() => setHoveredTrackId(null)}
                >
                  <div>
                    <div className="gpx-item-name">{track.name}</div>
                    <div className="gpx-item-type">{track.type}</div>
                    {track.distance > 0 && (
                      <div className="gpx-item-stats">
                        {track.distance.toFixed(1)} km
                      </div>
                    )}
                  </div>
                  <span style={{ 
                    color: track.color || TYPE_COLORS[track.type],
                    fontWeight: 600
                  }}>
                    ●
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Row 3: Map (60%) + Pictures (40%) */}
        <div className="adventure-content-row">
          <div className="adventure-map-card">
            <div className="adventure-card-header">
              <h3>Map</h3>
            </div>
            <div className="adventure-map-container">
              <MapContainer 
              center={defaultCenter} 
              zoom={defaultZoom} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="httpsmap.org/copyright://www.openstreet">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {gpxTracks.map(track => (
                <Polyline
                  key={track.id}
                  positions={track.data?.map(p => [p.lat, p.lng]) || []}
                  pathOptions={{ 
                    color: track.color || TYPE_COLORS[track.type] || TYPE_COLORS.other,
                    weight: 5,
                    opacity: (selectedTrack && selectedTrack.id !== track.id) || (hoveredTrackId && hoveredTrackId !== track.id) ? 0.4 : 1
                  }}
                  eventHandlers={{
                    click: () => setSelectedTrack(track)
                  }}
                />
              ))}

              {pictures.map(picture => (
                picture.latitude && picture.longitude && (
                  <Marker
                    key={picture.id}
                    position={[picture.latitude, picture.longitude]}
                    icon={createCustomIcon(hoveredPictureId === picture.id ? '#10B981' : '#FFD700', hoveredPictureId === picture.id ? 1.5 : 1)}
                  >
                    <Popup>
                      {(picture.thumbnail_base64 || picture.thumbnail_url) && (
                        <img 
                          src={picture.thumbnail_base64 || picture.thumbnail_url} 
                          alt={picture.filename}
                          style={{ maxWidth: '240px', marginTop: '8px', borderRadius: '4px' }}
                        />
                      )}
                    </Popup>
                  </Marker>
                )
              ))}

              {waypoints.map(waypoint => (
                <Marker
                  key={waypoint.id}
                  position={[waypoint.latitude, waypoint.longitude]}
                  icon={createWaypointIcon(waypoint.icon)}
                >
                  <Popup>
                    <div style={{ minWidth: '100px', textAlign: 'center' }}>
                      <strong>{waypoint.name || 'Waypoint'}</strong>
                      <div style={{ fontSize: '1.5rem', marginTop: '4px' }}>{waypoint.icon}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              <MapBounds tracks={gpxTracks} pictures={pictures} waypoints={waypoints} />
            </MapContainer>
            </div>
          </div>

          <div className="adventure-picture-section">
            <div className="sidebar-section">
              <div className="adventure-card-header">
                <h3>
                  Pictures
                  <span style={{ fontWeight: 400, color: 'var(--text-light)', marginLeft: '8px' }}>
                    {pictures.length}
                  </span>
                </h3>
              </div>
              {pictures.length === 0 ? (
                <p style={{ color: 'var(--text-light)' }}>No pictures added yet</p>
              ) : (
                <div className="picture-grid">
                  {pictures.map((picture, index) => (
                    <div 
                      key={picture.id} 
                      className="picture-thumb"
                      style={{ cursor: 'pointer', transform: hoveredPictureId === picture.id ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }}
                      onClick={() => openPicture(picture, index)}
                      onMouseEnter={() => setHoveredPictureId(picture.id)}
                      onMouseLeave={() => setHoveredPictureId(null)}
                    >
                      {(picture.thumbnail_base64 || picture.thumbnail_url) ? (
                        <img src={picture.thumbnail_base64 || picture.thumbnail_url} alt={picture.filename} />
                      ) : (
                        <div style={{ 
                          width: '100%', 
                          height: '100%', 
                          background: 'var(--background)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          📷
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {viewingPicture && (
        <div 
          className="modal-overlay" 
          onClick={() => setViewingPicture(null)}
          style={{ background: 'rgba(0,0,0,0.95)', cursor: 'pointer' }}
        >
          <div 
            onClick={e => e.stopPropagation()} 
            style={{ 
              position: 'relative', 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center'
            }}
          >
            <img 
              src={viewingPicture.thumbnail_base64 || viewingPicture.thumbnail_url} 
              alt={viewingPicture.filename}
              style={{ maxWidth: '110%', maxHeight: '110%', objectFit: 'contain' }}
            />
            {pictures.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prevPicture(); }}
                  className="btn"
                  style={{
                    position: 'absolute',
                    left: '20px',
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: 'white',
                    fontSize: '1.5rem',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  ←
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); nextPicture(); }}
                  className="btn"
                  style={{
                    position: 'absolute',
                    right: '20px',
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: 'white',
                    fontSize: '1.5rem',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  →
                </button>
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  color: 'white',
                  fontSize: '0.9rem',
                  background: 'rgba(0,0,0,0.5)',
                  padding: '8px 16px',
                  borderRadius: '20px'
                }}>
                  {pictureIndex + 1} / {pictures.length}
                </div>
              </>
            )}
            <button
              onClick={() => setViewingPicture(null)}
              className="btn"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                fontSize: '1.2rem',
                padding: '10px 14px',
                borderRadius: '50%',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdventureView;
