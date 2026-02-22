import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import api from '../services/api';

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [password, setPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [user]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.users);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to fetch users' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    setActionLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.post('/admin/users', { username: newUsername, password: newPassword });
      setUsers([res.data.user, ...users]);
      setShowCreateModal(false);
      setNewUsername('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'User created successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create user' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    setActionLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await api.put(`/admin/users/${selectedUser.id}/reset-password`, { newPassword: password });
      setShowPasswordModal(false);
      setPassword('');
      setSelectedUser(null);
      setMessage({ type: 'success', text: 'Password reset successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to reset password' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAdmin = async (userId) => {
    try {
      const res = await api.put(`/admin/users/${userId}/toggle-admin`);
      setUsers(users.map(u => u.id === userId ? { ...u, isAdmin: res.data.user.isAdmin } : u));
      setMessage({ type: 'success', text: res.data.message });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update admin status' });
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This will also delete all their adventures.')) {
      return;
    }
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(users.filter(u => u.id !== userId));
      setMessage({ type: 'success', text: 'User deleted successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to delete user' });
    }
  };

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <div>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/" className="back-link">← Back</Link>
        </div>
        <h1>Admin Dashboard</h1>
        <div style={{ width: '100px' }}></div>
      </header>

      <div className="container">
        {message.text && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            background: message.type === 'error' ? '#FFEBEE' : '#E8F5E9',
            color: message.type === 'error' ? '#C62828' : '#2E7D32'
          }}>
            {message.text}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2>Users ({users.length})</h2>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + Create User
          </button>
        </div>

        <div className="adventure-grid" style={{ gridTemplateColumns: '1fr' }}>
          {users.map(u => (
            <div key={u.id} className="adventure-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="adventure-name" style={{ fontWeight: 'bold' }}>
                  {u.username}
                  {u.isAdmin && <span style={{ marginLeft: '8px', fontSize: '0.75rem', background: '#FF9800', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>ADMIN</span>}
                  {u.id === user?.id && <span style={{ marginLeft: '8px', fontSize: '0.75rem', background: '#2196F3', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>YOU</span>}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '4px' }}>
                  {u.adventureCount} adventures • Created {new Date(u.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-sm"
                  onClick={() => { setSelectedUser(u); setShowPasswordModal(true); }}
                >
                  Reset Password
                </button>
                {u.id !== user?.id && (
                  <>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleToggleAdmin(u.id)}
                    >
                      {u.isAdmin ? 'Remove Admin' : 'Make Admin'}
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ background: '#f44336', color: 'white' }}
                      onClick={() => handleDeleteUser(u.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Create New User</h3>
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter password (min 6 characters)"
                  required
                />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Reset Password for {selectedUser?.username}</h3>
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
