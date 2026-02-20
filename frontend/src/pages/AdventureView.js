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

const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const MapBounds = ({ tracks, pictures }) => {
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
  const [viewingPicture, setViewingPicture] = useState(null);
  const [pictureIndex, setPictureIndex] = useState(0);

  useEffect(() => {
    fixLeafletIcons();
    loadAdventure();
  }, [id]);

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
  
  const defaultCenter = [parseFloat(adventure.center_lat) || 46.2276, parseFloat(adventure.center_lng) || 2.2137];
  const defaultZoom = adventure.zoom || 10;

  return (
    <div>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/" className="back-link">← Back</Link>
          <h1>{adventure.name}</h1>
        </div>
        <div className="header-actions">
          <Link to={`/adventure/${id}/edit`} className="btn btn-outline btn-sm">Edit</Link>
          <button onClick={deleteAdventure} className="btn btn-danger btn-sm">Delete</button>
        </div>
      </header>

      <div className="container">
        <div className="adventure-detail">
          <div className="adventure-map-container">
            <MapContainer 
              center={defaultCenter} 
              zoom={defaultZoom} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {gpxTracks.map(track => (
                <Polyline
                  key={track.id}
                  positions={track.data?.map(p => [p.lat, p.lng]) || []}
                  pathOptions={{ 
                    color: track.color || TYPE_COLORS[track.type] || TYPE_COLORS.other,
                    weight: 4,
                    opacity: selectedTrack && selectedTrack.id !== track.id ? 0.4 : 1
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
                    icon={createCustomIcon('#FFD700')}
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

              <MapBounds tracks={gpxTracks} pictures={pictures} />
            </MapContainer>
          </div>

          <div className="adventure-sidebar">
            {adventure.description && (
              <div className="sidebar-section">
                <h3>Description</h3>
                <div style={{ 
                  padding: '12px', 
                  background: 'var(--background)', 
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  color: 'var(--text-light)'
                }}>
                  {adventure.description}
                </div>
              </div>
            )}

            <div className="sidebar-section">
              <h3>
                Transportation
                <span style={{ fontWeight: 400, color: 'var(--text-light)' }}>
                  {gpxTracks.length}
                </span>
              </h3>

              {gpxTracks.length === 0 ? (
                <p style={{ color: 'var(--text-light)' }}>No GPX tracks added yet</p>
              ) : (
                <div className="gpx-list">
                  {gpxTracks.map(track => (
                    <div 
                      key={track.id} 
                      className="gpx-item"
                      style={{ borderLeftColor: track.color || TYPE_COLORS[track.type] }}
                      onClick={() => setSelectedTrack(track)}
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

            <div className="sidebar-section">
              <h3>
                Pictures
                <span style={{ fontWeight: 400, color: 'var(--text-light)' }}>
                  {pictures.length}
                </span>
              </h3>
              {pictures.length === 0 ? (
                <p style={{ color: 'var(--text-light)' }}>No pictures added yet</p>
              ) : (
                <div className="picture-grid">
                  {pictures.map((picture, index) => (
                    <div 
                      key={picture.id} 
                      className="picture-thumb"
                      style={{ cursor: 'pointer' }}
                      onClick={() => openPicture(picture, index)}
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
              src={viewingPicture.full_base64 || viewingPicture.thumbnail_base64 || viewingPicture.thumbnail_url} 
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
