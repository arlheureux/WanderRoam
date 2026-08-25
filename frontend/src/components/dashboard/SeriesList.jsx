import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function SeriesList({ seriesList, loadingSeries, onCreateNew, navigate }) {
  if (loadingSeries) {
    return <div className="loading-screen">Loading series...</div>;
  }
  
  if (seriesList.length === 0) {
    return (
      <p style={{ color: 'var(--text-light)', marginTop: '16px' }}>
        No series yet. Create one to group your adventures!
      </p>
    );
  }
  
  return (
    <div className="series-grid" style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
      gap: '16px', 
      marginTop: '16px' 
    }}>
      {seriesList.map(series => (
        <div 
          key={series.id} 
          className="series-card" 
          style={{ 
            padding: '16px', 
            border: '1px solid var(--border)', 
            borderRadius: '8px', 
            cursor: 'pointer',
            background: 'var(--surface)'
          }}
          onClick={() => navigate(`/series/${series.id}`)}
        >
          <h3>{series.name}</h3>
          {series.description && (
            <p style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>
              {series.description}
            </p>
          )}
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '8px' }}>
            {series.adventureIds?.length || 0} adventures
            {series.totalHours > 0 && ` · ${series.totalHours} h`}
          </p>
        </div>
      ))}
    </div>
  );
}
