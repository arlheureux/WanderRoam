import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';
import api from '../services/api';

const TYPE_COLORS = {
  walking: '#DC2626',
  hiking: '#EA580C',
  cycling: '#65A30D',
  bus: '#2563EB',
  metro: '#DB2777',
  train: '#0891B2',
  boat: '#4F46E5',
  car: '#52525B',
  other: '#0D9488'
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

const MapBoundsFitter = ({ points, runOnce }) => {
  const map = useMap();
  const hasRunRef = useRef(false);
  
  useEffect(() => {
    if (runOnce && points.length > 0 && !hasRunRef.current) {
      const lats = points.map(p => p.lat);
      const lngs = points.map(p => p.lng);
      const bounds = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      ];
      map.fitBounds(bounds, { padding: [50, 50] });
      hasRunRef.current = true;
    }
  }, [runOnce, points, map]);
  
  return null;
};

const createPointIcon = (color = '#2196F3', size = 12) => {
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

const createWaypointIcon = (color = '#2196F3') => {
  return L.divIcon({
    className: 'waypoint-marker',
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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
  const isNewTrack = !existingTrack;
  
  const [mode, setMode] = useState(isNewTrack ? 'draw' : 'edit');
  
  const [name, setName] = useState(existingTrack?.name || '');
  const [trackType, setTrackType] = useState(existingTrack?.type || 'hiking');
  const [color, setColor] = useState(existingTrack?.color || TYPE_COLORS.hiking);
  
  const [existingPoints, setExistingPoints] = useState(existingTrack?.data || []);
  const [newPoints, setNewPoints] = useState([]);
  
  const [importedFile, setImportedFile] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [routingMode, setRoutingMode] = useState('car');
  const [routingWaypoints, setRoutingWaypoints] = useState([]);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingError, setRoutingError] = useState('');
  
  const mapRef = useRef(null);

  useEffect(() => {
    fixLeafletIcons();
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (existingTrack) {
        setMode('edit');
        setExistingPoints(existingTrack.data || []);
        setNewPoints([]);
      } else {
        setMode('draw');
        setExistingPoints([]);
        setNewPoints([]);
      }
      setName(existingTrack?.name || '');
      setTrackType(existingTrack?.type || 'hiking');
      setColor(existingTrack?.color || TYPE_COLORS.hiking);
      setRoutingWaypoints([]);
    }
  }, [isOpen, existingTrack]);

  const handleMapClick = (point) => {
    if (mode === 'route') {
      setRoutingWaypoints([...routingWaypoints, point]);
    } else if (mode === 'add' || mode === 'draw') {
      setNewPoints([...newPoints, point]);
    }
  };

  const handleRemoveNewPoint = (index) => {
    setNewPoints(newPoints.filter((_, i) => i !== index));
  };

  const handleRemoveExistingPoint = (index) => {
    setExistingPoints(existingPoints.filter((_, i) => i !== index));
  };

  const handleRemoveWaypoint = (index) => {
    setRoutingWaypoints(routingWaypoints.filter((_, i) => i !== index));
  };

  const handleReverse = () => {
    if (mode === 'route') {
      setRoutingWaypoints([...routingWaypoints].reverse());
    } else if (mode === 'edit') {
      setExistingPoints([...existingPoints].reverse());
    } else if (mode === 'add' || mode === 'draw') {
      setNewPoints([...newPoints].reverse());
    }
  };

  const handleClearAll = () => {
    if (mode === 'route') {
      if (window.confirm('Clear all waypoints?')) {
        setRoutingWaypoints([]);
      }
    } else if (mode === 'edit') {
      if (window.confirm('Clear all points?')) {
        setExistingPoints([]);
      }
    } else {
      if (window.confirm('Clear all points?')) {
        setNewPoints([]);
      }
    }
  };

  const handleCalculateRoute = async () => {
    if (routingWaypoints.length < 2) {
      setRoutingError('At least 2 waypoints required');
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
        setNewPoints(response.data.points);
        setColor(response.data.color || TYPE_COLORS[routingMode] || TYPE_COLORS.hiking);
        
        const modeLabel = ROUTING_MODES.find(m => m.value === routingMode)?.label || routingMode;
        if (!name) {
          setName(`${modeLabel} Route`);
        }
        
        setMode('add');
      }
    } catch (err) {
      toast.error('Routing calculation failed');
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
      setExistingPoints(parsedPoints);
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

    return points;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a track name');
      return;
    }

    let allPoints;
    if (mode === 'route') {
      allPoints = routingWaypoints;
    } else if (mode === 'edit' && isNewTrack) {
      allPoints = [...existingPoints, ...newPoints];
    } else if (mode === 'edit') {
      allPoints = existingPoints;
    } else {
      allPoints = [...existingPoints, ...newPoints];
    }

    if (allPoints.length < 2) {
      alert('Track must have at least 2 points');
      return;
    }

    setSaving(true);
    try {
      let result;
      if (existingTrack) {
        const trackData = {
          name: name.trim(),
          type: trackType,
          color: color,
          data: allPoints,
          adventure_id: adventureId
        };
        result = await api.updateGpx(existingTrack.id, trackData);
      } else if (importedFile) {
        const formData = new FormData();
        formData.append('name', name.trim());
        formData.append('type', trackType);
        formData.append('adventure_id', adventureId);
        formData.append('gpx', importedFile);
        result = await api.post('/gpx/upload', formData, true);
      } else {
        const trackData = {
          name: name.trim(),
          type: trackType,
          color: color,
          data: allPoints,
          adventure_id: adventureId
        };
        result = await api.createGpxFromPoints(trackData);
      }

      onSave(result.data.gpxTrack || result.data);
      onClose();
    } catch (err) {
      toast.error('Failed to save track');
    }
  };

  const getMapCenter = () => {
    let currentPoints = [];
    if (mode === 'route') {
      currentPoints = routingWaypoints;
    } else if (mode === 'edit') {
      currentPoints = existingPoints;
    } else if (mode === 'add' || mode === 'draw') {
      currentPoints = [...existingPoints, ...newPoints];
    }
    
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

  const allDisplayedPoints = mode === 'edit' ? existingPoints : (mode === 'route' ? routingWaypoints : [...existingPoints, ...newPoints]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content gpx-editor-modal" onClick={e => e.stopPropagation()}>
        <h3>{existingTrack ? 'Edit Track' : 'Create Track'}</h3>
        
        <div className="gpx-editor-tabs">
          {isNewTrack ? (
            <>
              <button 
                className={`tab-btn ${mode === 'draw' ? 'active' : ''}`}
                onClick={() => { setMode('draw'); }}
              >
                Draw
              </button>
              <button 
                className={`tab-btn ${mode === 'route' ? 'active' : ''}`}
                onClick={() => { setMode('route'); }}
              >
                Route
              </button>
              <button 
                className={`tab-btn ${mode === 'import' ? 'active' : ''}`}
                onClick={() => { setMode('import'); }}
              >
                Import
              </button>
            </>
          ) : (
            <>
              <button 
                className={`tab-btn ${mode === 'edit' ? 'active' : ''}`}
                onClick={() => { setMode('edit'); setNewPoints([]); }}
              >
                Edit Points
              </button>
              <button 
                className={`tab-btn ${mode === 'add' ? 'active' : ''}`}
                onClick={() => { setMode('add'); }}
              >
                Add Points
              </button>
              <button 
                className={`tab-btn ${mode === 'route' ? 'active' : ''}`}
                onClick={() => { setMode('route'); }}
              >
                Route
              </button>
            </>
          )}
        </div>

        <div className="gpx-editor-map">
          <MapContainer
            ref={mapRef}
            center={getMapCenter()}
            zoom={allDisplayedPoints.length > 0 ? 12 : 5}
            style={{ height: '400px', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {existingPoints.length > 0 && (
              <Polyline
                positions={existingPoints.map(p => [p.lat, p.lng])}
                pathOptions={{ color: color, weight: 4, opacity: mode === 'add' ? 0.3 : 1 }}
              />
            )}
            
            {newPoints.length > 0 && (
              <Polyline
                positions={newPoints.map(p => [p.lat, p.lng])}
                pathOptions={{ color: color, weight: 4 }}
              />
            )}
            
            {routingWaypoints.length > 0 && (
              <Polyline
                positions={routingWaypoints.map(p => [p.lat, p.lng])}
                pathOptions={{ color: getRoutingModeColor(), weight: 3, dashArray: '5, 10' }}
              />
            )}
            
            {mode === 'edit' && existingPoints.map((point, index) => (
              <Marker
                key={`existing-${index}`}
                position={[point.lat, point.lng]}
                icon={createPointIcon(color)}
                eventHandlers={{
                  click: () => handleRemoveExistingPoint(index)
                }}
              />
            ))}
            
            {mode === 'add' && newPoints.map((point, index) => (
              <Marker
                key={`new-${index}`}
                position={[point.lat, point.lng]}
                icon={createPointIcon(color, 16)}
                eventHandlers={{
                  click: () => handleRemoveNewPoint(index)
                }}
              />
            ))}
            
            {mode === 'route' && routingWaypoints.map((point, index) => (
              <Marker
                key={`route-${index}`}
                position={[point.lat, point.lng]}
                icon={createWaypointIcon(getRoutingModeColor())}
                eventHandlers={{
                  click: () => handleRemoveWaypoint(index)
                }}
              />
            ))}
            
            <MapBoundsFitter points={allDisplayedPoints} runOnce={!!existingTrack} />
            <MapClickHandler onMapClick={handleMapClick} enabled={mode === 'draw' || mode === 'add' || mode === 'route'} />
          </MapContainer>
          
          <div className="map-hint">
            {mode === 'draw' && 'Click on the map to add points. Click a point to remove it.'}
            {mode === 'add' && 'Click on the map to add new points. Click new point markers to remove them.'}
            {mode === 'edit' && 'Click on points to remove them from the track.'}
            {mode === 'route' && `Click on the map to add waypoints (${routingWaypoints.length} added). Click a marker to remove it.`}
            {mode === 'import' && 'Upload a GPX file above to load track points.'}
          </div>
        </div>

        {mode === 'route' && (
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
                <button type="button" className="btn btn-outline btn-sm" onClick={handleReverse}>
                  Reverse
                </button>
              )}
              {routingWaypoints.length > 0 && (
                <button type="button" className="btn btn-outline btn-sm" onClick={handleClearAll}>
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
            <span>
              {mode === 'edit' ? existingPoints.length : (mode === 'route' ? routingWaypoints.length : newPoints.length)} points
              {existingTrack && mode !== 'edit' && ` (+ ${existingPoints.length} existing)`}
            </span>
            {(mode !== 'route' && (mode === 'edit' ? existingPoints.length : newPoints.length) > 1) && (
              <button type="button" className="btn btn-outline btn-sm" onClick={handleReverse}>
                Reverse
              </button>
            )}
            {((mode === 'edit' && existingPoints.length > 0) || (mode !== 'edit' && newPoints.length > 0) || (mode === 'route' && routingWaypoints.length > 0)) && (
              <button type="button" className="btn btn-outline btn-sm" onClick={handleClearAll}>
                Clear All
              </button>
            )}
          </div>

          {mode === 'import' && (
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
            disabled={saving || allDisplayedPoints.length < 2}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GpxEditorModal;
