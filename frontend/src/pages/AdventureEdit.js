import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

const WAYPOINT_ICONS = ['📍', '🏃', '🍽️', '📸', '🚿', '🏔️', '⚠️', '⛺', '🅿️', '💧', '🔍'];

const fixLeafletIcons = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
};

const createCustomIcon = (color, scale = 1) => {
  const size = 26 * scale;
  const half = size / 2;
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half]
  });
};

const createWaypointIcon = (icon, scale = 1) => {
  const size = 23 * scale; // 25% smaller (28 * 0.75)
  return L.divIcon({
    className: 'waypoint-marker',
    html: `<div style="
      position: relative;
      width: ${size}px;
      height: ${size * 1.4}px;
      display: flex;
      flex-direction: column;
      align-items: center;
    ">
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: #FF6B6B;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      ">
        <span style="
          transform: rotate(45deg);
          font-size: ${size * 0.55}px;
          line-height: 1;
        ">${icon}</span>
      </div>
      <div style="
        width: 0;
        height: 0;
        border-left: ${size * 0.2}px solid transparent;
        border-right: ${size * 0.2}px solid transparent;
        border-top: ${size * 0.3}px solid #FF6B6B;
      "></div>
    </div>`,
    iconSize: [size, size * 1.4],
    iconAnchor: [size/2, size * 1.4],
    popupAnchor: [0, -size * 1.2]
  });
};

const MapBounds = ({ tracks, pictures, waypoints }) => {
  const map = useMap();

  useEffect(() => {
    const allPoints = [];
    
    if (tracks && tracks.length > 0) {
      const trackPoints = tracks
        .filter(t => t.data && t.data.length > 0)
        .flatMap(t => t.data.map(p => [p.lat, p.lng]));
      allPoints.push(...trackPoints);
    }
    
    if (pictures && pictures.length > 0) {
      const picturePoints = pictures
        .filter(p => p.latitude && p.longitude)
        .map(p => [p.latitude, p.longitude]);
      allPoints.push(...picturePoints);
    }

    if (waypoints && waypoints.length > 0) {
      const waypointPoints = waypoints.map(w => [w.latitude, w.longitude]);
      allPoints.push(...waypointPoints);
    }

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [tracks, pictures, waypoints, map]);

  return null;
};

const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    }
  });
  return null;
};

const AdventureEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [adventure, setAdventure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingGpx, setUploadingGpx] = useState(false);
  const [gpxFile, setGpxFile] = useState(null);
  const [gpxName, setGpxName] = useState('');
  const [gpxType, setGpxType] = useState('hiking');
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [showImmichBrowser, setShowImmichBrowser] = useState(false);
  const [immichAlbums, setImmichAlbums] = useState([]);
  const [albumThumbnails, setAlbumThumbnails] = useState({});
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [immichAssets, setImmichAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [viewingPicture, setViewingPicture] = useState(null);
  const [pictureIndex, setPictureIndex] = useState(0);
  const [hoveredPictureId, setHoveredPictureId] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shares, setShares] = useState([]);
  const [users, setUsers] = useState([]);
  const [shareUsername, setShareUsername] = useState('');
  const [sharePermission, setSharePermission] = useState('view');
  const [loadingShares, setLoadingShares] = useState(false);
  const [newWaypoint, setNewWaypoint] = useState(null);
  const [editingWaypoint, setEditingWaypoint] = useState(null);
  const [waypointName, setWaypointName] = useState('');
  const [waypointIcon, setWaypointIcon] = useState('📍');
  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagCategory, setNewTagCategory] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);

  useEffect(() => {
    fixLeafletIcons();
    loadAdventure();
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!viewingPicture) return;
      if (e.key === 'ArrowLeft') prevPicture();
      if (e.key === 'ArrowRight') nextPicture();
      if (e.key === 'Escape') setViewingPicture(null);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingPicture, pictureIndex]);

  const loadAdventure = async () => {
    try {
      const res = await api.get(`/adventures/${id}`);
      setAdventure(res.data.adventure);
      setSelectedTags(res.data.adventure.tags || []);
    } catch (err) {
      console.error('Failed to load adventure:', err);
      navigate('/');
      return;
    }

    try {
      const tagsRes = await api.getTags();
      setAllTags(tagsRes.data.tags || []);
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadShares = async () => {
    setLoadingShares(true);
    try {
      const res = await api.get(`/adventures/${id}/share`);
      setShares(res.data.shares || []);
    } catch (err) {
      console.error('Failed to load shares:', err);
    } finally {
      setLoadingShares(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await api.get('/adventures/users');
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleOpenShareModal = async () => {
    await loadShares();
    await loadUsers();
    setShowShareModal(true);
  };

  const handleShare = async () => {
    if (!shareUsername) return;
    try {
      await api.post(`/adventures/${id}/share`, {
        username: shareUsername,
        permission: sharePermission
      });
      setShareUsername('');
      await loadShares();
    } catch (err) {
      console.error('Failed to share:', err);
      alert(err.message || 'Failed to share adventure');
    }
  };

  const handleRemoveShare = async (shareId) => {
    if (!window.confirm('Remove access for this user?')) return;
    try {
      await api.delete(`/adventures/${id}/share/${shareId}`);
      await loadShares();
    } catch (err) {
      console.error('Failed to remove share:', err);
    }
  };

  const updateAdventure = async (updates) => {
    setSaving(true);
    try {
      const res = await api.put(`/adventures/${id}`, updates);
      setAdventure({ ...adventure, ...res.data.adventure });
    } catch (err) {
      console.error('Failed to update adventure:', err);
    } finally {
      setSaving(false);
    }
  };

  const saveTags = async (tagIds) => {
    setSaving(true);
    try {
      const res = await api.updateAdventureTags(id, tagIds);
      setSelectedTags(res.data.tags || []);
      setAdventure({ ...adventure, tags: res.data.tags || [] });
    } catch (err) {
      console.error('Failed to save tags:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (tagId) => {
    const newSelected = selectedTags.some(t => t.id === tagId)
      ? selectedTags.filter(t => t.id !== tagId)
      : [...selectedTags, allTags.find(t => t.id === tagId)];
    setSelectedTags(newSelected);
    saveTags(newSelected.map(t => t.id));
  };

  const handleDeleteTag = async (tagId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this tag from all adventures?')) return;
    
    try {
      await api.deleteTag(tagId);
      setAllTags(allTags.filter(t => t.id !== tagId));
      setSelectedTags(selectedTags.filter(t => t.id !== tagId));
      await saveTags(selectedTags.filter(t => t.id !== tagId).map(t => t.id));
    } catch (err) {
      console.error('Failed to delete tag:', err);
      alert(err.response?.data?.error || 'Failed to delete tag');
    }
  };

  const handleCreateTag = async (e) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    
    setCreatingTag(true);
    try {
      const res = await api.createTag(newTagName.trim(), newTagCategory.trim() || 'Custom');
      const newTag = res.data.tag;
      setAllTags([...allTags, newTag].sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.name.localeCompare(b.name);
      }));
      setSelectedTags([...selectedTags, newTag]);
      await saveTags([...selectedTags.map(t => t.id), newTag.id]);
      setShowTagModal(false);
      setNewTagName('');
      setNewTagCategory('');
    } catch (err) {
      console.error('Failed to create tag:', err);
      alert(err.response?.data?.error || 'Failed to create tag');
    } finally {
      setCreatingTag(false);
    }
  };

  const handleGpxUpload = async (e) => {
    e.preventDefault();
    if (!gpxFile) return;

    setUploadingGpx(true);
    try {
      const formData = new FormData();
      formData.append('gpx', gpxFile);
      formData.append('name', gpxName || gpxFile.name.replace('.gpx', ''));
      formData.append('type', gpxType);
      formData.append('adventure_id', id);

      const res = await api.post(`/gpx/upload`, formData, true);
      
      setAdventure({
        ...adventure,
        GpxTracks: [...(adventure.GpxTracks || []), res.data.gpxTrack]
      });
      setMapKey(mapKey + 1);
      
      setGpxFile(null);
      setGpxName('');
    } catch (err) {
      console.error('Failed to upload GPX:', err);
    } finally {
      setUploadingGpx(false);
    }
  };

  const deleteGpx = async (gpxId) => {
    if (!window.confirm('Delete this GPX track?')) return;
    
    try {
      await api.delete(`/adventures/${id}/gpx/${gpxId}`);
      setAdventure({
        ...adventure,
        GpxTracks: adventure.GpxTracks.filter(t => t.id !== gpxId)
      });
      setMapKey(mapKey + 1);
    } catch (err) {
      console.error('Failed to delete GPX:', err);
    }
  };

  const addWaypoint = async (e) => {
    e.preventDefault();
    if (!newWaypoint) return;
    
    try {
      const res = await api.post(`/adventures/${id}/waypoints`, {
        name: waypointName,
        icon: waypointIcon,
        latitude: newWaypoint.lat,
        longitude: newWaypoint.lng
      });
      setAdventure({
        ...adventure,
        Waypoints: [...(adventure.Waypoints || []), res.data.waypoint]
      });
      setNewWaypoint(null);
      setWaypointName('');
      setWaypointIcon('📍');
    } catch (err) {
      console.error('Failed to add waypoint:', err);
    }
  };

  const updateWaypoint = async (e) => {
    e.preventDefault();
    if (!editingWaypoint) return;
    
    try {
      const res = await api.put(`/adventures/${id}/waypoints/${editingWaypoint.id}`, {
        name: waypointName,
        icon: waypointIcon
      });
      setAdventure({
        ...adventure,
        Waypoints: adventure.Waypoints.map(w => w.id === editingWaypoint.id ? res.data.waypoint : w)
      });
      setEditingWaypoint(null);
      setWaypointName('');
      setWaypointIcon('📍');
    } catch (err) {
      console.error('Failed to update waypoint:', err);
    }
  };

  const deleteWaypoint = async (waypointId) => {
    if (!window.confirm('Delete this waypoint?')) return;
    
    try {
      await api.delete(`/adventures/${id}/waypoints/${waypointId}`);
      setAdventure({
        ...adventure,
        Waypoints: adventure.Waypoints.filter(w => w.id !== waypointId)
      });
      setEditingWaypoint(null);
    } catch (err) {
      console.error('Failed to delete waypoint:', err);
    }
  };

  const loadImmichAssets = async (albumId = null) => {
    setLoadingAssets(true);
    try {
      const url = albumId ? `/immich/assets?albumId=${albumId}` : '/immich/assets';
      const res = await api.get(url);
      const assets = res.data.assets || [];
      setImmichAssets(assets);
      
      if (assets.length > 0) {
        const thumbRes = await api.get(`/immich/thumbnails?ids=${assets.map(a => a.id).join(',')}`);
        setImmichAssets(assets.map(a => ({
          ...a,
          originalThumbnailUrl: `/api/immich/thumbnail/${a.id}?size=preview`,
          thumbnailUrl: thumbRes.data.thumbnails[a.id] || `/api/immich/thumbnail/${a.id}?size=preview`
        })));
      }
    } catch (err) {
      console.error('Failed to load Immich assets:', err);
    } finally {
      setLoadingAssets(false);
    }
  };

  const loadImmichAlbums = async () => {
    try {
      const res = await api.get('/immich/albums');
      const albums = res.data.albums || [];
      setImmichAlbums(albums);

      const albumIdsWithThumbs = albums
        .filter(a => a.albumThumbnailAssetId)
        .map(a => a.albumThumbnailAssetId);
      
      if (albumIdsWithThumbs.length > 0) {
        const thumbRes = await api.get(`/immich/thumbnails?ids=${albumIdsWithThumbs.join(',')}`);
        setAlbumThumbnails(thumbRes.data.thumbnails || {});
      }
    } catch (err) {
      console.error('Failed to load Immich albums:', err);
    }
  };

  const handleOpenImmichBrowser = async () => {
    setSelectedAlbum(null);
    setImmichAssets([]);
    await loadImmichAlbums();
    setShowImmichBrowser(true);
  };

  const handleSelectAlbum = async (album) => {
    setSelectedAlbum(album);
    await loadImmichAssets(album.id);
  };

  const openPicture = (picture, index) => {
    setPictureIndex(index);
    setViewingPicture(picture);
  };

  const nextPicture = () => {
    const nextIndex = (pictureIndex + 1) % pictures.length;
    setPictureIndex(nextIndex);
    setViewingPicture(pictures[nextIndex]);
  };

  const prevPicture = () => {
    const prevIndex = (pictureIndex - 1 + pictures.length) % pictures.length;
    setPictureIndex(prevIndex);
    setViewingPicture(pictures[prevIndex]);
  };

  const addPicture = async (asset) => {
    const thumbUrl = asset.originalThumbnailUrl || `/api/immich/thumbnail/${asset.id}?size=preview`;
    try {
      const res = await api.post(`/adventures/${id}/pictures`, {
        immich_asset_id: asset.id,
        filename: asset.filename,
        latitude: asset.latitude,
        longitude: asset.longitude,
        taken_at: asset.takenAt,
        thumbnail_url: thumbUrl
      });
      
      setAdventure({
        ...adventure,
        Pictures: [...(adventure.Pictures || []), res.data.picture]
      });
      setMapKey(mapKey + 1);
    } catch (err) {
      console.error('Failed to add picture:', err);
    }
  };

  const togglePicture = async (asset) => {
    const existingPicture = pictures.find(p => p.immich_asset_id === asset.id);
    
    if (existingPicture) {
      try {
        await api.delete(`/adventures/${id}/pictures/${existingPicture.id}`);
        setAdventure({
          ...adventure,
          Pictures: adventure.Pictures.filter(p => p.id !== existingPicture.id)
        });
        setMapKey(mapKey + 1);
      } catch (err) {
        console.error('Failed to remove picture:', err);
      }
    } else {
      addPicture(asset);
    }
  };

  const deletePicture = async (pictureId) => {
    if (!window.confirm('Delete this picture?')) return;
    
    try {
      await api.delete(`/adventures/${id}/pictures/${pictureId}`);
      setAdventure({
        ...adventure,
        Pictures: adventure.Pictures.filter(p => p.id !== pictureId)
      });
      setMapKey(mapKey + 1);
    } catch (err) {
      console.error('Failed to delete picture:', err);
    }
  };

  if (loading) {
    return <div className="loading-screen">Loading adventure...</div>;
  }

  if (!adventure) {
    return <div className="loading-screen">Adventure not found</div>;
  }

  const gpxTracks = adventure.GpxTracks || [];
  const pictures = adventure.Pictures || [];
  const waypoints = adventure.Waypoints || [];
  
  const defaultCenter = [parseFloat(adventure.center_lat) || 46.2276, parseFloat(adventure.center_lng) || 2.2137];
  const defaultZoom = adventure.zoom || 10;

  return (
    <div>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/" className="back-link">← Back</Link>
          {!adventure.isOwner && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', background: 'var(--background)', padding: '4px 8px', borderRadius: '4px' }}>
              Read only
            </span>
          )}
        </div>
        <input
          type="text"
          value={adventure.name}
          onChange={(e) => updateAdventure({ name: e.target.value })}
          style={{ 
            flex: 1,
            textAlign: 'center',
            fontSize: '1.5rem', 
            fontWeight: 600, 
            border: 'none', 
            background: 'transparent',
            borderBottom: '2px solid transparent'
          }}
        />
        <div className="header-actions">
          {adventure.isOwner && (
            <button onClick={handleOpenShareModal} className="btn btn-outline btn-sm">Share</button>
          )}
          <Link to={`/adventure/${id}`} className="btn btn-primary btn-sm">View</Link>
        </div>
      </header>

      <div className="container">
        <div className="adventure-detail">
          <div className={`adventure-map-container ${mapFullscreen ? 'fullscreen' : ''}`}>
            <button 
              className="fullscreen-btn" 
              onClick={() => setMapFullscreen(!mapFullscreen)}
              title={mapFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {mapFullscreen ? '⛶' : '⛶'}
            </button>
            <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1000, background: 'rgba(255,255,255,0.9)', padding: '8px 12px', borderRadius: '4px', fontSize: '0.85rem' }}>
              Click on map to add waypoint
            </div>
            <MapContainer 
              key={mapKey}
              center={defaultCenter} 
              zoom={defaultZoom} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {gpxTracks.map(track => (
                <Polyline
                  key={track.id}
                  positions={track.data?.map(p => [p.lat, p.lng]) || []}
                  pathOptions={{ 
                    color: track.color || TYPE_COLORS[track.type] || TYPE_COLORS.other,
                    weight: 5,
                    opacity: selectedTrack && selectedTrack.id !== track.id ? 0.4 : 1
                  }}
                  eventHandlers={{
                    click: () => setSelectedTrack(track)
                  }}
                />
              ))}

              {pictures.map(picture => (
                picture.latitude && picture.longitude && (
                  <Marker
                    key={picture.id}
                    position={[picture.latitude, picture.longitude]}
                    icon={createCustomIcon('#FFD700', hoveredPictureId === picture.id ? 1.3 : 1)}
                    opacity={hoveredPictureId && hoveredPictureId !== picture.id ? 0.5 : 1}
                  >
                    <Popup>
                      {(picture.thumbnail_base64 || picture.thumbnail_url) && (
                        <img 
                          src={picture.thumbnail_base64 || picture.thumbnail_url} 
                          alt={picture.filename}
                          style={{ maxWidth: '240px', marginTop: '8px', borderRadius: '4px' }}
                        />
                      )}
                    </Popup>
                  </Marker>
                )
              ))}

              {waypoints.map(waypoint => (
                <Marker
                  key={waypoint.id}
                  position={[waypoint.latitude, waypoint.longitude]}
                  icon={createWaypointIcon(waypoint.icon)}
                  eventHandlers={{
                    click: () => {
                      setEditingWaypoint(waypoint);
                      setWaypointName(waypoint.name || '');
                      setWaypointIcon(waypoint.icon || '📍');
                    }
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: '150px' }}>
                      <strong>{waypoint.name || 'Waypoint'}</strong>
                      <div style={{ fontSize: '1.5rem', marginTop: '4px' }}>{waypoint.icon}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              <MapClickHandler onMapClick={(latlng) => {
                setNewWaypoint(latlng);
                setWaypointName('');
                setWaypointIcon('📍');
              }} />

              <MapBounds tracks={gpxTracks} pictures={pictures} waypoints={waypoints} />
            </MapContainer>
          </div>

          {newWaypoint && (
            <div className="modal-overlay" onClick={() => setNewWaypoint(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3>Add Waypoint</h3>
                <form onSubmit={addWaypoint}>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={waypointName}
                      onChange={(e) => setWaypointName(e.target.value)}
                      placeholder="Enter waypoint name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Icon</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {WAYPOINT_ICONS.map(icon => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => setWaypointIcon(icon)}
                          style={{
                            fontSize: '1.5rem',
                            padding: '8px',
                            border: waypointIcon === icon ? '2px solid #2196F3' : '1px solid #ddd',
                            borderRadius: '4px',
                            background: waypointIcon === icon ? '#E3F2FD' : '#fff',
                            cursor: 'pointer'
                          }}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn" onClick={() => setNewWaypoint(null)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Add Waypoint</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {editingWaypoint && (
            <div className="modal-overlay" onClick={() => setEditingWaypoint(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3>Edit Waypoint</h3>
                <form onSubmit={updateWaypoint}>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={waypointName}
                      onChange={(e) => setWaypointName(e.target.value)}
                      placeholder="Enter waypoint name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Icon</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {WAYPOINT_ICONS.map(icon => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => setWaypointIcon(icon)}
                          style={{
                            fontSize: '1.5rem',
                            padding: '8px',
                            border: waypointIcon === icon ? '2px solid #2196F3' : '1px solid #ddd',
                            borderRadius: '4px',
                            background: waypointIcon === icon ? '#E3F2FD' : '#fff',
                            cursor: 'pointer'
                          }}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: '#f44336', color: 'white' }}
                      onClick={() => deleteWaypoint(editingWaypoint.id)}
                    >
                      Delete
                    </button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="btn" onClick={() => setEditingWaypoint(null)}>Cancel</button>
                      <button type="submit" className="btn btn-primary">Save</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="adventure-sidebar">
            <div className="sidebar-section">
              <h3>Upload GPX</h3>
              <form onSubmit={handleGpxUpload}>
                <div className="form-group">
                  <input
                    type="file"
                    accept=".gpx"
                    onChange={(e) => setGpxFile(e.target.files[0])}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Track name (optional)"
                    value={gpxName}
                    onChange={(e) => setGpxName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <select value={gpxType} onChange={(e) => setGpxType(e.target.value)}>
                    <option value="walking">Walking</option>
                    <option value="hiking">Hiking</option>
                    <option value="cycling">Cycling</option>
                    <option value="bus">Bus</option>
                    <option value="metro">Metro</option>
                    <option value="train">Train</option>
                    <option value="boat">Boat</option>
                    <option value="car">Car</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%' }}
                  disabled={uploadingGpx || !gpxFile}
                >
                  {uploadingGpx ? 'Uploading...' : 'Upload GPX'}
                </button>
              </form>
            </div>

            <div className="sidebar-section">
              <h3>Date</h3>
              <input
                type="date"
                value={adventure.adventure_date || ''}
                onChange={(e) => updateAdventure({ adventure_date: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div className="sidebar-section">
              <h3>Tags</h3>
              {Object.keys(allTags.reduce((acc, tag) => {
                acc[tag.category] = true;
                return acc;
              }, {})).map(category => {
                const categoryTags = allTags.filter(t => t.category === category);
                if (categoryTags.length === 0) return null;
                return (
                  <div key={category} style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      {category}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {categoryTags.map(tag => {
                        const isSelected = selectedTags.some(t => t.id === tag.id);
                        return (
                          <div key={tag.id} style={{ display: 'flex', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => toggleTag(tag.id)}
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.8rem',
                                borderRadius: '12px 0 0 12px',
                                border: `1px solid ${isSelected ? tag.color : 'var(--border)'}`,
                                background: isSelected ? tag.color + '20' : 'transparent',
                                color: 'var(--text)',
                                cursor: 'pointer',
                                opacity: saving ? 0.5 : 1
                              }}
                            >
                              {tag.name}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTag(tag.id, e)}
                              style={{
                                padding: '4px 6px',
                                fontSize: '0.7rem',
                                borderRadius: '0 12px 12px 0',
                                border: `1px solid ${isSelected ? tag.color : 'var(--border)'}`,
                                borderLeft: 'none',
                                background: isSelected ? tag.color + '20' : 'transparent',
                                color: 'var(--text-light)',
                                cursor: 'pointer',
                                opacity: saving ? 0.5 : 1
                              }}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setShowTagModal(true)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  borderRadius: '12px',
                  border: '1px dashed var(--border)',
                  background: 'transparent',
                  color: 'var(--text-light)',
                  cursor: 'pointer',
                  marginTop: '4px'
                }}
              >
                + Add Tag
              </button>
            </div>

            <div className="sidebar-section">
              <h3>Description</h3>
              <textarea
                value={adventure.description || ''}
                onChange={(e) => updateAdventure({ description: e.target.value })}
                placeholder="Add a description..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  resize: 'vertical'
                }}
              />
            </div>

            <div className="sidebar-section">
              <h3>Transportation ({gpxTracks.length})</h3>
              {gpxTracks.length === 0 ? (
                <p style={{ color: 'var(--text-light)' }}>No tracks yet</p>
              ) : (
                <div className="gpx-list">
                  {gpxTracks.map(track => (
                    <div 
                      key={track.id} 
                      className="gpx-item"
                      style={{ borderLeftColor: track.color || TYPE_COLORS[track.type] }}
                    >
                      <div>
                        <div className="gpx-item-name">{track.name}</div>
                        <div className="gpx-item-type">{track.type}</div>
                        {track.distance > 0 && (
                          <div className="gpx-item-stats">
                            {track.distance.toFixed(1)} km
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => deleteGpx(track.id)}
                        className="btn btn-danger btn-sm"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {pictures.length > 0 && (
              <div className="sidebar-section">
                <h3>Preview Picture</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '8px' }}>
                  Select a picture to show on the adventure card
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {pictures.map(picture => (
                    <div
                      key={picture.id}
                      onClick={() => updateAdventure({ preview_picture_id: picture.id })}
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: adventure.preview_picture_id === picture.id ? '3px solid var(--primary)' : '2px solid var(--border)',
                        opacity: adventure.preview_picture_id === picture.id ? 1 : 0.7
                      }}
                    >
                      {(picture.thumbnail_base64 || picture.thumbnail_url) ? (
                        <img 
                          src={picture.thumbnail_base64 || picture.thumbnail_url} 
                          alt={picture.filename}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ 
                          width: '100%', 
                          height: '100%', 
                          background: 'var(--background)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          📷
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="sidebar-section">
              <h3>
                Pictures ({pictures.length})
                <button 
                  onClick={handleOpenImmichBrowser}
                  className="btn btn-outline btn-sm"
                >
                  + Add from Immich
                </button>
              </h3>
              {pictures.length === 0 ? (
                <p style={{ color: 'var(--text-light)' }}>No pictures yet</p>
              ) : (
                <div className="picture-grid">
                  {pictures.map((picture, index) => (
                    <div 
                      key={picture.id} 
                      className="picture-thumb" 
                      style={{ position: 'relative', cursor: 'pointer', transform: hoveredPictureId === picture.id ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }}
                      onClick={() => openPicture(picture, index)}
                      onMouseEnter={() => setHoveredPictureId(picture.id)}
                      onMouseLeave={() => setHoveredPictureId(null)}
                    >
                      {(picture.thumbnail_base64 || picture.thumbnail_url) ? (
                        <img src={picture.thumbnail_base64 || picture.thumbnail_url} alt={picture.filename} />
                      ) : (
                        <div style={{ 
                          width: '100%', 
                          height: '100%', 
                          background: 'var(--background)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          📷
                        </div>
                      )}
                      <button
                        onClick={() => deletePicture(picture.id)}
                        style={{
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          border: 'none',
                          background: 'var(--danger)',
                          color: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {viewingPicture && (
        <div 
          className="modal-overlay" 
          onClick={() => setViewingPicture(null)}
          style={{ background: 'rgba(0,0,0,0.95)', cursor: 'pointer' }}
        >
          <div 
            onClick={e => e.stopPropagation()} 
            style={{ 
              position: 'relative', 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center'
            }}
          >
            <img 
              src={viewingPicture.thumbnail_base64 || viewingPicture.thumbnail_url} 
              alt={viewingPicture.filename}
              style={{ maxWidth: '110%', maxHeight: '110%', objectFit: 'contain' }}
            />
            {pictures.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prevPicture(); }}
                  className="btn"
                  style={{
                    position: 'absolute',
                    left: '20px',
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: 'white',
                    fontSize: '1.5rem',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  ←
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); nextPicture(); }}
                  className="btn"
                  style={{
                    position: 'absolute',
                    right: '20px',
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: 'white',
                    fontSize: '1.5rem',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  →
                </button>
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  color: 'white',
                  fontSize: '0.9rem',
                  background: 'rgba(0,0,0,0.5)',
                  padding: '8px 16px',
                  borderRadius: '20px'
                }}>
                  {pictureIndex + 1} / {pictures.length}
                </div>
              </>
            )}
            <button
              onClick={() => setViewingPicture(null)}
              className="btn"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                fontSize: '1.2rem',
                padding: '10px 14px',
                borderRadius: '50%',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>Share Adventure</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <select
                  value={shareUsername}
                  onChange={(e) => setShareUsername(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '150px',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--text)'
                  }}
                >
                  <option value="">Select user...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.username}>{u.username}</option>
                  ))}
                </select>
                <select
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value)}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--text)'
                  }}
                >
                  <option value="view">View</option>
                  <option value="edit">Edit</option>
                </select>
                <button onClick={handleShare} className="btn btn-primary" disabled={!shareUsername}>Share</button>
              </div>
            </div>

            <h3>Shared with</h3>
            {loadingShares ? (
              <p>Loading...</p>
            ) : shares.length === 0 ? (
              <p style={{ color: 'var(--text-light)' }}>Not shared with anyone yet</p>
            ) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {shares.map(share => (
                  <div 
                    key={share.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px',
                      borderBottom: '1px solid var(--border)'
                    }}
                  >
                    <div>
                      <strong>{share.username}</strong>
                      <span style={{ color: 'var(--text-light)', marginLeft: '8px', fontSize: '0.8rem' }}>
                        ({share.permission})
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveShare(share.id)}
                      className="btn btn-danger btn-sm"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button onClick={() => setShowShareModal(false)} className="btn btn-outline">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showImmichBrowser && (
        <div className="modal-overlay" onClick={() => setShowImmichBrowser(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h2>
              {selectedAlbum ? `Album: ${selectedAlbum.albumName}` : 'Select Photos from Immich'}
            </h2>
            
            {selectedAlbum && (
              <button 
                onClick={() => { setSelectedAlbum(null); setImmichAssets([]); }}
                className="btn btn-outline btn-sm"
                style={{ marginBottom: '16px' }}
              >
                ← Back to Albums
              </button>
            )}

            {!selectedAlbum ? (
              <div className="album-grid">
                {immichAlbums.length === 0 ? (
                  <div className="empty-state">
                    <p>No albums found.</p>
                  </div>
                ) : (
                  immichAlbums.map(album => (
                    <div 
                      key={album.id} 
                      className="album-item"
                      onClick={() => handleSelectAlbum(album)}
                    >
                      {albumThumbnails[album.albumThumbnailAssetId] ? (
                        <img 
                          src={albumThumbnails[album.albumThumbnailAssetId]} 
                          alt={album.albumName}
                          style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px' }}
                        />
                      ) : (
                        <div style={{ 
                          width: '100%', 
                          height: '120px', 
                          background: 'var(--background)', 
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '2rem'
                        }}>
                          📁
                        </div>
                      )}
                      <div style={{ marginTop: '8px' }}>
                        <strong>{album.albumName}</strong>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                          {album.assetCount} photos
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : loadingAssets ? (
              <p>Loading photos...</p>
            ) : immichAssets.length === 0 ? (
              <div className="empty-state">
                <p>No photos with GPS coordinates in this album.</p>
              </div>
            ) : (
              <div className="immich-browser">
                {immichAssets.map(asset => {
                  const isSelected = pictures.some(p => p.immich_asset_id === asset.id);
                  return (
                    <div 
                      key={asset.id} 
                      className={`immich-asset ${isSelected ? 'selected' : ''}`}
                      onClick={() => { togglePicture(asset); }}
                    >
                      <img src={asset.thumbnailUrl} alt={asset.filename} />
                      <div className="immich-asset-info">
                        <strong>{asset.filename}</strong>
                        <p>
                          📍 {asset.latitude.toFixed(4)}, {asset.longitude.toFixed(4)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="modal-actions">
              <button onClick={() => setShowImmichBrowser(false)} className="btn btn-outline">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showTagModal && (
        <div className="modal-overlay" onClick={() => setShowTagModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Create New Tag</h3>
            <form onSubmit={handleCreateTag}>
              <div className="form-group">
                <label>Tag Name</label>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Enter tag name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Category (optional)</label>
                <input
                  type="text"
                  value={newTagCategory}
                  onChange={(e) => setNewTagCategory(e.target.value)}
                  placeholder="e.g., Activities, Locations, My Tags"
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setShowTagModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creatingTag || !newTagName.trim()}>
                  {creatingTag ? 'Creating...' : 'Create Tag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdventureEdit;
