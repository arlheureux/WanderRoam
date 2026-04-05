import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { MapContainer as LeafletMap, TileLayer as LeafletTileLayer, Polyline as LeafletPolyline, Popup as LeafletPopup, useMap as useLeafletMap } from 'react-leaflet';
import Map, { Marker, Popup as MapboxPopup, NavigationControl, FullscreenControl, ScaleControl, Source, Layer } from 'react-map-gl';
import mapboxgl from 'mapbox-gl';
import 'leaflet/dist/leaflet.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import L from 'leaflet';

const fixLeafletIcons = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
};
fixLeafletIcons();

const TYPE_COLORS = {
  walking: '#DC2626',
  hiking: '#EA580C',
  cycling: '#65A30D',
  bus: '#2563EB',
  metro: '#DB2777',
  train: '#0891B2',
  boat: '#4F46E5',
  car: '#52525B',
  plane: '#6366F1',
  other: '#0D9488'
};

const LeafletBounds = ({ bounds, selectedTrack = null, gpxTracks = [] }) => {
  const map = useLeafletMap();
  
  React.useEffect(() => {
    let targetBounds = bounds;
    
    if (selectedTrack && selectedTrack.data && selectedTrack.data.length > 0) {
      const trackPoints = selectedTrack.data.map(p => [p.lat, p.lng]);
      if (trackPoints.length > 0) {
        targetBounds = trackPoints;
      }
    }
    
    if (targetBounds && targetBounds.length > 0) {
      const leafletBounds = L.latLngBounds(targetBounds);
      map.fitBounds(leafletBounds, { padding: [50, 50] });
    }
  }, [bounds, selectedTrack, map]);
  
  return null;
};

const LeafletMapView = ({ center, zoom, children, bounds, onMoveEnd, selectedTrack = null, gpxTracks = [] }) => {
  return (
    <LeafletMap
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      onmoveend={onMoveEnd}
    >
      <LeafletTileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {bounds && <LeafletBounds bounds={bounds} selectedTrack={selectedTrack} gpxTracks={gpxTracks} />}
      {children}
    </LeafletMap>
  );
};

