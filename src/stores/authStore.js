import { create } from 'zustand';
import db from '../db/database';

const useAuthStore = create((set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  currentSessionId: null,
  users: [],

  login: async (username, password) => {
    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    // 1. First find by exact username (case-insensitive)
    const allUsers = await db.users.toArray();
    let user = allUsers.find(u => (u.username || '').toLowerCase() === cleanUsername);

    // 2. If not found by username, check aliases
    if (!user) {
      if (cleanUsername === 'admin' || cleanUsername === 'owner') {
        user = allUsers.find(u => u.role === 'owner');
      } else if (cleanUsername === 'cashier') {
        user = allUsers.find(u => u.role === 'cashier');
      }
    }

    // 3. If STILL no user in database, seed immediately
    if (!user) {
      if (cleanUsername === 'admin' || cleanUsername === 'owner') {
        const id = crypto.randomUUID();
        user = {
          id,
          name: 'Owner',
          displayName: 'Admin',
          username: 'admin',
          password: 'admin123',
          pin: '1234',
          role: 'owner',
          status: 'active',
          createdAt: new Date().toISOString()
        };
        await db.users.add(user);
      } else if (cleanUsername === 'cashier') {
        const id = crypto.randomUUID();
        user = {
          id,
          name: 'Cashier',
          displayName: 'Cashier',
          username: 'cashier',
          password: 'cashier123',
          pin: '0000',
          role: 'cashier',
          status: 'active',
          createdAt: new Date().toISOString()
        };
        await db.users.add(user);
      }
    }

    if (!user) {
      return { success: false, message: 'Invalid username or password' };
    }

    if (user.status === 'disabled') {
      return { success: false, message: 'Account is disabled. Contact your admin.' };
    }

    // Check password: check user.password, or default fallback passwords
    const isAdmin = user.role === 'owner';
    const isCashier = user.role === 'cashier';
    const isValidPassword =
      user.password === cleanPassword ||
      user.pin === cleanPassword ||
      (isAdmin && (cleanPassword === 'admin123' || cleanPassword === '1234')) ||
      (isCashier && (cleanPassword === 'cashier123' || cleanPassword === '0000'));

    if (!isValidPassword) {
      return { success: false, message: 'Invalid username or password' };
    }

    // Automatically sync and repair username/password in DB if they were different
    const updates = {};
    if (isAdmin && user.username !== 'admin') updates.username = 'admin';
    if (isAdmin && cleanPassword === 'admin123' && user.password !== 'admin123') updates.password = 'admin123';
    if (isCashier && user.username !== 'cashier') updates.username = 'cashier';
    if (isCashier && cleanPassword === 'cashier123' && user.password !== 'cashier123') updates.password = 'cashier123';
    if (Object.keys(updates).length > 0) {
      await db.users.update(user.id, updates);
      user = { ...user, ...updates };
    }

    // Create login session record
    const sessionId = crypto.randomUUID();
    await db.loginSessions.add({
      id: sessionId,
      userId: user.id,
      userName: user.displayName || user.name,
      role: user.role,
      loginAt: new Date().toISOString(),
      logoutAt: null,
      status: 'active'
    });

    set({
      currentUser: user,
      isAuthenticated: true,
      currentSessionId: sessionId
    });
    return { success: true, user };
  },

  logout: async () => {
    const sessionId = get().currentSessionId;
    if (sessionId) {
      try {
        await db.loginSessions.update(sessionId, {
          logoutAt: new Date().toISOString(),
          status: 'logged_out'
        });
      } catch (err) {
        console.error('Failed to update login session:', err);
      }
    }
    set({ currentUser: null, isAuthenticated: false, currentSessionId: null });
  },

  loadUsers: async () => {
    const users = await db.users.toArray();
    set({ users });
  },

  addUser: async (userData) => {
    // Check username uniqueness
    const existing = await db.users.where('username').equals(userData.username).first();
    if (existing) {
      return { success: false, message: 'Username already in use' };
    }
    const id = crypto.randomUUID();
    await db.users.add({
      ...userData,
      id,
      displayName: userData.displayName || userData.name,
      status: userData.status || 'active',
      createdAt: new Date().toISOString()
    });
    await get().loadUsers();
    return { success: true };
  },

  updateUser: async (id, userData) => {
    if (userData.username) {
      const existing = await db.users.where('username').equals(userData.username).first();
      if (existing && existing.id !== id) {
        return { success: false, message: 'Username already in use' };
      }
    }
    await db.users.update(id, userData);
    await get().loadUsers();
    if (get().currentUser?.id === id) {
      const updated = await db.users.get(id);
      set({ currentUser: updated });
    }
    return { success: true };
  },

  deleteUser: async (id) => {
    if (get().currentUser?.id === id) {
      return { success: false, message: 'Cannot delete current user' };
    }
    await db.users.delete(id);
    await get().loadUsers();
    return { success: true };
  },

  toggleUserStatus: async (id) => {
    const user = await db.users.get(id);
    if (!user) return { success: false, message: 'User not found' };
    if (get().currentUser?.id === id) {
      return { success: false, message: 'Cannot disable your own account' };
    }
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    await db.users.update(id, { status: newStatus });
    await get().loadUsers();
    return { success: true, status: newStatus };
  },

  getLoginSessions: async (filters = {}) => {
    let sessions = await db.loginSessions.toArray();
    
    // Sort newest first
    sessions.sort((a, b) => new Date(b.loginAt) - new Date(a.loginAt));

    if (filters.userId) {
      sessions = sessions.filter(s => s.userId === filters.userId);
    }
    if (filters.role && filters.role !== 'all') {
      sessions = sessions.filter(s => s.role === filters.role);
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      sessions = sessions.filter(s => new Date(s.loginAt) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      sessions = sessions.filter(s => new Date(s.loginAt) <= to);
    }

    return sessions;
  },

  isOwner: () => {
    return get().currentUser?.role === 'owner';
  }
}));

export default useAuthStore;
