import { useState, useEffect, useCallback, useMemo } from 'react';
import React from 'react';
import api from '../services/api';
import { VERSION, GIT_COMMIT } from '../version';
import { useAuth } from '../services/AuthContext';
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

export function useDashboardData() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [adventures, setAdventures] = useState([]);
  const [sharedAdventures, setSharedAdventures] = useState([]);
  const [seriesList, setSeriesList] = useState([]);
  const [users, setUsers] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [allTracks, setAllTracks] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [activeTab, setActiveTab] = useState('adventures');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMapTag, setSelectedMapTag] = useState(null);
  const [toggleState, setToggleState] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [seriesPagination, setSeriesPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [appVersion, setAppVersion] = useState({ version: '', tag: '', gitCommit: '' });

  const [showModal, setShowModal] = useState(false);
  const [newAdventure, setNewAdventure] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [newSeries, setNewSeries] = useState({ name: '', description: '' });
  const [creatingSeries, setCreatingSeries] = useState(false);

  const fetchGitHubRelease = async () => {
    try {
      const cached = localStorage.getItem('wanderroam_release_cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) {
          setAppVersion(data);
          return;
        }
      }

      if (VERSION) {
        setAppVersion({ version: VERSION, tag: VERSION, gitCommit: GIT_COMMIT });
        return;
      }

      const res = await fetch('https://api.github.com/repos/arlheureux/WanderRoam/releases/latest');
      if (res.ok) {
        const data = await res.json();
        const versionInfo = { version: data.tag_name?.replace('v', '') || '', tag: data.tag_name || '', gitCommit: '' };
        setAppVersion(versionInfo);
        localStorage.setItem('wanderroam_release_cache', JSON.stringify({ data: versionInfo, timestamp: Date.now() }));
      }
    } catch (err) {
      console.error('Failed to fetch release info', err);
    }
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [advRes, sharedRes, seriesRes, tagsRes, gpxRes] = await Promise.all([
        api.get('/adventures', { params: { page: pagination.page, limit: pagination.limit, tags: selectedTags.join(',') } }),
        api.get('/adventures', { params: { shared: true } }),
        api.get('/series', { params: { page: seriesPagination.page, limit: seriesPagination.limit } }),
        api.get('/adventures/tags'),
        api.get('/adventures/all-gpx', { params: { full: true } })
      ]);

      setAdventures(advRes.data.adventures || []);
      setSharedAdventures(sharedRes.data.adventures || []);
      setSeriesList(seriesRes.data.series || []);
      setAllTags(tagsRes.data.tags || []);
      setAllTracks(gpxRes.data.tracks || []);
      setPagination(prev => ({ ...prev, total: advRes.data.total || 0 }));
      setSeriesPagination(prev => ({ ...prev, total: seriesRes.data.total || 0 }));
      setError(null);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingSeries(false);
    }
  }, [pagination.page, pagination.limit, seriesPagination.page, seriesPagination.limit, selectedTags]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadUsers = async () => {
    try {
      const res = await api.get('/adventures/users');
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  const createAdventure = async () => {
    if (!newAdventure.name.trim()) return;
    try {
      setCreating(true);
      await api.post('/adventures', {
        name: newAdventure.name,
        description: newAdventure.description || ''
      });
      setNewAdventure({ name: '', description: '' });
      setShowModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to create adventure', err);
    } finally {
      setCreating(false);
    }
  };

  const createSeries = async () => {
    if (!newSeries.name.trim()) return;
    try {
      setCreatingSeries(true);
      await api.post('/series', {
        name: newSeries.name,
        description: newSeries.description || ''
      });
      setNewSeries({ name: '', description: '' });
      setShowSeriesModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to create series', err);
    } finally {
      setCreatingSeries(false);
    }
  };

  const toggleAdventure = (id) => {
    setToggleState(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleAll = () => {
    const allVisible = Object.values(toggleState).every(v => v);
    const newState = {};
    adventures.forEach(a => {
      newState[a.id] = !allVisible;
    });
    setToggleState(newState);
  };

  const visibleAdventures = toggleState;

  const uniqueAdventures = useMemo(() => {
    return [...new Set(adventures.map(a => a.id))];
  }, [adventures]);

  const allUniqueAdventures = uniqueAdventures;

  const combinedItems = useMemo(() => {
    const items = [
      ...adventures.map(a => ({ type: 'adventure', data: a })),
      ...seriesList.map(s => ({ type: 'series', data: s }))
    ];
    return items;
  }, [adventures, seriesList]);

  return {
    adventures,
    sharedAdventures,
    seriesList,
    users,
    allTags,
    selectedTags,
    setSelectedTags,
    loading,
    loadingSeries,
    error,
    searchQuery,
    setSearchQuery,
    showArchived,
    setShowArchived,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    activeTab,
    setActiveTab,
    showFilters,
    setShowFilters,
    selectedMapTag,
    setSelectedMapTag,
    pagination,
    setPagination,
    seriesPagination,
    setSeriesPagination,
    loadData,
    loadUsers,
    fetchGitHubRelease,
    appVersion,
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
    user,
    logout,
    navigate,
    createAdventure,
    createSeries,
    toggleAdventure,
    toggleAll,
    getTypeColor,
    allTracks,
    visibleAdventures,
    uniqueAdventures,
    allUniqueAdventures,
    combinedItems
  };
}