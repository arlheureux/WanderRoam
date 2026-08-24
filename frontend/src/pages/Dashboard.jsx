import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDashboardData } from '../hooks/useDashboardData';
import AdventureList from '../components/dashboard/AdventureList';
import CreateAdventureModal from '../components/dashboard/CreateAdventureModal';
import CreateSeriesModal from '../components/dashboard/CreateSeriesModal';
import SeriesList from '../components/dashboard/SeriesList';
import DashboardMapView from '../components/dashboard/MapView';
import VersionBanner from '../components/dashboard/VersionBanner';
import { useEscapeKey } from '../hooks/useEscapeKey';

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

const Dashboard = () => {
  const {
    adventures,
    seriesList,
    loading,
    loadingSeries,
    showModal,
    setShowModal,
    newAdventure,
    setNewAdventure,
    creating,
    showSeriesModal,
    setShowSeriesModal,
    newSeries,
    setNewSeries,
    creatingSeries,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    activeTab,
    setActiveTab,
    allTracks,
    loadAllTracks,
    allTracksLoading,
    visibleAdventures,
    appVersion,
    fetchGitHubRelease,
    allTags,
    selectedTags,
    setSelectedTags,
    showFilters,
    setShowFilters,
    selectedMapTag,
    setSelectedMapTag,
    searchQuery,
    setSearchQuery,
    user,
    logout,
    navigate,
    createAdventure,
    createSeries,
    toggleAdventure,
    toggleAll,
    getTypeColor,
    allUniqueAdventures,
    uniqueAdventures,
    combinedItems
  } = useDashboardData();

  useEscapeKey(() => setShowModal(false), showModal);
  useEscapeKey(() => setShowSeriesModal(false), showSeriesModal);

  useEffect(() => {
    fetchGitHubRelease();
  }, [fetchGitHubRelease]);

  useEffect(() => {
    if (activeTab === 'map') loadAllTracks();
  }, [activeTab, loadAllTracks]);

  if (loading && activeTab === 'adventures') {
    return <div className="loading-screen">Loading adventures...</div>;
  }

  return (
    <div>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Logo />
          <h1>WanderRoam</h1>
          <VersionBanner appVersion={appVersion} />
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
             onClick={() => setActiveTab('series')}
             className={`tab-btn ${activeTab === 'series' ? 'active' : ''}`}
           >
             📚 Series
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
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search adventures..."
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  width: '200px',
                }}
              />
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

          <AdventureList 
            combinedItems={combinedItems}
            searchQuery={searchQuery}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            allTags={allTags}
            navigate={navigate}
            getTypeColor={getTypeColor}
          />
        </div>
      )}

      {activeTab === 'series' && (
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            <h2>My Series</h2>
            <button onClick={() => setShowSeriesModal(true)} className="btn btn-primary">
              + New Series
            </button>
          </div>
          <SeriesList 
            seriesList={seriesList}
            loadingSeries={loadingSeries}
            onCreateNew={() => setShowSeriesModal(true)}
            navigate={navigate}
          />
        </div>
      )}

      {activeTab === 'map' && (
        <div className="container">
          <DashboardMapView
            allTracks={allTracks}
            allTracksLoading={allTracksLoading}
            visibleAdventures={visibleAdventures}
            mapProvider={'leaflet'}
            mapboxToken={null}
            selectedMapTag={selectedMapTag}
            setSelectedMapTag={setSelectedMapTag}
            adventures={adventures}
            toggleAdventure={toggleAdventure}
            toggleAll={toggleAll}
            uniqueAdventures={uniqueAdventures}
          />
        </div>
      )}

      <CreateAdventureModal 
        show={showModal}
        newAdventure={newAdventure}
        setNewAdventure={setNewAdventure}
        creating={creating}
        onCreate={createAdventure}
        onClose={() => setShowModal(false)}
      />

      <CreateSeriesModal 
        show={showSeriesModal}
        newSeries={newSeries}
        setNewSeries={setNewSeries}
        creatingSeries={creatingSeries}
        onCreate={createSeries}
        onClose={() => setShowSeriesModal(false)}
      />
    </div>
  );
};

export default Dashboard;
