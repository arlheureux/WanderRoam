import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const getTypeColor = (type) => {
  const colors = {
    hiking: 'var(--gpx-hiking)',
    cycling: 'var(--gpx-cycling)',
    running: 'var(--gpx-running)',
    climbing: 'var(--gpx-climbing)',
    other: 'var(--gpx-other)'
  };
  return colors[type] || colors.other;
};

function SeriesCard({ item, navigate }) {
  return (
    <div 
      className="adventure-card"
      onClick={() => navigate(`/series/${item.data.id}`)}
      style={{ cursor: 'pointer', position: 'relative' }}
    >
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 10,
        background: 'var(--primary)',
        color: 'white',
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '0.7rem',
        fontWeight: 600
      }}>
        SERIES
      </div>
      <div className="adventure-card-preview">
        <div style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem'
        }}>
          📚
        </div>
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          color: 'white',
          fontWeight: 600
        }}>
          {item.data.adventureCount} adventures
        </div>
      </div>
      <div className="adventure-card-body">
        <h3>{item.data.name}</h3>
        {(item.data.start_date || item.data.end_date) && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '-8px' }}>
            {item.data.start_date ? new Date(item.data.start_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''}
            {item.data.start_date && item.data.end_date ? ' - ' : ''}
            {item.data.end_date ? new Date(item.data.end_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''}
          </p>
        )}
        {item.data.description && (
          <p>{item.data.description.substring(0, 60)}...</p>
        )}
        <div className="adventure-stats">
          <span className="stat">📷 {item.data.totalPhotos} photos</span>
          <span className="stat">📏 {item.data.totalDistance ? item.data.totalDistance.toFixed(1) : 0} km</span>
        </div>
      </div>
    </div>
  );
}

function AdventureCard({ item, navigate }) {
  return (
    <div 
      className="adventure-card"
      onClick={() => navigate(`/adventure/${item.data.id}`)}
      style={{ cursor: 'pointer' }}
    >
      <div className="adventure-card-preview">
        {item.data.preview_picture?.thumbnail_url ? (
          <img 
            src={item.data.preview_picture.thumbnail_url} 
            alt={item.data.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            background: 'var(--background)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '3rem'
          }}>
            🗺️
          </div>
        )}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          color: 'white',
          fontWeight: 600
        }}>
          {item.data.gpxCount} tracks
        </div>
      </div>
      <div className="adventure-card-body">
        <h3>{item.data.name}</h3>
        {item.data.adventure_date && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '-8px' }}>
            {new Date(item.data.adventure_date).toLocaleDateString(undefined, { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })}
          </p>
        )}
        {item.data.description && (
          <p>{item.data.description.substring(0, 80)}...</p>
        )}
        <div className="adventure-stats">
          <span className="stat">
            📷 {item.data.pictureCount} photos
          </span>
          {item.data.gpxByType && Object.entries(item.data.gpxByType).map(([type, count]) => (
            <span 
              key={type}
              className="stat-badge"
              style={{ backgroundColor: getTypeColor(type) }}
            >
              {count} {type}
            </span>
          ))}
          {item.data.tags && item.data.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {item.data.tags.map(tag => (
                <span
                  key={tag.id}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.7rem',
                    borderRadius: '10px',
                    background: tag.color + '30',
                    color: tag.color,
                    border: `1px solid ${tag.color}`
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdventureList({ 
  combinedItems, 
  searchQuery, 
  navigate 
}) {
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return combinedItems;
    const q = searchQuery.toLowerCase();
    return combinedItems.filter(item => {
      const name = (item.data.name || '').toLowerCase();
      const desc = (item.data.description || '').toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [combinedItems, searchQuery]);

  if (filteredItems.length === 0) {
    return (
      <div className="empty-state">
        {searchQuery.trim() ? (
          <>
            <h3>No results for "{searchQuery}"</h3>
            <p>Try a different search term</p>
          </>
        ) : (
          <>
            <h3>No adventures yet</h3>
            <p>Create your first adventure to get started</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="adventures-grid">
      {filteredItems.map(item => 
        item.type === 'series' ? (
          <SeriesCard key={item.data.id} item={item} navigate={navigate} />
        ) : (
          <AdventureCard key={item.data.id} item={item} navigate={navigate} />
        )
      )}
    </div>
  );
}
