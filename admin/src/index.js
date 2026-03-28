import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import api from './services/api';
import './styles/index.css';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { username, password });
      
      if (!res.user.isAdmin) {
        setError('Access denied. Admin only.');
        return;
      }

      localStorage.setItem('adminToken', res.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>WanderRoam Admin</h2>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '' });
  const [appVersion, setAppVersion] = useState({ version: '', tag: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/');
      return;
    }
    loadUsers();
    api.get('/version').then(v => setAppVersion(v)).catch(() => {});
  }, []);

  const loadUsers = async (page = 1) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const res = await api.get(`/admin/users?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.users);
      setPagination({
        page: res.pagination.page,
        limit: res.pagination.limit,
        total: res.pagination.total,
        totalPages: res.pagination.totalPages
      });
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('adminToken');
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      await api.put(`/admin/users/${selectedUser.id}/reset-password`, { newPassword }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('Password reset successfully');
      setShowPasswordModal(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to reset password', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      await api.post('/admin/users', newUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('User created successfully');
      setShowCreateModal(false);
      setNewUser({ username: '', password: '' });
      loadUsers(pagination.page);
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to create user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDeleteUser = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const token = localStorage.getItem('adminToken');
      await api.delete(`/admin/users/${userToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('User deleted successfully');
      setShowDeleteModal(false);
      setUserToDelete(null);
      loadUsers(pagination.page);
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to delete user', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/');
  };

  if (loading) return <div className="loading-screen">Loading...</div>;

  return (
    <div>
      {notification && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 1000,
          padding: '12px 20px', borderRadius: '8px',
          background: notification.type === 'error' ? '#FF6B6B' : '#00B894',
          color: 'white', fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          {notification.message}
        </div>
      )}
      <header className="header">
        <h1>WanderRoam Admin</h1>
        {appVersion.version && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', background: 'var(--background)', padding: '4px 8px', borderRadius: '4px' }}>
            {appVersion.version} ({appVersion.tag})
          </span>
        )}
        <button onClick={handleLogout} className="btn btn-outline btn-sm">Logout</button>
      </header>
      <div className="container">
        <div style={{ marginTop: '24px', marginBottom: '16px' }}>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">+ Create User</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: '8px' }}>
          <thead>
            <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Username</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Adventures</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Role</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px' }}>{user.username}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>{user.adventureCount}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {user.isAdmin && <span style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--accent)', color: 'white', fontSize: '0.75rem' }}>Admin</span>}
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <button onClick={() => { setSelectedUser(user); setShowPasswordModal(true); }} className="btn btn-outline btn-sm" style={{ marginRight: '8px' }}>Reset</button>
                  <button onClick={() => confirmDeleteUser(user)} className="btn btn-danger btn-sm">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
            <button className="btn btn-outline btn-sm" disabled={pagination.page <= 1} onClick={() => loadUsers(pagination.page - 1)}>Previous</button>
            <span style={{ padding: '8px 16px', color: 'var(--text-light)' }}>Page {pagination.page} of {pagination.totalPages}</span>
            <button className="btn btn-outline btn-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => loadUsers(pagination.page + 1)}>Next</button>
          </div>
        )}
      </div>

      {showPasswordModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Reset Password</h2>
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} required />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>Reset</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create User</h2>
            <form onSubmit={handleCreateUser}>
              <div className="form-group"><label>Username</label><input type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required /></div>
              <div className="form-group"><label>Password</label><input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} minLength={6} required /></div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && userToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Delete User</h2>
            <p style={{ marginBottom: '16px', color: 'var(--text-light)' }}>
              Are you sure you want to delete user <strong>{userToDelete.username}</strong>? 
              All their adventures will be permanently deleted.
            </p>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowDeleteModal(false)} className="btn btn-outline">Cancel</button>
              <button onClick={handleDeleteUser} className="btn btn-danger" disabled={actionLoading}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<AdminLogin />} />
      <Route path="/dashboard" element={<AdminDashboard />} />
    </Routes>
  </BrowserRouter>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
