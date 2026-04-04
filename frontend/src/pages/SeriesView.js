import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
fixLeafletIcons();

const SeriesView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('adventures');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSeries, setEditSeries] = useState({ name: '', description: '' });
  const [updating, setUpdating] = useState(false);
  const [showAdventurePicker, setShowAdventurePicker] = useState(false);
  const [allAdventures, setAllAdventures] = useState([]);
  const [selectedAdventures, setSelectedAdventures] = useState([]);
  const [sortBy, setSortBy] = useState('order');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [filterTags, setFilterTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddAdventureModal, setShowAddAdventureModal] = useState(false);
  const [addingAdventures, setAddingAdventures] = useState([]);
  const { mapProvider, mapboxToken } = useMapContext();

  useEffect(() => {
    loadSeries();
    loadTags();
  }, [id]);

  const loadSeries = async () => {
    try {
      const res = await api.getSeriesById(id);
      setSeries(res.data.series);
      setLoading(false);
    } catch (err) {
      toast.error('Failed to load series');
      navigate('/series');
    }
  };

  const loadTags = async () => {
    try {
      const res = await api.getTags();
      setAllTags(res.data.tags || []);
    } catch (err) {
      console.error('Failed to load tags');
    }
  };

  const loadAllAdventures = async () => {
    try {
      const res = await api.get('/adventures?sort=adventure_date&order=DESC');
      setAllAdventures(res.data.adventures || []);
      setShowAdventurePicker(true);
    } catch (err) {
      toast.error('Failed to load adventures');
    }
  };

  const updateSeries = async (e) => {
    e.preventDefault();
    setUpdating(true);

    try {
      await api.updateSeries(id, editSeries);
      loadSeries();
      setShowEditModal(false);
    } catch (err) {
      toast.error('Failed to update series');
    } finally {
      setUpdating(false);
    }
  };

  const updateSeriesAdventures = async () => {
    try {
      await api.updateSeriesAdventures(id, selectedAdventures);
      loadSeries();
      setShowAdventurePicker(false);
    } catch (err) {
      toast.error('Failed to update adventures');
    }
  };

  const deleteSeries = async () => {
    if (!window.confirm('Are you sure you want to delete this series?')) return;
    
    try {
      await api.deleteSeries(id);
      navigate('/series');
    } catch (err) {
      toast.error('Failed to delete series');
    }
  };

  const openEditModal = () => {
    setEditSeries({
      name: series.name,
      description: series.description || ''
    });
    setShowEditModal(true);
  };

  const openAdventurePicker = () => {
    const currentIds = series.adventures?.map(a => a.id) || [];
    setSelectedAdventures([...currentIds]);
    loadAllAdventures();
  };

  const openAddAdventureModal = async () => {
    try {
      const res = await api.get('/adventures?sort=adventure_date&order=DESC');
      const currentIds = series.adventures?.map(a => a.id) || [];
      const availableAdventures = (res.data.adventures || []).filter(a => !currentIds.includes(a.id));
      setAllAdventures(availableAdventures);
      setAddingAdventures([]);
      setShowAddAdventureModal(true);
    } catch (err) {
      toast.error('Failed to load adventures');
    }
  };

  const addAdventuresToSeries = async () => {
    if (addingAdventures.length === 0) {
      toast.error('Select at least one adventure');
      return;
    }
    try {
      const currentIds = series.adventures?.map(a => a.id) || [];
      const newIds = [...currentIds, ...addingAdventures];
      await api.updateSeriesAdventures(id, newIds);
      loadSeries();
      setShowAddAdventureModal(false);
      setAddingAdventures([]);
      toast.success('Adventures added to series');
    } catch (err) {
      toast.error('Failed to add adventures');
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

  const getTypeColor = (type) => {
    return TYPE_COLORS[type] || TYPE_COLORS.other;
  };

  const getAdventureTags = (adventureId) => {
    const adventure = series?.adventures?.find(a => a.id === adventureId);
    return adventure?.tags?.map(t => t.name) || [];
  };

  const filteredAdventures = (series?.adventures || []).filter(adv => {
    if (filterTags.length === 0) return true;
    const advTags = getAdventureTags(adv.id);
    return filterTags.some(tag => advTags.includes(tag));
  });

  const sortedAdventures = [...filteredAdventures].sort((a, b) => {
    if (sortBy === 'order') {
      return sortOrder === 'ASC' ? a.order - b.order : b.order - a.order;
    } else if (sortBy === 'adventure_date') {
      const aDate = a.adventure_date || '1970-01-01';
      const bDate = b.adventure_date || '1970-01-01';
      return sortOrder === 'ASC' ? new Date(aDate) - new Date(bDate) : new Date(bDate) - new Date(aDate);
    } else if (sortBy === 'name') {
      return sortOrder === 'ASC' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
    return 0;
  });

  const allTracks = series?.adventures?.flatMap(adv => 
    (adv.GpxTracks || []).map(t => ({
      ...t,
      adventureId: adv.id,
      adventureName: adv.name
    }))
  ) || [];

  if (loading) {
    return <div className="loading-screen">Loading series...</div>;
  }

  if (!series) {
    return <div className="loading-screen">Series not found</div>;
  }

  return (
    <div>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1>← Back</h1>
          </Link>
        </div>
        <h1 style={{ flex: 1, textAlign: 'center', margin: 0 }}>{series.name}</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={openAddAdventureModal} className="btn btn-primary btn-sm">+ Add Adventure</button>
          <button onClick={openEditModal} className="btn btn-outline btn-sm">Edit</button>
          <button onClick={deleteSeries} className="btn btn-danger btn-sm">Delete</button>
        </div>
      </header>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        padding: '12px 0', 
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ 
          display: 'flex', 
          gap: '4px', 
          padding: '4px',
          background: 'var(--background)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <button
            onClick={() => setActiveTab('adventures')}
            className={`tab-btn ${activeTab === 'adventures' ? 'active' : ''}`}
          >
            📋 Adventures ({series.adventures?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
          >
            🗺️ Map
          </button>
        </div>
      </div>

      <div className="container">
        {series.description && (
          <div style={{ marginTop: '16px', padding: '12px', background: 'var(--surface)', borderRadius: '8px' }}>
            <p style={{ margin: 0, color: 'var(--text-light)' }}>{series.description}</p>
          </div>
        )}

        {series.stats && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '16px', 
            marginTop: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{series.stats.adventureCount}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Adventures</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{(series.stats.totalDistance / 1000).toFixed(1)} km</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Total Distance</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{series.stats.totalPhotos}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Photos</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{series.stats.totalWaypoints}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Waypoints</div>
            </div>
          </div>
        )}

        {activeTab === 'adventures' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Sort by:</span>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)' }}
                >
                  <option value="order">Day</option>
                  <option value="adventure_date">Date</option>
                  <option value="name">Name</option>
                </select>
                <button 
                  onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
                  className="btn btn-outline btn-sm"
                >
                  {sortOrder === 'ASC' ? '↑' : '↓'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className="btn btn-outline btn-sm"
                  style={{
                    background: showFilters ? 'var(--primary)' : 'var(--background)',
                    color: showFilters ? 'white' : 'var(--text)'
                  }}
                >
                  {showFilters ? '▼' : '▶'} Filters
                </button>
                <button onClick={openAdventurePicker} className="btn btn-outline btn-sm">
                  Reorder Adventures
                </button>
              </div>
            </div>

            {showFilters && allTags.length > 0 && (
              <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--surface)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginRight: '8px' }}>Filter:</span>
                <button
                  onClick={() => setFilterTags([])}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.8rem',
                    borderRadius: '12px',
                    border: filterTags.length === 0 ? '1px solid #2196F3' : '1px solid var(--border)',
                    background: filterTags.length === 0 ? '#E3F2FD' : 'transparent',
                    color: 'var(--text)',
                    cursor: 'pointer'
                  }}
                >
                  All
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      if (filterTags.includes(tag.name)) {
                        setFilterTags(filterTags.filter(t => t !== tag.name));
                      } else {
                        setFilterTags([...filterTags, tag.name]);
                      }
                    }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      borderRadius: '12px',
                      border: `1px solid ${filterTags.includes(tag.name) ? tag.color : 'var(--border)'}`,
                      background: filterTags.includes(tag.name) ? tag.color + '20' : 'transparent',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      marginLeft: '6px'
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}

            {sortedAdventures.length === 0 ? (
              <div className="empty-state">
                <h3>No adventures in this series</h3>
              </div>
            ) : (
              <div className="adventures-grid">
                {sortedAdventures.map((adventure, index) => (
                  <div 
                    key={adventure.id} 
                    className="adventure-card"
                    onClick={() => navigate(`/adventure/${adventure.id}?seriesId=${id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'var(--primary)',
                      color: 'white',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      zIndex: 10
                    }}>
                      Day {index + 1}
                    </div>
                    <div className="adventure-card-preview">
                      {adventure.Pictures && adventure.Pictures.length > 0 && adventure.Pictures[0].thumbnail_url ? (
                        <img 
                          src={adventure.Pictures[0].thumbnail_base64 || adventure.Pictures[0].thumbnail_url} 
                          alt={adventure.name}
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
                        {adventure.GpxTracks?.length || 0} tracks
                      </div>
                    </div>
                    <div className="adventure-card-body">
                      <h3>{adventure.name}</h3>
                      {adventure.adventure_date && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '-8px' }}>
                          {new Date(adventure.adventure_date).toLocaleDateString(undefined, { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </p>
                      )}
                      {adventure.description && (
                        <p>{adventure.description.substring(0, 80)}...</p>
                      )}
                      <div className="adventure-stats">
                        <span className="stat">📷 {adventure.pictureCount} photos</span>
                        {adventure.distance > 0 && (
                          <span className="stat">📏 {(adventure.distance / 1000).toFixed(1)} km</span>
                        )}
                        {adventure.GpxTracks?.map(t => (
                          <span 
                            key={t.id}
                            className="stat-badge"
                            style={{ backgroundColor: getTypeColor(t.type) }}
                          >
                            {t.type}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'map' && (
          <div style={{ height: 'calc(100vh - 450px)', minHeight: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <MapView 
              mapProvider={mapProvider}
              mapboxToken={mapboxToken}
              center={[series.center_lat || 46.2276, series.center_lng || 2.2137]}
              zoom={5}
              bounds={allTracks.flatMap(t => t.data?.map(p => [p.lat, p.lng]) || [])}
            >
              {allTracks.map(track => (
                <Polyline
                  key={track.id}
                  positions={track.data?.map(p => [p.lat, p.lng]) || []}
                  pathOptions={{ color: track.color || TYPE_COLORS.other, weight: 3, opacity: 0.8 }}
                >
                  <Popup>
                    <div style={{ minWidth: '150px' }}>
                      <strong>{track.name}</strong><br />
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>
                        Adventure: {track.adventureName}
                      </span>
                    </div>
                  </Popup>
                </Polyline>
              ))}
            </MapView>
          </div>
        )}
      </div>

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Edit Series</h2>
            <form onSubmit={updateSeries}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={editSeries.name}
                  onChange={(e) => setEditSeries({ ...editSeries, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editSeries.description}
                  onChange={(e) => setEditSeries({ ...editSeries, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={updating}>
                  {updating ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdventurePicker && (
        <div className="modal-overlay" onClick={() => setShowAdventurePicker(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>Select Adventures</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '16px' }}>
              Drag to reorder. Adventures will appear in this order on the series page.
            </p>
            <div style={{ 
              maxHeight: '300px', 
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
            <div className="modal-actions">
              <button type="button" onClick={() => setShowAdventurePicker(false)} className="btn btn-outline">
                Cancel
              </button>
              <button type="button" onClick={updateSeriesAdventures} className="btn btn-primary">
                Save Order
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddAdventureModal && (
        <div className="modal-overlay" onClick={() => setShowAddAdventureModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>Add Adventure to Series</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '16px' }}>
              Select adventures to add to this series.
            </p>
            <div style={{ 
              maxHeight: '300px', 
              overflowY: 'auto', 
              border: '1px solid var(--border)', 
              borderRadius: '4px',
              padding: '8px'
            }}>
              {allAdventures.length === 0 ? (
                <p style={{ color: 'var(--text-light)' }}>No available adventures to add</p>
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
                      background: addingAdventures.includes(adv.id) ? 'var(--primary)' + '20' : 'transparent'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={addingAdventures.includes(adv.id)}
                      onChange={() => {
                        if (addingAdventures.includes(adv.id)) {
                          setAddingAdventures(addingAdventures.filter(id => id !== adv.id));
                        } else {
                          setAddingAdventures([...addingAdventures, adv.id]);
                        }
                      }}
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
            <div className="modal-actions">
              <button type="button" onClick={() => setShowAddAdventureModal(false)} className="btn btn-outline">
                Cancel
              </button>
              <button type="button" onClick={addAdventuresToSeries} className="btn btn-primary">
                Add{addingAdventures.length > 0 ? ` (${addingAdventures.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeriesView;