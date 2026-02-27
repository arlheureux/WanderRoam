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

const ROUTING_MODES = [
  { value: 'car', label: 'Car', color: '#FC5C65' },
  { value: 'bike', label: 'Bike', color: '#4ECDC4' },
  { value: 'foot', label: 'Foot / Walking', color: '#FF9F43' },
  { value: 'boat', label: 'Boat', color: '#2D98DA' },
  { value: 'train', label: 'Train', color: '#45B7D1' },
  { value: 'metro', label: 'Metro', color: '#A55EEA' }
];

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

const createPointIcon = (color = '#2196F3', isWaypoint = false) => {
  if (isWaypoint) {
    return L.divIcon({
      className: 'waypoint-marker',
      html: `<div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        color: white;
      "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }
  const size = 12;
  return L.divIcon({
    className: 'point-marker',
    html: `<div style="
      background-color: ${color};
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

const MapClickHandler = ({ onMapClick, enabled }) => {
  useMapEvents({
    click: (e) => {
      if (enabled) {
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
  
  const [routingMode, setRoutingMode] = useState('car');
  const [routingWaypoints, setRoutingWaypoints] = useState([]);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingError, setRoutingError] = useState('');
  
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
      setRoutingWaypoints([]);
    }
  }, [isOpen, existingTrack]);

  const handleMapClick = (point) => {
    if (activeTab === 'route') {
      setRoutingWaypoints([...routingWaypoints, point]);
    } else {
      setPoints([...points, point]);
    }
  };

  const handleRemovePoint = (index) => {
    if (activeTab === 'route') {
      setRoutingWaypoints(routingWaypoints.filter((_, i) => i !== index));
    } else {
      setPoints(points.filter((_, i) => i !== index));
    }
  };

  const handleRemoveRoutingWaypoint = (index) => {
    setRoutingWaypoints(routingWaypoints.filter((_, i) => i !== index));
  };

  const handleReverse = () => {
    if (activeTab === 'route') {
      setRoutingWaypoints([...routingWaypoints].reverse());
    } else {
      setPoints([...points].reverse());
    }
  };

  const handleClearAll = () => {
    if (activeTab === 'route') {
      if (window.confirm('Clear all waypoints?')) {
        setRoutingWaypoints([]);
      }
    } else {
      if (window.confirm('Clear all points?')) {
        setPoints([]);
      }
    }
  };

  const handleCalculateRoute = async () => {
    if (routingWaypoints.length < 2) {
      setRoutingError('At least 2 waypoints required (start and end)');
      return;
    }

    setRoutingError('');
    setRoutingLoading(true);

    try {
      const response = await api.post('/routing/route', {
        waypoints: routingWaypoints,
        mode: routingMode
      });

      if (response.data && response.data.points) {
        setPoints(response.data.points);
        setColor(response.data.color || TYPE_COLORS[routingMode] || TYPE_COLORS.hiking);
        
        const modeLabel = ROUTING_MODES.find(m => m.value === routingMode)?.label || routingMode;
        if (!name) {
          setName(`${modeLabel} Route`);
        }
        
        setActiveTab('edit');
      }
    } catch (err) {
      console.error('Routing error:', err);
      setRoutingError(err.response?.data?.error || err.message || 'Failed to calculate route');
    } finally {
      setRoutingLoading(false);
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
    const currentPoints = activeTab === 'route' ? routingWaypoints : points;
    if (currentPoints.length > 0) {
      const avgLat = currentPoints.reduce((sum, p) => sum + p.lat, 0) / currentPoints.length;
      const avgLng = currentPoints.reduce((sum, p) => sum + p.lng, 0) / currentPoints.length;
      return [avgLat, avgLng];
    }
    return [46.2276, 2.2137];
  };

  const handleTypeChange = (newType) => {
    setTrackType(newType);
    setColor(TYPE_COLORS[newType] || TYPE_COLORS.other);
  };

  const getRoutingModeColor = () => {
    return ROUTING_MODES.find(m => m.value === routingMode)?.color || '#FC5C65';
  };

  if (!isOpen) return null;

  const currentPoints = activeTab === 'route' ? routingWaypoints : points;

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
            className={`tab-btn ${activeTab === 'route' ? 'active' : ''}`}
            onClick={() => { setActiveTab('route'); setDrawing(false); }}
          >
            Route
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
            zoom={currentPoints.length > 0 ? 12 : 5}
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
            {routingWaypoints.length > 0 && (
              <Polyline
                positions={routingWaypoints.map(p => [p.lat, p.lng])}
                pathOptions={{ color: getRoutingModeColor(), weight: 3, dashArray: '5, 10' }}
              />
            )}
            {(activeTab === 'route' ? routingWaypoints : points).map((point, index) => (
              <Marker
                key={index}
                position={[point.lat, point.lng]}
                icon={activeTab === 'route' ? createPointIcon(getRoutingModeColor(), true) : createPointIcon()}
                eventHandlers={{
                  click: () => handleRemovePoint(index)
                }}
              />
            ))}
            <MapBoundsFitter points={currentPoints} />
            <MapClickHandler onMapClick={handleMapClick} enabled={activeTab === 'draw' || activeTab === 'route'} />
          </MapContainer>
          {activeTab === 'draw' && (
            <div className="map-hint">
              Click on the map to add points. Click a point to remove it.
            </div>
          )}
          {activeTab === 'route' && (
            <div className="map-hint">
              Click on the map to add waypoints ({routingWaypoints.length} added). Click a marker to remove it.
            </div>
          )}
        </div>

        {activeTab === 'route' && (
          <div className="routing-section">
            <div className="form-row">
              <div className="form-group">
                <label>Transportation Mode</label>
                <select value={routingMode} onChange={(e) => setRoutingMode(e.target.value)}>
                  {ROUTING_MODES.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="waypoints-info">
              <span>{routingWaypoints.length} waypoint{routingWaypoints.length !== 1 ? 's' : ''}</span>
              {routingWaypoints.length > 2 && (
                <button type="button" className="btn-link" onClick={handleReverse}>
                  Reverse
                </button>
              )}
              {routingWaypoints.length > 0 && (
                <button type="button" className="btn-link" onClick={handleClearAll}>
                  Clear All
                </button>
              )}
            </div>

            {routingWaypoints.length >= 2 && (
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleCalculateRoute}
                disabled={routingLoading}
                style={{ width: '100%', marginTop: '10px' }}
              >
                {routingLoading ? 'Calculating...' : 'Calculate Route'}
              </button>
            )}

            {routingError && (
              <div className="error-message" style={{ color: 'red', marginTop: '10px', fontSize: '14px' }}>
                {routingError}
              </div>
            )}

            {routingWaypoints.length < 2 && (
              <p className="map-hint" style={{ marginTop: '10px' }}>
                Add at least 2 waypoints to calculate a route
              </p>
            )}
          </div>
        )}

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
            {points.length > 0 && activeTab !== 'route' && (
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
