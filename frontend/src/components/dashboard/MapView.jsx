import React, { useMemo } from 'react';
import { Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapView as BaseMapView } from '../../components/MapView';

export default function DashboardMapView({ 
  allTracks, 
  visibleAdventures, 
  mapProvider, 
  mapboxToken, 
  selectedMapTag, 
  setSelectedMapTag, 
  adventures, 
  toggleAdventure, 
  toggleAll, 
  uniqueAdventures 
}) {
  const MapBounds = ({ tracks }) => {
    const map = useMap();
    
    const allPositions = useMemo(() => 
      tracks
        .filter(t => t.data && t.data.length > 0)
        .flatMap(t => t.data.map(p => [p.lat, p.lng])),
      [tracks]
    );
    
    React.useEffect(() => {
      if (allPositions.length > 0) {
        const bounds = L.latLngBounds(allPositions);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }, [allPositions, map]);
    
    return null;
  };

  if (allTracks.length === 0) {
    return (
      <div className="empty-state">
        <h3>No tracks found</h3>
        <p>Add GPX tracks to your adventures to see them here</p>
      </div>
    );
  }

  const adventureIdsWithTracks = [...new Set(allTracks.map(t => t.adventureId))];
  const tagsFromAdventures = adventures.filter(a => adventureIdsWithTracks.includes(a.id));
  const uniqueTags = [...new Set(tagsFromAdventures.flatMap(a => (a.tags || []).map(t => t.name)))];
  
  return (
    <>
      {uniqueTags.length > 0 && (
        <div style={{ 
          marginTop: '16px', 
          marginBottom: '8px', 
          padding: '12px', 
          background: 'var(--surface)', 
          borderRadius: '8px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center'
        }}>
          <span style={{ fontWeight: 600, marginRight: '8px' }}>Filter by tag:</span>
          <button 
            onClick={() => setSelectedMapTag(null)}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              borderRadius: '16px',
              border: selectedMapTag === null ? '1px solid #2196F3' : '1px solid var(--border)',
              background: selectedMapTag === null ? '#E3F2FD' : 'transparent',
              color: 'var(--text)',
              cursor: 'pointer'
            }}
          >
            All
          </button>
          {uniqueTags.map(tag => (
            <button 
              key={tag}
              onClick={() => setSelectedMapTag(tag)}
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                borderRadius: '16px',
                border: selectedMapTag === tag ? '1px solid #2196F3' : '1px solid var(--border)',
                background: selectedMapTag === tag ? '#E3F2FD' : 'transparent',
                color: 'var(--text)',
                cursor: 'pointer'
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

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

      <div style={{ height: 'calc(100vh - 280px)', minHeight: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }} role="application" aria-label="Adventure map showing GPX tracks">
        <BaseMapView 
          mapProvider={mapProvider}
          mapboxToken={mapboxToken}
          center={[46.2276, 2.2137]}
          zoom={5}
          bounds={allTracks.filter(t => visibleAdventures[t.adventureId]).flatMap(t => t.data?.map(p => [p.lat, p.lng]) || [])}
        >
          {allTracks.filter(t => visibleAdventures[t.adventureId]).map(track => (
            <Polyline
              key={track.id}
              positions={track.data.map(p => [p.lat, p.lng])}
              pathOptions={{ color: track.color, weight: 3, opacity: 0.8 }}
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
        </BaseMapView>
      </div>

      <div style={{ marginTop: '16px', color: 'var(--text-light)', fontSize: '0.85rem' }}>
        {allTracks.filter(t => visibleAdventures[t.adventureId]).length} tracks visible • Click on a track to see details
      </div>
    </>
  );
}
