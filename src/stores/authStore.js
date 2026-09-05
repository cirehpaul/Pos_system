import { create } from 'zustand';
import db from '../db/database';

const useAuthStore = create((set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  currentSessionId: null,
  users: [],

  login: async (pin) => {
    const user = await db.users.where('pin').equals(pin).first();
    if (!user) {
      return { success: false, message: 'Invalid PIN' };
    }
    if (user.status === 'disabled') {
      return { success: false, message: 'Account is disabled. Contact your admin.' };
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
    const existing = await db.users.where('pin').equals(userData.pin).first();
    if (existing) {
      return { success: false, message: 'PIN already in use' };
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
    if (userData.pin) {
      const existing = await db.users.where('pin').equals(userData.pin).first();
      if (existing && existing.id !== id) {
        return { success: false, message: 'PIN already in use' };
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
