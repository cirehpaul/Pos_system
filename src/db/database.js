import Dexie from 'dexie';

export const db = new Dexie('POSDatabase');

db.version(1).stores({
  users: 'id, name, pin, role, createdAt',
  categories: 'id, name, sortOrder, createdAt',
  products: 'id, name, categoryId, price, stock, status, createdAt, updatedAt',
  orders: 'id, orderNumber, paymentMethod, status, createdAt',
  settings: 'id, key'
});

let isInitializing = false;

// Initialize default data on first run
export async function initializeDatabase() {
  if (isInitializing) return;
  isInitializing = true;
  
  try {
    const settingsCount = await db.settings.count();
    if (settingsCount === 0) {
      await seedDatabase();
    } else {
      // Cleanup existing duplicates (if any were created before this fix)
      const allCategories = await db.categories.toArray();
      const seenNames = new Set();
      for (const cat of allCategories) {
        if (seenNames.has(cat.name)) {
          await db.categories.delete(cat.id);
        } else {
          seenNames.add(cat.name);
        }
      }
    }
  } finally {
    isInitializing = false;
  }
}

async function seedDatabase() {
  // Default settings
  await db.settings.bulkAdd([
    { id: crypto.randomUUID(), key: 'storeName', value: 'My Food Shop' },
    { id: crypto.randomUUID(), key: 'storeAddress', value: '123 Main Street, City' },
    { id: crypto.randomUUID(), key: 'storeLogo', value: '' },
    { id: crypto.randomUUID(), key: 'receiptFooter', value: 'Thank you for your purchase!' },
    { id: crypto.randomUUID(), key: 'taxEnabled', value: false },
    { id: crypto.randomUUID(), key: 'taxRate', value: 12 },
    { id: crypto.randomUUID(), key: 'lowStockThreshold', value: 10 },
    { id: crypto.randomUUID(), key: 'printerPaperWidth', value: 58 },
    { id: crypto.randomUUID(), key: 'darkMode', value: false },
    { id: crypto.randomUUID(), key: 'currency', value: '₱' },
  ]);

  // Default admin user
  await db.users.add({
    id: crypto.randomUUID(),
    name: 'Owner',
    pin: '1234',
    role: 'owner',
    createdAt: new Date().toISOString()
  });

  // Default cashier
  await db.users.add({
    id: crypto.randomUUID(),
    name: 'Cashier',
    pin: '0000',
    role: 'cashier',
    createdAt: new Date().toISOString()
  });

  // Default categories
  await db.categories.bulkAdd([
    {
      id: crypto.randomUUID(),
      name: 'Foods',
      icon: 'utensils',
      color: '#ef4444',
      sortOrder: 0,
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      name: 'Drinks',
      icon: 'cup-soda',
      color: '#3b82f6',
      sortOrder: 1,
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      name: 'Snacks',
      icon: 'cookie',
      color: '#f59e0b',
      sortOrder: 2,
      createdAt: new Date().toISOString()
    }
  ]);
}

export default db;
