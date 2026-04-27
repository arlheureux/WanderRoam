import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Polyline, Marker, Popup } from 'react-leaflet';
import { FullscreenControl } from 'react-leaflet-fullscreen';
import L from 'leaflet';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import 'leaflet/dist/leaflet.css';
import 'leaflet-fullscreen/dist/leaflet.fullscreen.css';
import 'react-leaflet-fullscreen/styles.css';
import toast from 'react-hot-toast';
import { useMapContext } from '../contexts/MapContext';
import { MapView, TYPE_COLORS } from '../components/MapView';
import api from '../services/api';

const fixLeafletIcons = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
};

const createCustomIcon = (color, scale = 1) => {
  const size = 26 * scale;
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
  const size = 32 * scale;
  const half = size / 2;
  return L.divIcon({
    className: 'waypoint-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: #FFFDD0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 2px solid #ddd;
    ">
      <span style="
        font-size: ${size * 0.5}px;
        line-height: 1;
      ">${icon}</span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half]
  });
};

const waypointIconCache = {};

const getWaypointIcon = (icon, scale = 1) => {
  const key = `${icon}-${scale}`;
  if (!waypointIconCache[key]) {
    waypointIconCache[key] = createWaypointIcon(icon, scale);
  }
  return waypointIconCache[key];
};

