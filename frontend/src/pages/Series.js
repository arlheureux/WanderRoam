import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';
import api from '../services/api';

const fixLeafletIcons = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
};
fixLeafletIcons();

const MapBounds = ({ tracks }) => {
  const map = useMap();

  useEffect(() => {
    if (tracks && tracks.length > 0) {
      const allPoints = tracks
        .filter(t => t.data && t.data.length > 0)
        .flatMap(t => t.data.map(p => [p.lat, p.lng]));

      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [tracks, map]);

  return null;
};

const Series = () => {
  const [seriesList, setSeriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newSeries, setNewSeries] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [allAdventures, setAllAdventures] = useState([]);
  const [selectedAdventures, setSelectedAdventures] = useState([]);
  const [showAdventurePicker, setShowAdventurePicker] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('DESC');
  const navigate = useNavigate();

  useEffect(() => {
    loadSeries();
    loadAllAdventures();
  }, [sortBy, sortOrder]);

  const loadSeries = async () => {
    try {
      const res = await api.getSeries();
      let series = res.data.series || [];
      
      series = series.sort((a, b) => {
        const aVal = sortBy === 'adventure_date' ? a.start_date : a.createdAt;
        const bVal = sortBy === 'adventure_date' ? b.start_date : b.createdAt;
        if (sortOrder === 'ASC') {
          return new Date(aVal || 0) - new Date(bVal || 0);
        }
        return new Date(bVal || 0) - new Date(aVal || 0);
      });
      
      setSeriesList(series);
      setLoading(false);
    } catch (err) {
      toast.error('Failed to load series');
      setLoading(false);
    }
  };

  const loadAllAdventures = async () => {
    try {
      const res = await api.get('/adventures?sort=adventure_date&order=DESC');
      setAllAdventures(res.data.adventures || []);
    } catch (err) {
      console.error('Failed to load adventures', err);
    }
  };

  const createSeries = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await api.createSeries({
        name: newSeries.name,
        description: newSeries.description,
        adventureIds: selectedAdventures
      });
      setShowModal(false);
      setNewSeries({ name: '', description: '' });
      setSelectedAdventures([]);
      setShowAdventurePicker(false);
      loadSeries();
    } catch (err) {
      toast.error('Failed to create series');
    } finally {
      setCreating(false);
    }
  };

  const toggleAdventureSelection = (adventureId) => {
    setSelectedAdventures(prev => {
      if (prev.includes(adventureId)) {
        return prev.filter(id => id !== adventureId);
      }
      return [...prev, adventureId];
    });
  };

  const deleteSeries = async (seriesId) => {
    if (!window.confirm('Are you sure you want to delete this series?')) return;
    
    try {
      await api.deleteSeries(seriesId);
      loadSeries();
    } catch (err) {
      toast.error('Failed to delete series');
    }
  };

  const formatDateRange = (start, end) => {
    if (!start && !end) return null;
    const startDate = start ? new Date(start).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '';
    const endDate = end ? new Date(end).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '';
    if (startDate && endDate) return `${startDate} - ${endDate}`;
    return startDate || endDate;
  };

  if (loading) {
    return <div className="loading-screen">Loading series...</div>;
  }

  return (
    <div>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1>← Back</h1>
          </Link>
        </div>
        <h1 style={{ flex: 1, textAlign: 'center', margin: 0 }}>My Series</h1>
        <div style={{ width: '100px' }}></div>
      </header>

      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
          <h2>Series</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Sort by:</span>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)' }}
            >
              <option value="adventure_date">Date</option>
              <option value="createdAt">Created</option>
              <option value="name">Name</option>
            </select>
            <button 
              onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
              className="btn btn-outline btn-sm"
              title={sortOrder === 'ASC' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'ASC' ? '↑' : '↓'}
            </button>
            <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ marginLeft: '8px' }}>
              + New Series
            </button>
          </div>
        </div>

        {seriesList.length === 0 ? (
          <div className="empty-state">
            <h3>No series yet</h3>
            <p>Create a series to group multiple adventures together</p>
          </div>
        ) : (
          <div className="adventures-grid">
            {seriesList.map(series => (
              <div 
                key={series.id} 
                className="adventure-card"
                onClick={() => navigate(`/series/${series.id}`)}
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
                    {series.adventureCount} adventures
                  </div>
                </div>
                <div className="adventure-card-body">
                  <h3>{series.name}</h3>
                  {(series.start_date || series.end_date) && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '-8px' }}>
                      {formatDateRange(series.start_date, series.end_date)}
                    </p>
                  )}
                  {series.description && (
                    <p>{series.description.substring(0, 80)}...</p>
                  )}
                  <div className="adventure-stats">
                    <span className="stat">📷 {series.totalPhotos} photos</span>
                    <span className="stat">📏 {series.totalDistance ? (series.totalDistance / 1000).toFixed(1) : 0} km</span>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSeries(series.id);
                  }}
                  className="btn btn-danger btn-sm"
                  style={{ position: 'absolute', bottom: '12px', right: '12px' }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setShowAdventurePicker(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>New Series</h2>
            <form onSubmit={createSeries}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={newSeries.name}
                  onChange={(e) => setNewSeries({ ...newSeries, name: e.target.value })}
                  placeholder="My Road Trip"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={newSeries.description}
                  onChange={(e) => setNewSeries({ ...newSeries, description: e.target.value })}
                  placeholder="A brief description..."
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label>Adventures</label>
                {!showAdventurePicker ? (
                  <button 
                    type="button" 
                    onClick={() => setShowAdventurePicker(true)}
                    className="btn btn-outline"
                    style={{ width: '100%' }}
                  >
                    + Select Adventures ({selectedAdventures.length} selected)
                  </button>
                ) : (
                  <div style={{ 
                    maxHeight: '200px', 
                    overflowY: 'auto', 
                    border: '1px solid var(--border)', 
                    borderRadius: '4px',
                    padding: '8px'
                  }}>
                    {allAdventures.length === 0 ? (
                      <p style={{ color: 'var(--text-light)' }}>No adventures available</p>
                    ) : (
                      allAdventures.map(adv => (
                        <label 
                          key={adv.id}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            padding: '8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: selectedAdventures.includes(adv.id) ? 'var(--primary)' + '20' : 'transparent'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedAdventures.includes(adv.id)}
                            onChange={() => toggleAdventureSelection(adv.id)}
                          />
                          <span>{adv.name}</span>
                          {adv.adventure_date && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                              {new Date(adv.adventure_date).toLocaleDateString()}
                            </span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                )}
                {selectedAdventures.length > 0 && (
                  <button 
                    type="button" 
                    onClick={() => setShowAdventurePicker(false)}
                    style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Done selecting ({selectedAdventures.length} adventures)
                  </button>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => { setShowModal(false); setShowAdventurePicker(false); }} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Series;