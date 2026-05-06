import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const MapContext = createContext();

export const useMapContext = () => useContext(MapContext);

export const MapProvider = ({ children }) => {
  const [mapProvider, setMapProvider] = useState(() => localStorage.getItem('mapProvider') || 'osm');
  const [mapboxToken, setMapboxToken] = useState(() => localStorage.getItem('mapboxToken') || '');

  useEffect(() => {
    localStorage.setItem('mapProvider', mapProvider);
  }, [mapProvider]);

  useEffect(() => {
    localStorage.setItem('mapboxToken', mapboxToken);
  }, [mapboxToken]);

  const value = useMemo(() => ({
    mapProvider,
    setMapProvider,
    mapboxToken,
    setMapboxToken,
    isMapbox: mapProvider === 'mapbox' && mapboxToken
  }), [mapProvider, mapboxToken]);

  return (
    <MapContext.Provider value={value}>
      {children}
    </MapContext.Provider>
  );
};