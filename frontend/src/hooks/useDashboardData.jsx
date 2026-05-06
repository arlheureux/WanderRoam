import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { VERSION, GIT_COMMIT } from '../version';

export function useDashboardData() {
  const [adventures, setAdventures] = useState([]);
  const [sharedAdventures, setSharedAdventures] = useState([]);
  const [series, setSeries] = useState([]);
  const [users, setUsers] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [seriesPagination, setSeriesPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [appVersion, setAppVersion] = useState({ version: '', tag: '', gitCommit: '' });
 
  const fetchGitHubRelease = async () => {
    try {
      const cached = localStorage.getItem('wanderroam_release_cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) { // 1 hour cache
          setAppVersion(data);
          return;
        }
      }

      if (VERSION) {
        setAppVersion({ version: VERSION, tag: 'stable', gitCommit: GIT_COMMIT });
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
      const [advRes, sharedRes, seriesRes, tagsRes] = await Promise.all([
        api.get('/adventures', { params: { page: pagination.page, limit: pagination.limit, tags: selectedTags.join(',') } }),
        api.get('/adventures', { params: { shared: true } }),
        api.get('/series', { params: { page: seriesPagination.page, limit: seriesPagination.limit } }),
        api.get('/adventures/tags')
      ]);

      setAdventures(advRes.data.adventures || []);
      setSharedAdventures(sharedRes.data.adventures || []);
      setSeries(seriesRes.data.series || []);
      setTags(tagsRes.data.tags || []);
      setPagination(prev => ({ ...prev, total: advRes.data.total || 0 }));
      setSeriesPagination(prev => ({ ...prev, total: seriesRes.data.total || 0 }));
      setError(null);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
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

  return {
    adventures,
    sharedAdventures,
    series,
    users,
    tags,
    selectedTags,
    setSelectedTags,
    loading,
    error,
    search,
    setSearch,
    showArchived,
    setShowArchived,
    sortBy,
    setSortBy,
    pagination,
    setPagination,
    seriesPagination,
    setSeriesPagination,
    loadData,
    loadUsers,
    fetchGitHubRelease,
    appVersion
  };
}
