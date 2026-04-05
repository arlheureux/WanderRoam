import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';
import { useAuth } from '../services/AuthContext';
import { useMapContext } from '../contexts/MapContext';
import { MapView, TYPE_COLORS } from '../components/MapView';
import api from '../services/api';
import { VERSION } from '../version';

const Logo = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '12px' }}>
    <g transform="rotate(45 16 16)">
      <rect x="5" y="5" width="10" height="10" fill="#10B981"/>
      <rect x="5" y="17" width="10" height="10" fill="#10B981"/>
      <rect x="17" y="5" width="10" height="10" fill="#10B981"/>
      <rect x="17" y="17" width="10" height="10" fill="#10B981"/>
    </g>
  </svg>
);

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

const Dashboard = () => {
  const [adventures, setAdventures] = useState([]);
  const [seriesList, setSeriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newAdventure, setNewAdventure] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [newSeries, setNewSeries] = useState({ name: '', description: '' });
  const [creatingSeries, setCreatingSeries] = useState(false);
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('sortBy') || 'adventure_date');
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('sortOrder') || 'DESC');
  const [activeTab, setActiveTab] = useState('adventures');
  const [allTracks, setAllTracks] = useState([]);
  const [visibleAdventures, setVisibleAdventures] = useState({});
  const [appVersion, setAppVersion] = useState({ version: '', tag: '' });
  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMapTag, setSelectedMapTag] = useState(null);
  const { user, logout } = useAuth();
  const { mapProvider, mapboxToken, isMapbox } = useMapContext();
  const navigate = useNavigate();

  useEffect(() => {
    loadAdventures();
    loadSeries();
    loadTags();
    if (VERSION) {
      setAppVersion({ version: VERSION, tag: 'latest' });
    }
  }, [sortBy, sortOrder, selectedTags]);

  useEffect(() => {
    if (activeTab === 'map') {
      loadAllTracks();
    }
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('sortBy', sortBy);
    localStorage.setItem('sortOrder', sortOrder);
  }, [sortBy, sortOrder]);

  const getAdventureTags = (adventureId) => {
    const adventure = adventures.find(a => a.id === adventureId);
    return adventure?.tags?.map(t => t.name) || [];
  };

  useEffect(() => {
    if (activeTab !== 'map' || allTracks.length === 0) return;
    
    const adventureIds = [...new Set(allTracks.map(t => t.adventureId))];
    
    if (selectedMapTag) {
      const newVisible = {};
      adventureIds.forEach(id => {
        newVisible[id] = getAdventureTags(id).includes(selectedMapTag);
      });
      setVisibleAdventures(newVisible);
    } else {
      const newVisible = {};
      adventureIds.forEach(id => {
        newVisible[id] = true;
      });
      setVisibleAdventures(newVisible);
    }
  }, [selectedMapTag, activeTab, allTracks.length]);

  const loadTags = async () => {
    try {
      const res = await api.getTags();
      setAllTags(res.data.tags || []);
    } catch (err) {
      toast.error('Failed to load tags');
    }
  };

  const loadAdventures = async () => {
    try {
      const tagsParam = selectedTags.length > 0 ? `&tags=${selectedTags.join(',')}` : '';
      const res = await api.get(`/adventures?sort=${sortBy}&order=${sortOrder}${tagsParam}`);
      setAdventures(res.data.adventures);
      setLoading(false);
    } catch (err) {
      toast.error('Failed to load adventures');
      setLoading(false);
    }
  };

const loadAllTracks = async () => {
    try {
      const res = await api.get('/adventures/all-gpx');
      setAllTracks(res.data.tracks);
      
      const adventures = {};
      res.data.tracks.forEach(t => {
        adventures[t.adventureId] = true;
      });
      setVisibleAdventures(adventures);
    } catch (err) {
      toast.error('Failed to load tracks');
    }
  };

  const loadSeries = async () => {
    try {
      const res = await api.getSeries();
      setSeriesList(res.data.series || []);
    } catch (err) {
      console.error('Failed to load series');
    }
  };