const MapboxMapView = ({ center, zoom, children, bounds, mapboxToken, onMoveEnd, mapboxPictures = [], mapboxWaypoints = [], hoveredPictureId, selectedTrack = null, gpxTracks = [] }) => {
  const mapRef = useRef(null);
  const [viewState, setViewState] = React.useState({
    longitude: center[1],
    latitude: center[0],
    zoom: zoom || 5
  });
  const [popupInfo, setPopupInfo] = useState(null);
  const [terrainEnabled, setTerrainEnabled] = useState(true);

  const handleMapLoad = (evt) => {
    mapRef.current = evt.target;
    
    if (bounds && bounds.length > 0) {
      fitMapToBounds(bounds);
    }
  };

  const fitMapToBounds = (boundsData) => {
    if (!mapRef.current) return;
    
    try {
      const validPoints = boundsData.filter(p => 
        Array.isArray(p) && p.length >= 2 && 
        !isNaN(p[0]) && !isNaN(p[1])
      );
      
      if (validPoints.length < 2) return;
      
      const mapboxBounds = new mapboxgl.LngLatBounds(
        [validPoints[0][1], validPoints[0][0]],
        [validPoints[0][1], validPoints[0][0]]
      );
      
      validPoints.forEach(p => {
        mapboxBounds.extend([p[1], p[0]]);
      });
      
      mapRef.current.fitBounds(mapboxBounds, {
        padding: 50,
        maxZoom: 15
      });
      
      const newCenter = mapboxBounds.getCenter();
      setViewState({
        longitude: newCenter.lng,
        latitude: newCenter.lat,
        zoom: mapRef.current.getZoom()
      });
    } catch (e) {
      console.warn('Failed to fit bounds:', e);
    }
  };

  React.useEffect(() => {
    let targetBounds = bounds;
    
    if (selectedTrack && selectedTrack.data && selectedTrack.data.length > 0) {
      const trackPoints = selectedTrack.data.map(p => [p.lat, p.lng]);
      if (trackPoints.length > 0) {
        targetBounds = trackPoints;
      }
    }
    
    if (targetBounds && targetBounds.length > 0 && mapRef.current) {
      fitMapToBounds(targetBounds);
    }
  }, [bounds, selectedTrack]);

  const handleMoveEnd = (evt) => {
    if (onMoveEnd) {
      onMoveEnd(evt.viewState);
    }
  };

  const parseChildren = (children) => {
    const polylines = [];
    
    const childArray = React.Children.toArray(children);
    
    childArray.forEach((child, idx) => {
      if (!child || !child.props) return;
      
      if (child.props.positions) {
        polylines.push({
          positions: child.props.positions,
          pathOptions: child.props.pathOptions,
          eventHandlers: child.props.eventHandlers,
          key: child.key || idx
        });
      }
    });
    
    return polylines;
  };

  const polylines = parseChildren(children);
  
  const trackFeatures = polylines.map(track => ({
    type: 'Feature',
    properties: {
      color: track.pathOptions?.color || TYPE_COLORS.other
    },
    geometry: {
      type: 'LineString',
      coordinates: track.positions.map(p => [p[1], p[0]])
    }
  }));

  const geoJsonData = {
    type: 'FeatureCollection',
    features: trackFeatures
  };

  return (
    <Map
      {...viewState}
      onMove={evt => setViewState(evt.viewState)}
      onMoveEnd={handleMoveEnd}
      onLoad={handleMapLoad}
      style={{ height: '100%', width: '100%' }}
      mapStyle="mapbox://styles/mapbox/outdoors-v12"
      mapboxAccessToken={mapboxToken}
      terrain={terrainEnabled ? { source: 'mapbox-dem', exaggeration: 1.5 } : undefined}
      projection="globe"
    >
      <NavigationControl position="top-right" />
      <FullscreenControl position="top-right" />
      <ScaleControl />
      
      <button
        onClick={() => setTerrainEnabled(!terrainEnabled)}
        style={{
          position: 'absolute',
          top: '50px',
          right: '10px',
          zIndex: 10,
          padding: '8px 12px',
          background: terrainEnabled ? 'var(--primary)' : 'var(--surface)',
          color: terrainEnabled ? 'white' : 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
        title={terrainEnabled ? 'Disable 3D Terrain' : 'Enable 3D Terrain'}
      >
        🏔️ {terrainEnabled ? 'ON' : 'OFF'}
      </button>
      
      {terrainEnabled && (
        <Source
          id="mapbox-dem"
          type="raster-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={512}
          maxzoom={14}
        />
      )}
      
      {trackFeatures.length > 0 && (
        <Source id="tracks" type="geojson" data={geoJsonData}>
          <Layer
            id="track-lines"
            type="line"
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 3,
              'line-opacity': 0.8
            }}
          />
        </Source>
      )}

      {polylines.map((polyline, idx) => (
        <Source 
          key={polyline.key || `polyline-${idx}`}
          id={`polyline-${idx}`}
          type="geojson"
          data={{
            type: 'Feature',
            properties: { color: polyline.pathOptions?.color || TYPE_COLORS.other },
            geometry: {
              type: 'LineString',
              coordinates: polyline.positions.map(p => [p[1], p[0]])
            }
          }}
        >
          <Layer
            type="line"
            paint={{
              'line-color': [ 'get', 'color' ],
              'line-width': 3,
              'line-opacity': 0.8
            }}
          />
        </Source>
      ))}
      
      {mapboxPictures.map((pic) => {
        if (!pic.latitude || !pic.longitude) return null;
        const isHovered = hoveredPictureId === pic.id;
        return (
          <Marker
            key={`pic-${pic.id}`}
            longitude={pic.longitude}
            latitude={pic.latitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent?.stopPropagation();
              setPopupInfo(pic);
            }}
          >
            <div style={{
              width: '24px',
              height: '24px',
              background: isHovered ? '#10B981' : '#FFD700',
              borderRadius: '50%',
              transform: isHovered ? 'scale(1.5)' : 'scale(1)',
              transformOrigin: 'center bottom',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              border: '2px solid white',
              cursor: 'pointer',
              transition: 'transform 0.2s, background 0.2s'
            }} />
            {popupInfo?.id === pic.id && (
              <MapboxPopup
                longitude={pic.longitude}
                latitude={pic.latitude}
                closeButton={true}
                closeOnClick={false}
                offset={25}
                maxWidth="300px"
                onClose={() => setPopupInfo(null)}
              >
                <div style={{ padding: '8px' }}>
                  {(pic.thumbnail_base64 || pic.thumbnail_url) && (
                    <img 
                      src={pic.thumbnail_base64 || pic.thumbnail_url} 
                      alt={pic.filename || 'Picture'}
                      style={{ 
                        maxWidth: '260px', 
                        borderRadius: '4px',
                        display: 'block'
                      }} 
                    />
                  )}
                </div>
              </MapboxPopup>
            )}
          </Marker>
        );
      })}

      {mapboxWaypoints.map((wp) => {
        if (!wp.latitude || !wp.longitude) return null;
        return (
          <Marker
            key={`wp-${wp.id}`}
            longitude={wp.longitude}
            latitude={wp.latitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent?.stopPropagation();
              setPopupInfo(wp);
            }}
          >
            {wp.icon && (
              <div style={{
                width: '32px',
                height: '32px',
                background: '#FFFDD0',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                border: '2px solid #ddd',
                fontSize: '16px',
                lineHeight: 1
              }}>
                {wp.icon}
              </div>
            )}
            {popupInfo?.id === wp.id && (
              <MapboxPopup
                longitude={wp.longitude}
                latitude={wp.latitude}
                closeButton={true}
                closeOnClick={false}
                offset={25}
                onClose={() => setPopupInfo(null)}
              >
                <div style={{ textAlign: 'center', minWidth: '80px', padding: '4px' }}>
                  <strong>{wp.name || 'Waypoint'}</strong>
                </div>
              </MapboxPopup>
            )}
          </Marker>
        );
      })}
    </Map>
  );
};

export const MapView = ({ 
  mapProvider, 
  mapboxToken, 
  center = [46.2276, 2.2137], 
  zoom = 5, 
  bounds, 
  children, 
  onMoveEnd,
  style,
  mapboxPictures = [],
  mapboxWaypoints = [],
  hoveredPictureId = null,
  selectedTrack = null,
  gpxTracks = []
}) => {
  const containerStyle = style || { height: '100%', width: '100%' };
  
  if (mapProvider === 'mapbox' && mapboxToken) {
    return (
      <MapboxMapView 
        center={center} 
        zoom={zoom} 
        bounds={bounds}
        mapboxToken={mapboxToken}
        onMoveEnd={onMoveEnd}
        style={containerStyle}
        mapboxPictures={mapboxPictures}
        mapboxWaypoints={mapboxWaypoints}
        hoveredPictureId={hoveredPictureId}
        selectedTrack={selectedTrack}
        gpxTracks={gpxTracks}
      >
        {children}
      </MapboxMapView>
    );
  }
  
  return (
    <LeafletMapView 
      center={center} 
      zoom={zoom}
      bounds={bounds}
      onMoveEnd={onMoveEnd}
      style={containerStyle}
      selectedTrack={selectedTrack}
      gpxTracks={gpxTracks}
    >
      {children}
    </LeafletMapView>
  );
};

export { TYPE_COLORS };