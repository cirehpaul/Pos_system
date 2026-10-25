import { useState, useEffect, useCallback } from 'react';
import {
  Users, Clock, Edit3, Trash2,
  Shield, ShieldOff, Eye, EyeOff, Save,
  UserPlus, Filter, ChevronLeft, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { format, formatDistanceStrict } from 'date-fns';
import db from '../../db/database';
import useAuthStore from '../../stores/authStore';
import { useToast } from '../../components/Toast/Toast';
import Modal from '../../components/Modal/Modal';
import './SettingsScreen.css';

export default function SettingsScreen({ defaultTab = 'accounts' }) {
  const toast = useToast();
  const { currentUser, loadUsers, users, addUser, updateUser, deleteUser, toggleUserStatus, getLoginSessions } = useAuthStore();
  
  const activeTab = defaultTab;
  
  // Account Management
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '', displayName: '', username: '', password: '', role: 'cashier', status: 'active'
  });

  // Login History
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionFilter, setSessionFilter] = useState({ role: 'all', dateFrom: '', dateTo: '' });
  const [sessionPage, setSessionPage] = useState(1);
  const sessionsPerPage = 15;

  // Store Settings
  const [storeSettings, setStoreSettings] = useState({});
  const [settingsLoading, setSettingsLoading] = useState(true);

  const loadStoreSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const all = await db.settings.toArray();
      const map = {};
      all.forEach(s => { map[s.key] = s; });
      setStoreSettings(map);
    } catch (err) {
      console.error(err);
    }
    setSettingsLoading(false);
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const data = await getLoginSessions(sessionFilter);
      setSessions(data);
      setSessionPage(1);
    } catch (err) {
      console.error(err);
    }
    setSessionsLoading(false);
  }, [sessionFilter, getLoginSessions]);

  useEffect(() => {
    loadUsers();
    loadStoreSettings();
  }, [loadUsers, loadStoreSettings]);

  useEffect(() => {
    if (activeTab === 'loginHistory') {
      loadSessions();
    }
  }, [activeTab, loadSessions]);

  const saveStoreSetting = async (key, value) => {
    const existing = storeSettings[key];
    if (existing) {
      await db.settings.update(existing.id, { value });
    } else {
      await db.settings.add({ id: crypto.randomUUID(), key, value });
    }
    await loadStoreSettings();
    toast.success('Setting saved');
  };

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm({ name: '', displayName: '', username: '', password: '', role: 'cashier', status: 'active' });
    setShowPassword(false);
    setShowUserModal(true);
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      displayName: user.displayName || user.name,
      username: user.username || '',
      password: '', // Don't show the existing password
      role: user.role,
      status: user.status || 'active'
    });
    setShowPassword(false);
    setShowUserModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userForm.name.trim()) { toast.error('Name is required'); return; }
    if (!userForm.username.trim()) { toast.error('Username is required'); return; }
    if (!editingUser && !userForm.password) { toast.error('Password is required'); return; }
    if (userForm.password && userForm.password.length < 4) { toast.error('Password must be at least 4 characters'); return; }

    let result;
    if (editingUser) {
      const updateData = {
        name: userForm.name.trim(),
        displayName: userForm.displayName.trim() || userForm.name.trim(),
        username: userForm.username.trim(),
        role: userForm.role,
        status: userForm.status
      };
      // Only update password if a new one is provided
      if (userForm.password) {
        updateData.password = userForm.password;
      }
      result = await updateUser(editingUser.id, updateData);
    } else {
      result = await addUser({
        name: userForm.name.trim(),
        displayName: userForm.displayName.trim() || userForm.name.trim(),
        username: userForm.username.trim(),
        password: userForm.password,
        role: userForm.role,
        status: userForm.status
      });
    }

    if (result.success) {
      toast.success(editingUser ? 'User updated' : 'User created');
      setShowUserModal(false);
    } else {
      toast.error(result.message);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Are you sure you want to delete "${user.displayName || user.name}"?`)) return;
    const result = await deleteUser(user.id);
    if (result.success) {
      toast.success('User deleted');
    } else {
      toast.error(result.message);
    }
  };

  const handleToggleStatus = async (user) => {
    const result = await toggleUserStatus(user.id);
    if (result.success) {
      toast.success(`Account ${result.status === 'active' ? 'enabled' : 'disabled'}`);
    } else {
      toast.error(result.message);
    }
  };

  const formatDuration = (loginAt, logoutAt) => {
    if (!logoutAt) return '—';
    try {
      return formatDistanceStrict(new Date(logoutAt), new Date(loginAt));
    } catch {
      return '—';
    }
  };

  // Pagination for sessions
  const totalSessionPages = Math.ceil(sessions.length / sessionsPerPage);
  const paginatedSessions = sessions.slice((sessionPage - 1) * sessionsPerPage, sessionPage * sessionsPerPage);

  // Page title and subtitle per tab
  const pageInfo = {
    accounts: { title: 'User Management', subtitle: 'Create, edit, and manage cashier & owner accounts' },
    loginHistory: { title: 'Login History', subtitle: 'Track login and logout activity for all users' },
    store: { title: 'Store Settings', subtitle: 'Configure your store name, address, receipt, and tax settings' },
  };

  const { title, subtitle } = pageInfo[activeTab] || pageInfo.accounts;

  return (
    <div className="settings-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {activeTab === 'accounts' && (
          <button className="btn btn--primary" onClick={openCreateUser}>
            <UserPlus size={16} /> New Account
          </button>
        )}
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* Account Management Tab */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'accounts' && (
        <div className="settings-section animate-fade-in">

          <div className="users-grid">
            {users.length === 0 ? (
              <div className="empty-state">
                <Users size={48} />
                <h3>No users yet</h3>
                <p>Create your first user account</p>
              </div>
            ) : (
              users.map(user => (
                <div key={user.id} className={`user-card ${user.status === 'disabled' ? 'user-card--disabled' : ''}`}>
                  <div className="user-card__header">
                    <div className="user-card__avatar" style={{
                      background: user.role === 'owner' ? 'var(--color-primary-50)' : 'var(--color-info-bg)',
                      color: user.role === 'owner' ? 'var(--color-primary)' : 'var(--color-info-dark)'
                    }}>
                      {(user.displayName || user.name).charAt(0).toUpperCase()}
                    </div>
                    <div className="user-card__info">
                      <span className="user-card__display-name">{user.displayName || user.name}</span>
                      <span className="user-card__username">@{user.username || user.name}</span>
                    </div>
                    <div className="user-card__badges">
                      <span className={`role-badge role-badge--${user.role}`}>
                        {user.role === 'owner' ? 'Owner' : 'Cashier'}
                      </span>
                      <span className={`status-badge status-badge--${user.status === 'active' ? 'success' : 'danger'}`}>
                        {user.status === 'active' ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                  <div className="user-card__meta">
                    <span>Username: <strong>{user.username || '—'}</strong></span>
                    <span>Created: {format(new Date(user.createdAt), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="user-card__actions">
                    <button className="btn btn--ghost btn--small" onClick={() => openEditUser(user)}>
                      <Edit3 size={14} /> Edit
                    </button>
                    {user.id !== currentUser?.id && (
                      <>
                        <button className="btn btn--ghost btn--small" onClick={() => handleToggleStatus(user)}>
                          {user.status === 'active' ? <ShieldOff size={14} /> : <Shield size={14} />}
                          {user.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                        <button className="btn btn--ghost btn--small btn--danger-text" onClick={() => handleDeleteUser(user)}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* Login History Tab */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'loginHistory' && (
        <div className="settings-section animate-fade-in">

          {/* Filters */}
          <div className="reports-filters" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="filter-select">
              <Filter size={16} className="filter-select__icon" />
              <select value={sessionFilter.role} onChange={e => setSessionFilter(prev => ({ ...prev, role: e.target.value }))}>
                <option value="all">All Roles</option>
                <option value="owner">Owner</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>
            <div className="date-custom">
              <input type="date" className="date-input" value={sessionFilter.dateFrom}
                onChange={e => setSessionFilter(prev => ({ ...prev, dateFrom: e.target.value }))} />
              <span className="date-separator">to</span>
              <input type="date" className="date-input" value={sessionFilter.dateTo}
                onChange={e => setSessionFilter(prev => ({ ...prev, dateTo: e.target.value }))} />
            </div>
          </div>

          {sessionsLoading ? (
            <div className="empty-state"><p>Loading sessions...</p></div>
          ) : sessions.length === 0 ? (
            <div className="empty-state">
              <Clock size={48} />
              <h3>No login sessions recorded</h3>
              <p>Sessions will appear here after users log in.</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Login</th>
                      <th>Logout</th>
                      <th>Duration</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSessions.map(session => (
                      <tr key={session.id}>
                        <td className="font-semibold">{session.userName}</td>
                        <td>
                          <span className={`role-badge role-badge--${session.role}`}>
                            {session.role === 'owner' ? 'Owner' : 'Cashier'}
                          </span>
                        </td>
                        <td>
                          <div className="date-cell">
                            <span>{format(new Date(session.loginAt), 'MMM dd, yyyy')}</span>
                            <span className="text-sm text-tertiary">{format(new Date(session.loginAt), 'hh:mm a')}</span>
                          </div>
                        </td>
                        <td>
                          {session.logoutAt ? (
                            <div className="date-cell">
                              <span>{format(new Date(session.logoutAt), 'MMM dd, yyyy')}</span>
                              <span className="text-sm text-tertiary">{format(new Date(session.logoutAt), 'hh:mm a')}</span>
                            </div>
                          ) : (
                            <span className="text-tertiary">—</span>
                          )}
                        </td>
                        <td>{formatDuration(session.loginAt, session.logoutAt)}</td>
                        <td>
                          <span className={`status-badge status-badge--${session.status === 'active' ? 'success' : 'warning'}`}>
                            {session.status === 'active' ? 'Logged In' : 'Logged Out'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalSessionPages > 1 && (
                <div className="pagination">
                  <span className="pagination__info">
                    Showing {(sessionPage - 1) * sessionsPerPage + 1}–{Math.min(sessionPage * sessionsPerPage, sessions.length)} of {sessions.length}
                  </span>
                  <div className="pagination__controls">
                    <button className="pagination__btn" disabled={sessionPage <= 1}
                      onClick={() => setSessionPage(p => p - 1)}>
                      <ChevronLeft size={16} /> Prev
                    </button>
                    <span className="pagination__page">Page {sessionPage} of {totalSessionPages}</span>
                    <button className="pagination__btn" disabled={sessionPage >= totalSessionPages}
                      onClick={() => setSessionPage(p => p + 1)}>
                      Next <ChevronRightIcon size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* Store Settings Tab */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'store' && (
        <div className="settings-section animate-fade-in">

          {settingsLoading ? (
            <div className="empty-state"><p>Loading settings...</p></div>
          ) : (
            <div className="settings-form-grid">
              <div className="settings-card">
                <h3>Store Information</h3>
                <div className="form-group">
                  <label>Store Name</label>
                  <input type="text" defaultValue={storeSettings.storeName?.value || ''}
                    onBlur={e => saveStoreSetting('storeName', e.target.value)}
                    placeholder="My Food Shop" />
                </div>
                <div className="form-group">
                  <label>Store Address</label>
                  <input type="text" defaultValue={storeSettings.storeAddress?.value || ''}
                    onBlur={e => saveStoreSetting('storeAddress', e.target.value)}
                    placeholder="123 Main Street, City" />
                </div>
                <div className="form-group">
                  <label>Receipt Footer Message</label>
                  <input type="text" defaultValue={storeSettings.receiptFooter?.value || ''}
                    onBlur={e => saveStoreSetting('receiptFooter', e.target.value)}
                    placeholder="Thank you for your purchase!" />
                </div>
              </div>

              <div className="settings-card">
                <h3>Tax & Inventory</h3>
                <div className="form-group form-group--row">
                  <label>Enable Tax</label>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={storeSettings.taxEnabled?.value || false}
                      onChange={e => saveStoreSetting('taxEnabled', e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div className="form-group">
                  <label>Tax Rate (%)</label>
                  <input type="number" min="0" max="100" step="0.5"
                    defaultValue={storeSettings.taxRate?.value || 12}
                    onBlur={e => saveStoreSetting('taxRate', parseFloat(e.target.value))} />
                </div>
                <div className="form-group">
                  <label>Low Stock Threshold</label>
                  <input type="number" min="1"
                    defaultValue={storeSettings.lowStockThreshold?.value || 10}
                    onBlur={e => saveStoreSetting('lowStockThreshold', parseInt(e.target.value, 10))} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Create/Edit Modal */}
      <Modal isOpen={showUserModal} onClose={() => setShowUserModal(false)}
        title={editingUser ? 'Edit Account' : 'Create New Account'} size="sm">
        <form onSubmit={handleSaveUser} className="category-form">
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" required value={userForm.name}
              onChange={e => setUserForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Juan Dela Cruz" />
          </div>
          <div className="form-group">
            <label>Display Name</label>
            <input type="text" value={userForm.displayName}
              onChange={e => setUserForm(prev => ({ ...prev, displayName: e.target.value }))}
              placeholder="e.g. Juan - Cashier" />
            <small className="form-hint">This name will be shown in the interface and reports</small>
          </div>
          <div className="form-group">
            <label>Username</label>
            <input type="text" required value={userForm.username}
              onChange={e => setUserForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
              placeholder="e.g. juan01" />
            <small className="form-hint">Used for login — no spaces, lowercase</small>
          </div>
          <div className="form-group">
            <label>{editingUser ? 'New Password (leave blank to keep current)' : 'Password'}</label>
            <div className="pin-input-wrapper">
              <input type={showPassword ? 'text' : 'password'}
                required={!editingUser}
                minLength="4"
                value={userForm.password}
                onChange={e => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder={editingUser ? 'Leave blank to keep current' : 'Min. 4 characters'} />
              <button type="button" className="pin-toggle" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={userForm.role}
              onChange={e => setUserForm(prev => ({ ...prev, role: e.target.value }))}
              disabled={editingUser?.id === currentUser?.id}>
              <option value="cashier">Cashier</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={userForm.status}
              onChange={e => setUserForm(prev => ({ ...prev, status: e.target.value }))}
              disabled={editingUser?.id === currentUser?.id}>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setShowUserModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary">
              <Save size={16} /> {editingUser ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