const createAdventure = async (e) => {
  e.preventDefault();
  setCreating(true);

  try {
    const res = await api.post('/adventures', newAdventure);
    navigate(`/adventure/${res.data.adventure.id}/edit`);
  } catch (err) {
    toast.error('Failed to create adventure');
  } finally {
    setCreating(false);
    setShowModal(false);
  }
};

const createSeries = async (e) => {
  e.preventDefault();
  setCreatingSeries(true);

  try {
    const res = await api.createSeries(newSeries);
    setShowSeriesModal(false);
    setNewSeries({ name: '', description: '' });
    navigate(`/series/${res.data.series.id}`);
  } catch (err) {
    toast.error('Failed to create series');
  } finally {
    setCreatingSeries(false);
  }
};

  const toggleAdventure = (adventureId) => {
    setVisibleAdventures(prev => ({
      ...prev,
      [adventureId]: !prev[adventureId]
    }));
  };

  const toggleAll = (show) => {
    const currentAdventureIds = uniqueAdventures.map(a => a.id);
    const newVisible = { ...visibleAdventures };
    currentAdventureIds.forEach(id => {
      newVisible[id] = show;
    });
    setVisibleAdventures(newVisible);
  };

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

  const allUniqueAdventures = [...new Set(allTracks.map(t => JSON.stringify({ id: t.adventureId, name: t.adventureName, color: t.color })))].map(s => JSON.parse(s));
  
  const uniqueAdventures = selectedMapTag 
    ? allUniqueAdventures.filter(adv => getAdventureTags(adv.id).includes(selectedMapTag))
    : allUniqueAdventures;

  const seriesAdventureIds = new Set(
    seriesList.flatMap(s => s.adventureIds || [])
  );

  const filteredAdventures = adventures.filter(a => !seriesAdventureIds.has(a.id));

  const combinedItems = [
    ...filteredAdventures.map(a => ({ type: 'adventure', data: a })),
    ...seriesList.map(s => ({ type: 'series', data: s }))
  ].sort((a, b) => {
    const aVal = sortBy === 'name' 
      ? a.data.name 
      : (a.data.adventure_date || a.data.start_date || a.data.createdAt);
    const bVal = sortBy === 'name' 
      ? b.data.name 
      : (b.data.adventure_date || b.data.start_date || b.data.createdAt);
    
    if (sortOrder === 'ASC') {
      return String(aVal).localeCompare(String(bVal));
    }
    return String(bVal).localeCompare(String(aVal));
  });

  if (loading && activeTab === 'adventures') {
    return <div className="loading-screen">Loading adventures...</div>;
  }

  return (
    <div>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Logo />
          <h1>WanderRoam</h1>
          {appVersion.version && (
            <span style={{ marginLeft: '12px', fontSize: '0.75rem', color: 'var(--text-light)', background: 'var(--background)', padding: '4px 8px', borderRadius: '4px' }}>
              {appVersion.version} ({appVersion.tag})
            </span>
          )}
        </div>
        <div className="header-actions">
          <Link to="/stats" className="btn btn-outline btn-sm">Stats</Link>
          <Link to="/settings" className="btn btn-outline btn-sm">Settings</Link>
          <span>Welcome, {user?.username}</span>
          <button onClick={logout} className="btn btn-outline btn-sm">Logout</button>
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
            📋 Adventures
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
          >
            🗺️ All Tracks
          </button>
        </div>
      </div>

      {activeTab === 'adventures' && (
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            <h2>My Adventures</h2>
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
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="btn btn-outline btn-sm"
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: showFilters ? 'var(--primary)' : 'var(--background)',
                  color: showFilters ? 'white' : 'var(--text)',
                  cursor: 'pointer'
                }}
              >
                {showFilters ? '▼' : '▶'} Filters{selectedTags.length > 0 ? ` (${selectedTags.length})` : ''}
              </button>
              <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ marginLeft: '8px' }}>
                + New Adventure
              </button>
              <button onClick={() => setShowSeriesModal(true)} className="btn btn-outline" style={{ marginLeft: '8px' }}>
                + New Series
              </button>
            </div>
          </div>

          {allTags.length > 0 && showFilters && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginRight: '8px' }}>Filter:</span>
              <button
                onClick={() => setSelectedTags([])}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  borderRadius: '12px',
                  border: selectedTags.length === 0 ? '1px solid #2196F3' : '1px solid var(--border)',
                  background: selectedTags.length === 0 ? '#E3F2FD' : 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  marginBottom: '8px'
                }}
              >
                All
              </button>
              {Object.keys(allTags.reduce((acc, tag) => {
                acc[tag.category] = true;
                return acc;
              }, {})).map(category => {
                const categoryTags = allTags.filter(t => t.category === category);
                if (categoryTags.length === 0) return null;
                return (
                  <div key={category} style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {category}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {categoryTags.map(tag => {
                        const isSelected = selectedTags.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTags(selectedTags.filter(id => id !== tag.id));
                              } else {
                                setSelectedTags([...selectedTags, tag.id]);
                              }
                            }}
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.8rem',
                              borderRadius: '12px',
                              border: `1px solid ${isSelected ? tag.color : 'var(--border)'}`,
                              background: isSelected ? tag.color + '20' : 'transparent',
                              color: 'var(--text)',
                              cursor: 'pointer'
                            }}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {combinedItems.length === 0 ? (
            <div className="empty-state">
              <h3>No adventures yet</h3>
              <p>Create your first adventure to get started</p>
            </div>
          ) : (
              <div className="adventures-grid">
                {combinedItems.map(item => item.type === 'series' ? (
                  <div 
                    key={item.data.id} 
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
                        <span className="stat">📏 {item.data.totalDistance ? (item.data.totalDistance / 1000).toFixed(1) : 0} km</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div 
                    key={item.data.id} 
                    className="adventure-card"
                    onClick={() => navigate(`/adventure/${item.data.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="adventure-card-preview">
                      {item.data.preview_picture ? (
                        <img 
                          src={item.data.preview_picture.thumbnail_base64 || item.data.preview_picture.thumbnail_url} 
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
                      {item.data.gpxByType && Object.keys(item.data.gpxByType).map(type => (
                        <span 
                          key={type}
                          className="stat-badge"
                          style={{ backgroundColor: getTypeColor(type) }}
                        >
                          {item.data.gpxByType[type]} {type}
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
              )              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'map' && (
        <div className="container">
          {allTracks.length === 0 ? (
            <div className="empty-state">
              <h3>No tracks found</h3>
              <p>Add GPX tracks to your adventures to see them here</p>
            </div>
          ) : (
            <>
              {(() => {
                const adventureIdsWithTracks = [...new Set(allTracks.map(t => t.adventureId))];
                const tagsFromAdventures = adventures.filter(a => adventureIdsWithTracks.includes(a.id));
                const uniqueTags = [...new Set(tagsFromAdventures.flatMap(a => (a.tags || []).map(t => t.name)))];
                
                return uniqueTags.length > 0 ? (
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
                ) : null;
              })()}

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
                <MapView 
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
                </MapView>
              </div>

              <div style={{ marginTop: '16px', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                {allTracks.filter(t => visibleAdventures[t.adventureId]).length} tracks visible • Click on a track to see details
              </div>
            </>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>New Adventure</h2>
            <form onSubmit={createAdventure}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={newAdventure.name}
                  onChange={(e) => setNewAdventure({ ...newAdventure, name: e.target.value })}
                  placeholder="My Great Adventure"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={newAdventure.description}
                  onChange={(e) => setNewAdventure({ ...newAdventure, description: e.target.value })}
                  placeholder="A brief description..."
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">
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

      {showSeriesModal && (
        <div className="modal-overlay" onClick={() => setShowSeriesModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>New Series</h2>
            <form onSubmit={createSeries}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={newSeries.name}
                  onChange={(e) => setNewSeries({ ...newSeries, name: e.target.value })}
                  placeholder="Weekend Trip to Alps"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={newSeries.description}
                  onChange={(e) => setNewSeries({ ...newSeries, description: e.target.value })}
                  placeholder="A multi-day hiking adventure..."
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowSeriesModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creatingSeries}>
                  {creatingSeries ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
