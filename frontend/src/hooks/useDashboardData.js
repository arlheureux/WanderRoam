import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../services/AuthContext';
import api from '../services/api';
import { VERSION } from '../version';
import { simplifyTracks } from '../utils/gpxSimplify';

export function useDashboardData() {
  const [adventures, setAdventures] = useState([]);
  const [seriesList, setSeriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSeries, setLoadingSeries] = useState(false);
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
  const [appVersion, setAppVersion] = useState({ version: '', tag: '', gitCommit: '' });
  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMapTag, setSelectedMapTag] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    
    const loadData = async () => {
      try {
        await Promise.all([
          loadAdventures(),
          loadSeries(),
          loadTags()
        ]);
        if (!controller.signal.aborted) {
          fetchGitHubRelease();
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Failed to load data:', err);
        }
      }
    };
    
    loadData();
    
    return () => {
      controller.abort();
    };
  }, [sortBy, sortOrder, selectedTags]);

  const fetchGitHubRelease = async () => {
    const CACHE_KEY = 'wr_github_release';
    const CACHE_TTL = 3600000; // 1 hour

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setAppVersion(data);
          return;
        }
      }

      const res = await fetch('https://api.github.com/repos/arlheureux/WanderRoam/releases/latest');
      if (res.ok) {
        const data = await res.json();
        const version = {
          version: data.tag_name || '',
          tag: data.tag_name ? data.tag_name.replace('v', '') : '',
          gitCommit: ''
        };
        setAppVersion(version);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: version, timestamp: Date.now() }));
      } else {
        if (VERSION) {
          setAppVersion({ version: VERSION, tag: 'stable', gitCommit: '' });
        }
      }
    } catch (err) {
      if (VERSION) {
        setAppVersion({ version: VERSION, tag: 'stable', gitCommit: '' });
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'map') {
      const controller = new AbortController();
      
      const loadData = async () => {
        try {
          await loadAllTracks();
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Failed to load tracks:', err);
          }
        }
      };
      
      loadData();
      
      return () => {
        controller.abort();
      };
    }
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('sortBy', sortBy);
    localStorage.setItem('sortOrder', sortOrder);
  }, [sortBy, sortOrder]);

  const getAdventureTags = useCallback((adventureId) => {
    const adventure = adventures.find(a => a.id === adventureId);
    return adventure?.tags?.map(t => t.name) || [];
  }, [adventures]);

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
      const res = await api.get('/adventures/all-gpx?full=true');
      const tracks = res.data.tracks || [];
      const simplified = simplifyTracks(tracks, 5);
      setAllTracks(simplified);
      
      const advs = {};
      tracks.forEach(t => {
        advs[t.adventureId] = true;
      });
      setVisibleAdventures(advs);
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

  const allUniqueAdventures = useMemo(() =>
    [...new Set(allTracks.map(t => JSON.stringify({ id: t.adventureId, name: t.adventureName, color: t.color })))].map(s => JSON.parse(s)),
    [allTracks]
  );

  const uniqueAdventures = useMemo(() =>
    selectedMapTag
      ? allUniqueAdventures.filter(adv => getAdventureTags(adv.id).includes(selectedMapTag))
      : allUniqueAdventures,
    [allUniqueAdventures, selectedMapTag]
  );

  const seriesAdventureIds = useMemo(() =>
    new Set(seriesList.flatMap(s => s.adventureIds || [])),
    [seriesList]
  );

  const filteredAdventures = useMemo(() =>
    adventures.filter(a => !seriesAdventureIds.has(a.id)),
    [adventures, seriesAdventureIds]
  );

  const combinedItems = useMemo(() => [
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
  }).filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (item.data.name || '').toLowerCase();
    const desc = (item.data.description || '').toLowerCase();
    return name.includes(q) || desc.includes(q);
  }), [filteredAdventures, seriesList, sortBy, sortOrder, searchQuery]);

  return {
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
    visibleAdventures,
    setVisibleAdventures,
    appVersion,
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
    getAdventureTags,
    createAdventure,
    createSeries,
    toggleAdventure,
    toggleAll,
    getTypeColor,
    allUniqueAdventures,
    uniqueAdventures,
    seriesAdventureIds,
    filteredAdventures,
    combinedItems
  };
}
