import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
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

const TRACK_TYPES = ['walking', 'hiking', 'cycling', 'bus', 'metro', 'train', 'boat', 'car', 'other'];

const fixLeafletIcons = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  });
};

const MapBoundsFitter = ({ points }) => {
  const map = useMap();
  
  useEffect(() => {
    if (points.length > 0) {
      const lats = points.map(p => p.lat);
      const lngs = points.map(p => p.lng);
      const bounds = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      ];
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [points, map]);
  
  return null;
};

const createPointIcon = () => {
  const size = 12;
  return L.divIcon({
    className: 'point-marker',
    html: `<div style="
      background-color: #2196F3;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
};

const MapClickHandler = ({ onMapClick, drawing }) => {
  useMapEvents({
    click: (e) => {
      if (drawing) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng, ele: null, time: null });
      }
    },
  });
  return null;
};

const GpxEditorModal = ({ 
  isOpen, 
  onClose, 
  adventureId, 
  existingTrack = null,
  onSave 
}) => {
  const [activeTab, setActiveTab] = useState(existingTrack ? 'edit' : 'draw');
  const [name, setName] = useState(existingTrack?.name || '');
  const [trackType, setTrackType] = useState(existingTrack?.type || 'hiking');
  const [color, setColor] = useState(existingTrack?.color || TYPE_COLORS.hiking);
  const [points, setPoints] = useState(existingTrack?.data || []);
  const [importedFile, setImportedFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [drawing, setDrawing] = useState(true);
  
  const mapRef = useRef(null);

  useEffect(() => {
    fixLeafletIcons();
  }, []);

  useEffect(() => {
    if (isOpen && existingTrack) {
      setActiveTab('edit');
      setName(existingTrack.name || '');
      setTrackType(existingTrack.type || 'hiking');
      setColor(existingTrack.color || TYPE_COLORS.hiking);
      setPoints(existingTrack.data || []);
    } else if (isOpen) {
      setActiveTab('draw');
      setName('');
      setTrackType('hiking');
      setColor(TYPE_COLORS.hiking);
      setPoints([]);
    }
  }, [isOpen, existingTrack]);

  const handleMapClick = (point) => {
    setPoints([...points, point]);
  };

  const handleRemovePoint = (index) => {
    setPoints(points.filter((_, i) => i !== index));
  };

  const handleReverse = () => {
    setPoints([...points].reverse());
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all points?')) {
      setPoints([]);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportedFile(file);
    setName(file.name.replace('.gpx', ''));

    const reader = new FileReader();
    reader.onload = (event) => {
      const xml = event.target.result;
      const parsedPoints = parseGpxFromText(xml);
      setPoints(parsedPoints);
    };
    reader.readAsText(file);
  };

  const parseGpxFromText = (xml) => {
    const points = [];
    const trkptRegex = /<trkpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>/g;
    let match;
    
    while ((match = trkptRegex.exec(xml)) !== null) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      
      let ele = null;
      let time = null;
      
      const eleMatch = xml.substring(match.index, match.index + 500).match(/<ele>([^<]+)<\/ele>/);
      if (eleMatch) ele = parseFloat(eleMatch[1]);
      
      const timeMatch = xml.substring(match.index, match.index + 500).match(/<time>([^<]+)<\/time>/);
      if (timeMatch) time = timeMatch[1];
      
      if (!isNaN(lat) && !isNaN(lng)) {
        points.push({ lat, lng, ele, time });
      }
    }
    
    const rteptRegex = /<rtept[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>/g;
    while ((match = rteptRegex.exec(xml)) !== null) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      
      let ele = null;
      let time = null;
      
      const eleMatch = xml.substring(match.index, match.index + 500).match(/<ele>([^<]+)<\/ele>/);
      if (eleMatch) ele = parseFloat(eleMatch[1]);
      
      const timeMatch = xml.substring(match.index, match.index + 500).match(/<time>([^<]+)<\/time>/);
      if (timeMatch) time = timeMatch[1];
      
      if (!isNaN(lat) && !isNaN(lng)) {
        points.push({ lat, lng, ele, time });
      }
    }

    return points;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a track name');
      return;
    }

    if (points.length < 2) {
      alert('Track must have at least 2 points');
      return;
    }

    setSaving(true);
    try {
      const trackData = {
        name: name.trim(),
        type: trackType,
        color: color,
        data: points,
        adventure_id: adventureId
      };

      let result;
      if (existingTrack) {
        result = await api.updateGpx(existingTrack.id, trackData);
      } else {
        const formData = new FormData();
        formData.append('name', name.trim());
        formData.append('type', trackType);
        formData.append('adventure_id', adventureId);
        result = await api.post('/gpx/upload', formData, true);
      }

      onSave(result.data.gpxTrack || result.data);
      onClose();
    } catch (err) {
      console.error('Failed to save track:', err);
      alert('Failed to save track: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getMapCenter = () => {
    if (points.length > 0) {
      const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
      const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
      return [avgLat, avgLng];
    }
    return [46.2276, 2.2137];
  };

  const handleTypeChange = (newType) => {
    setTrackType(newType);
    setColor(TYPE_COLORS[newType] || TYPE_COLORS.other);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content gpx-editor-modal" onClick={e => e.stopPropagation()}>
        <h3>{existingTrack ? 'Edit Track' : 'Create Track'}</h3>
        
        <div className="gpx-editor-tabs">
          <button 
            className={`tab-btn ${activeTab === 'draw' ? 'active' : ''}`}
            onClick={() => { setActiveTab('draw'); setDrawing(true); }}
          >
            Draw
          </button>
          <button 
            className={`tab-btn ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => { setActiveTab('import'); setDrawing(false); }}
          >
            Import
          </button>
          {existingTrack && (
            <button 
              className={`tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
              onClick={() => { setActiveTab('edit'); setDrawing(false); }}
            >
              Edit
            </button>
          )}
        </div>

        <div className="gpx-editor-map">
          <MapContainer
            ref={mapRef}
            center={getMapCenter()}
            zoom={points.length > 0 ? 12 : 5}
            style={{ height: '300px', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.length > 0 && (
              <Polyline
                positions={points.map(p => [p.lat, p.lng])}
                pathOptions={{ color: color, weight: 4 }}
              />
            )}
            {points.map((point, index) => (
              <Marker
                key={index}
                position={[point.lat, point.lng]}
                icon={createPointIcon()}
                eventHandlers={{
                  click: () => handleRemovePoint(index)
                }}
              />
            ))}
            <MapBoundsFitter points={points} />
            <MapClickHandler onMapClick={handleMapClick} drawing={activeTab === 'draw' && drawing} />
          </MapContainer>
          {activeTab === 'draw' && (
            <div className="map-hint">
              Click on the map to add points. Click a point to remove it.
            </div>
          )}
        </div>

        <div className="gpx-editor-form">
          <div className="form-row">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Track name"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select value={trackType} onChange={(e) => handleTypeChange(e.target.value)}>
                {TRACK_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>

          <div className="points-info">
            {points.length} point{points.length !== 1 ? 's' : ''}
            {points.length > 1 && (
              <button type="button" className="btn-link" onClick={handleReverse}>
                Reverse
              </button>
            )}
            {points.length > 0 && (
              <button type="button" className="btn-link" onClick={handleClearAll}>
                Clear All
              </button>
            )}
          </div>

          {activeTab === 'import' && (
            <div className="import-section">
              <input
                type="file"
                accept=".gpx"
                onChange={handleFileUpload}
                className="file-input"
              />
              {importedFile && (
                <p className="import-info">Loaded: {importedFile.name}</p>
              )}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="btn btn-outline">Cancel</button>
          <button 
            onClick={handleSave} 
            className="btn btn-primary"
            disabled={saving || points.length < 2}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GpxEditorModal;
