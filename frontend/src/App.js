import React from 'react';
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
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/adventure/:id" element={
            <ProtectedRoute>
              <AdventureView />
            </ProtectedRoute>
          } />
          <Route path="/adventure/:id/edit" element={
            <ProtectedRoute>
              <AdventureEdit />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/stats" element={
            <ProtectedRoute>
              <Stats />
            </ProtectedRoute>
          } />
          <Route path="/series/:id" element={
            <ProtectedRoute>
              <SeriesView />
            </ProtectedRoute>
          } />
        </Routes>
        </BrowserRouter>
      </MapProvider>
    </AuthProvider>
  );
}

export default App;
