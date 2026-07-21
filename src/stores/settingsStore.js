import { create } from 'zustand';
import db from '../db/database';

const useSettingsStore = create((set, get) => ({
  settings: {},
  loaded: false,

  loadSettings: async () => {
    const allSettings = await db.settings.toArray();
    const settingsMap = {};
    allSettings.forEach(s => {
      settingsMap[s.key] = s.value;
    });
    set({ settings: settingsMap, loaded: true });
  },

  getSetting: (key) => {
    return get().settings[key];
  },

  updateSetting: async (key, value) => {
    const existing = await db.settings.where('key').equals(key).first();
    if (existing) {
      await db.settings.update(existing.id, { value });
    } else {
      await db.settings.add({
        id: crypto.randomUUID(),
        key,
        value
      });
    }
    set({
      settings: { ...get().settings, [key]: value }
    });
  },

  updateMultipleSettings: async (settingsObj) => {
    for (const [key, value] of Object.entries(settingsObj)) {
      await get().updateSetting(key, value);
    }
  }
}));

export default useSettingsStore;
