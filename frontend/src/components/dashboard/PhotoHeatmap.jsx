import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';

const FitBounds = ({ points }) => {
  const map = useMap();
  const coords = useMemo(() => points.map(p => [p.lat, p.lng]), [points]);
  useEffect(() => {
    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [40, 40], maxZoom: 12 });
    }
  }, [coords, map]);
  return null;
};


export default function PhotoHeatmap({ points, loading }) {
  if (!points) {
    return (
      <div className="empty-state">
        <h3>{loading ? 'Fetching photos…' : 'No photos yet'}</h3>
        <p>{loading ? 'Loading geotagged photos' : 'Add geotagged pictures to your adventures to see them here'}</p>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="empty-state">
        <h3>No geotagged photos</h3>
        <p>Photos with GPS coordinates will appear here across all your adventures</p>
      </div>
    );
  }

  const center = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat / points.length, lng: acc.lng + p.lng / points.length }),
    { lat: 0, lng: 0 }
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0 }}>Photo Map — {points.length} geotagged photos</h3>
      </div>
      <div
        style={{ height: 'calc(100vh - 280px)', minHeight: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}
        role="application"
        aria-label="Heatmap of all geotagged photos"
      >
        <MapContainer center={[center.lat, center.lng]} zoom={4} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          {points.map((p, i) => (
            <CircleMarker
              key={i}
              center={[p.lat, p.lng]}
              radius={5}
              pathOptions={{
                color: '#f97316',
                weight: 1,
                fillColor: '#ef4444',
                fillOpacity: 0.45
              }}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
