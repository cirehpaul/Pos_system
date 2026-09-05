import { create } from 'zustand';
import db from '../db/database';

const useCartStore = create((set, get) => ({
  items: [],
  
  addItem: (product) => {
    const items = get().items;
    const existingIndex = items.findIndex(item => item.productId === product.id);
    
    if (existingIndex >= 0) {
      const newItems = [...items];
      const newQty = newItems[existingIndex].quantity + 1;
      if (newQty > product.stock) return { success: false, message: 'Not enough stock' };
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: newQty,
        subtotal: newQty * product.price
      };
      set({ items: newItems });
    } else {
      if (product.stock < 1) return { success: false, message: 'Out of stock' };
      set({
        items: [...items, {
          productId: product.id,
          name: product.name,
          price: product.price,
          cost: product.cost || 0,  // Snapshot cost for COGS calculation
          image: product.image,
          quantity: 1,
          subtotal: product.price,
          maxStock: product.stock
        }]
      });
    }
    return { success: true };
  },

  updateQuantity: (productId, quantity) => {
    if (quantity < 1) {
      get().removeItem(productId);
      return;
    }
    const items = get().items;
    const item = items.find(i => i.productId === productId);
    if (item && quantity > item.maxStock) return;
    
    set({
      items: items.map(item =>
        item.productId === productId
          ? { ...item, quantity, subtotal: quantity * item.price }
          : item
      )
    });
  },

  removeItem: (productId) => {
    set({ items: get().items.filter(item => item.productId !== productId) });
  },

  clearCart: () => {
    set({ items: [] });
  },

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.subtotal, 0);
  },

  getTax: async () => {
    const taxEnabled = await db.settings.where('key').equals('taxEnabled').first();
    const taxRate = await db.settings.where('key').equals('taxRate').first();
    if (taxEnabled?.value) {
      return get().getSubtotal() * (taxRate?.value || 12) / 100;
    }
    return 0;
  },

  getTotal: () => {
    return get().getSubtotal();
  },

  getItemCount: () => {
    return get().items.reduce((count, item) => count + item.quantity, 0);
  }
}));

export default useCartStore;