const AdventureView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const seriesId = searchParams.get('seriesId');
  const backLink = seriesId ? `/series/${seriesId}` : '/';
  const [adventure, setAdventure] = useState(null);
  const [loading, setLoading] = useState(true);
  const handleTrackClick = (track) => {
    if (selectedTrack && selectedTrack.id === track.id) {
      setSelectedTrack(null);
      setSelectedTrackBounds(null);
    } else {
      setSelectedTrack(track);
      const trackPoints = track.data?.map(p => [p.lat, p.lng]) || [];
      setSelectedTrackBounds(trackPoints);
    }
  };
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [selectedTrackBounds, setSelectedTrackBounds] = useState(null);
  const [hoveredTrackId, setHoveredTrackId] = useState(null);
  const [viewingPicture, setViewingPicture] = useState(null);
  const [pictureIndex, setPictureIndex] = useState(0);
  const [hoveredPictureId, setHoveredPictureId] = useState(null);
  const mapRef = useRef(null);
  const { mapProvider, mapboxToken } = useMapContext();

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
      toast.error('Failed to load adventure');
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
      toast.error('Failed to delete adventure');
    }
  };

  const exportToPdf = async () => {
    try {
      toast.loading('Generating PDF...', { id: 'pdf' });
      
      const gpxTracks = adventure.GpxTracks || [];
      const totalDistance = gpxTracks.reduce((sum, t) => sum + (t.distance || 0), 0);
      const totalElevation = gpxTracks.reduce((sum, t) => sum + (t.elevation_gain || 0), 0);
      const totalDuration = gpxTracks.reduce((sum, t) => sum + (t.duration || 0), 0);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = margin;

      pdf.setFontSize(20);
      pdf.setTextColor(16, 185, 129);
      pdf.text(adventure.name, margin, yPos);
      yPos += 10;

      if (adventure.adventure_date) {
        pdf.setFontSize(10);
        pdf.setTextColor(100, 116, 139);
        pdf.text(new Date(adventure.adventure_date).toLocaleDateString(), margin, yPos);
        yPos += 10;
      }

      if (adventure.location) {
        pdf.setFontSize(11);
        pdf.setTextColor(15, 23, 42);
        pdf.text(`Location: ${adventure.location}`, margin, yPos);
        yPos += 8;
      }

      const mapElement = document.querySelector('.adventure-map-card .leaflet-container');
      if (mapElement) {
        try {
          const canvas = await html2canvas(mapElement, { 
            useCORS: true,
            scale: 2,
            logging: false
          });
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = pageWidth - margin * 2;
          const imgHeight = (canvas.height / canvas.width) * imgWidth;
          pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, Math.min(imgHeight, 80));
          yPos += Math.min(imgHeight, 80) + 10;
        } catch (mapErr) {
          console.error('Failed to capture map:', mapErr);
        }
      }

      const statsText = [];
      if (totalDistance > 0) statsText.push(`Distance: ${(totalDistance / 1000).toFixed(2)} km`);
      if (totalElevation > 0) statsText.push(`Elevation: ${totalElevation.toFixed(0)} m`);
      if (totalDuration > 0) {
        const hours = Math.floor(totalDuration / 3600);
        const mins = Math.floor((totalDuration % 3600) / 60);
        statsText.push(`Duration: ${hours}h ${mins}m`);
      }
      
      if (statsText.length > 0) {
        pdf.setFontSize(11);
        pdf.setTextColor(15, 23, 42);
        pdf.text(statsText.join(' • '), margin, yPos);
        yPos += 10;
      }

      if (adventure.description) {
        pdf.setFontSize(10);
        pdf.setTextColor(71, 85, 105);
        const descLines = pdf.splitTextToSize(adventure.description, pageWidth - margin * 2);
        pdf.text(descLines.slice(0, 5), margin, yPos);
        yPos += Math.min(descLines.length, 5) * 5 + 10;
      }

      if (pictures.length > 0) {
        pdf.setFontSize(14);
        pdf.setTextColor(16, 185, 129);
        pdf.text('Pictures', margin, yPos);
        yPos += 8;

        const imgWidth = 40;
        const imgHeight = 30;
        const gap = 5;
        const cols = 4;
        
        for (let i = 0; i < Math.min(pictures.length, 8); i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = margin + col * (imgWidth + gap);
          const y = yPos + row * (imgHeight + gap);
          
          const imgSrc = pictures[i].thumbnail_base64 || pictures[i].thumbnail_url;
          if (imgSrc) {
            try {
              if (imgSrc.startsWith('data:')) {
                pdf.addImage(imgSrc, 'JPEG', x, y, imgWidth, imgHeight);
              } else {
                const response = await fetch(imgSrc);
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                  pdf.addImage(reader.result, 'JPEG', x, y, imgWidth, imgHeight);
                };
                reader.readAsDataURL(blob);
              }
            } catch (e) {
              console.error('Failed to load image:', e);
            }
          }
        }
        yPos += Math.ceil(Math.min(pictures.length, 8) / cols) * (imgHeight + gap) + 15;
      }

      if (gpxTracks.length > 0) {
        pdf.setFontSize(14);
        pdf.setTextColor(16, 185, 129);
        pdf.text('Tracks', margin, yPos);
        yPos += 8;

        pdf.setFontSize(10);
        pdf.setTextColor(15, 23, 42);
        
        gpxTracks.forEach((track, idx) => {
          const trackDist = track.data ? (track.data.length > 0 ? calculateTrackDistance(track.data) : 0) : 0;
          const trackType = track.type || 'other';
          const trackColor = TYPE_COLORS[trackType] || '#9B59B6';
          
          pdf.setFillColor(trackColor);
          pdf.circle(margin + 2, yPos - 1, 2, 'F');
          pdf.text(`${track.name || `Track ${idx + 1}`} - ${trackType} (${(trackDist / 1000).toFixed(2)} km)`, margin + 8, yPos);
          yPos += 6;
        });
      }

      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Generated by WanderRoam', margin, 285);

      pdf.save(`${adventure.name.replace(/[^a-z0-9]/gi, '_')}_adventure.pdf`);
      toast.success('PDF exported!', { id: 'pdf' });
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('Failed to export PDF', { id: 'pdf' });
    }
  };

  const calculateTrackDistance = (points) => {
    let dist = 0;
    for (let i = 1; i < points.length; i++) {
      const d = Math.sqrt(
        Math.pow(points[i].lat - points[i-1].lat, 2) + 
        Math.pow(points[i].lng - points[i-1].lng, 2)
      );
      dist += d * 111000;
    }
    return dist;
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

  const allBounds = [
    ...gpxTracks.flatMap(t => t.data?.map(p => [p.lat, p.lng]) || []),
    ...pictures.filter(p => p.latitude && p.longitude).map(p => [p.latitude, p.longitude]),
    ...waypoints.map(w => [w.latitude, w.longitude])
  ];

  return (
    <div>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to={backLink} className="back-link">← Back</Link>
        </div>
        <h1 style={{ flex: 1, textAlign: 'center', margin: 0 }}>{adventure.name}</h1>
        <div className="header-actions">
          <button onClick={exportToPdf} className="btn btn-outline btn-sm">Export PDF</button>
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
                    background: hoveredTrackId === track.id ? 'var(--background)' : 'transparent',
                    boxShadow: selectedTrack && selectedTrack.id === track.id ? '0 0 0 2px var(--primary)' : 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleTrackClick(track)}
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
              <MapView 
                ref={mapRef}
                mapProvider={mapProvider}
                mapboxToken={mapboxToken}
                center={defaultCenter} 
                zoom={defaultZoom}
                bounds={allBounds}
                selectedTrack={selectedTrack}
                gpxTracks={gpxTracks}
                style={{ height: '100%', width: '100%' }}
                mapboxPictures={pictures.filter(p => p.latitude && p.longitude)}
                mapboxWaypoints={waypoints}
                hoveredPictureId={hoveredPictureId}
              >
              {gpxTracks.map(track => (
                <Polyline
                  key={track.id}
                  positions={track.data?.map(p => [p.lat, p.lng]) || []}
                  pathOptions={{ 
                    color: track.color || TYPE_COLORS[track.type] || TYPE_COLORS.other,
                    weight: 5,
                    opacity: selectedTrack 
                      ? (selectedTrack.id === track.id ? 1 : 0.3)
                      : (hoveredTrackId && hoveredTrackId !== track.id ? 0.4 : 1)
                  }}
                  eventHandlers={{
                    click: () => handleTrackClick(track)
                  }}
                />
              ))}

              {pictures.map((picture) => (
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
                  icon={getWaypointIcon(waypoint.icon)}
                >
                  <Popup>
                    <div style={{ minWidth: '100px', textAlign: 'center' }}>
                      <strong>{waypoint.name || 'Waypoint'}</strong>
                      <div style={{ fontSize: '1.5rem', marginTop: '4px' }}>{waypoint.icon}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
              </MapView>
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
