import { create } from 'zustand';
import db from '../db/database';

const useAuthStore = create((set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  users: [],

  login: async (pin) => {
    const user = await db.users.where('pin').equals(pin).first();
    if (user) {
      set({ currentUser: user, isAuthenticated: true });
      return { success: true, user };
    }
    return { success: false, message: 'Invalid PIN' };
  },

  logout: () => {
    set({ currentUser: null, isAuthenticated: false });
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

  isOwner: () => {
    return get().currentUser?.role === 'owner';
  }
}));

export default useAuthStore;
