import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/AuthContext';
import { MapProvider } from './contexts/MapContext';
import ToastContainer from './components/Toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdventureView from './pages/AdventureView';
import AdventureEdit from './pages/AdventureEdit';
import Settings from './pages/Settings';
import Stats from './pages/Stats';
import SeriesView from './pages/SeriesView';
import Series from './pages/Series';
import Setup from './pages/Setup';
import api from './services/api';

const isNative = () => window.Capacitor?.isNativePlatform?.() || false;

const SetupGate = ({ children }) => {
  const [needsSetup, setNeedsSetup] = useState(null);

  useEffect(() => {
    if (!isNative()) {
      setNeedsSetup(false);
      return;
    }
    api.getServerUrl().then(url => {
      setNeedsSetup(!url);
    });
  }, []);

  if (needsSetup === null) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (needsSetup) {
    return <Setup />;
  }

  return children;
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }
  
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <MapProvider>
        <ToastContainer />
        <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<Setup />} />
          <Route path="/login" element={
            <SetupGate><Login /></SetupGate>
          } />
          <Route path="/register" element={
            <SetupGate><Register /></SetupGate>
          } />
          <Route path="/" element={
            <SetupGate>
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            </SetupGate>
          } />
          <Route path="/adventure/:id" element={
            <SetupGate>
              <ProtectedRoute>
                <AdventureView />
              </ProtectedRoute>
            </SetupGate>
          } />
          <Route path="/adventure/:id/edit" element={
            <SetupGate>
              <ProtectedRoute>
                <AdventureEdit />
              </ProtectedRoute>
            </SetupGate>
          } />
          <Route path="/settings" element={
            <SetupGate>
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            </SetupGate>
          } />
          <Route path="/stats" element={
            <SetupGate>
              <ProtectedRoute>
                <Stats />
              </ProtectedRoute>
            </SetupGate>
          } />
          <Route path="/series" element={
            <SetupGate>
              <ProtectedRoute>
                <Series />
              </ProtectedRoute>
            </SetupGate>
          } />
          <Route path="/series/:id" element={
            <SetupGate>
              <ProtectedRoute>
                <SeriesView />
              </ProtectedRoute>
            </SetupGate>
          } />
        </Routes>
        </BrowserRouter>
      </MapProvider>
    </AuthProvider>
  );
}

export default App;
