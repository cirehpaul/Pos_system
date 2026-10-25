import Dexie from 'dexie';

export const db = new Dexie('POSDatabase');

// Version 1 - Original schema
db.version(1).stores({
  users: 'id, name, pin, role, createdAt',
  categories: 'id, name, sortOrder, createdAt',
  products: 'id, name, categoryId, price, stock, status, createdAt, updatedAt',
  orders: 'id, orderNumber, paymentMethod, status, createdAt',
  settings: 'id, key'
});

// Version 2 - Add inventoryTransactions, expenses, and enhanced indexes
db.version(2).stores({
  users: 'id, name, pin, role, createdAt',
  categories: 'id, name, sortOrder, createdAt',
  products: 'id, name, categoryId, price, cost, stock, sku, minStock, status, createdAt, updatedAt',
  orders: 'id, orderNumber, paymentMethod, cashierName, status, createdAt',
  settings: 'id, key',
  inventoryTransactions: 'id, productId, type, reference, createdAt',
  expenses: 'id, category, date, createdAt'
}).upgrade(tx => {
  return tx.table('products').toCollection().modify(product => {
    if (product.cost === undefined || product.cost === null) {
      product.cost = 0;
    }
    if (!product.sku) {
      product.sku = '';
    }
    if (product.minStock === undefined || product.minStock === null) {
      product.minStock = 10;
    }
  });
});

// Version 3 - Add loginSessions table and user displayName/status
db.version(3).stores({
  users: 'id, name, pin, role, status, createdAt',
  categories: 'id, name, sortOrder, createdAt',
  products: 'id, name, categoryId, price, cost, stock, sku, minStock, status, createdAt, updatedAt',
  orders: 'id, orderNumber, paymentMethod, cashierId, cashierName, status, createdAt',
  settings: 'id, key',
  inventoryTransactions: 'id, productId, type, reference, createdAt',
  expenses: 'id, category, date, createdAt',
  loginSessions: 'id, userId, userName, role, loginAt, logoutAt, status'
}).upgrade(tx => {
  // Ensure existing users have displayName and status fields
  return tx.table('users').toCollection().modify(user => {
    if (!user.displayName) {
      user.displayName = user.name;
    }
    if (!user.status) {
      user.status = 'active';
    }
  });
});

// Version 4 - Add username/password auth, transactions table, and clients table
db.version(4).stores({
  users: 'id, name, username, role, status, createdAt',
  categories: 'id, name, sortOrder, createdAt',
  products: 'id, name, categoryId, price, cost, stock, sku, minStock, status, createdAt, updatedAt',
  orders: 'id, orderNumber, paymentMethod, cashierId, cashierName, status, createdAt',
  settings: 'id, key',
  inventoryTransactions: 'id, productId, type, reference, createdAt',
  expenses: 'id, category, date, createdAt',
  loginSessions: 'id, userId, userName, role, loginAt, logoutAt, status',
  transactions: 'id, referenceNumber, type, clientId, clientName, cashierId, status, createdAt',
  clients: 'id, name, email, contact, createdAt'
}).upgrade(tx => {
  // Migrate existing users: add username/password fields
  return tx.table('users').toCollection().modify(user => {
    if (!user.username) {
      // Generate username from name (lowercase, no spaces)
      user.username = (user.name || 'user').toLowerCase().replace(/\s+/g, '');
    }
    if (!user.password) {
      // Default password = same as pin, or 'changeme'
      user.password = user.pin || 'changeme';
    }
  });
});

// Version 5 - Add cashAudits table for money checking / cash drawer auditing
db.version(5).stores({
  users: 'id, name, username, role, status, createdAt',
  categories: 'id, name, sortOrder, createdAt',
  products: 'id, name, categoryId, price, cost, stock, sku, minStock, status, createdAt, updatedAt',
  orders: 'id, orderNumber, paymentMethod, cashierId, cashierName, status, createdAt',
  settings: 'id, key',
  inventoryTransactions: 'id, productId, type, reference, createdAt',
  expenses: 'id, category, date, createdAt',
  loginSessions: 'id, userId, userName, role, loginAt, logoutAt, status',
  transactions: 'id, referenceNumber, type, clientId, clientName, cashierId, status, createdAt',
  clients: 'id, name, email, contact, createdAt',
  cashAudits: 'id, cashierId, cashierName, countedAmount, expectedAmount, variance, status, createdAt'
});

// Version 6 - Add reservations table for event table & booth booking with billing
db.version(6).stores({
  users: 'id, name, username, role, status, createdAt',
  categories: 'id, name, sortOrder, createdAt',
  products: 'id, name, categoryId, price, cost, stock, sku, minStock, status, createdAt, updatedAt',
  orders: 'id, orderNumber, paymentMethod, cashierId, cashierName, status, createdAt',
  settings: 'id, key',
  inventoryTransactions: 'id, productId, type, reference, createdAt',
  expenses: 'id, category, date, createdAt',
  loginSessions: 'id, userId, userName, role, loginAt, logoutAt, status',
  transactions: 'id, referenceNumber, type, clientId, clientName, cashierId, status, createdAt',
  clients: 'id, name, email, contact, createdAt',
  cashAudits: 'id, cashierId, cashierName, countedAmount, expectedAmount, variance, status, createdAt',
  reservations: 'id, reservationNumber, locationId, locationType, locationName, clientName, clientContact, status, paymentStatus, paymentCategory, cashierId, createdAt'
}).upgrade(() => {
  // No data migration needed — just adding the reservations table
  return Promise.resolve();
});

// ── Financial Precision Helpers ──

/**
 * Round to 2 decimal places to avoid floating-point drift.
 * Uses Math.round to avoid banker's rounding issues.
 */
export function roundCurrency(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Format as Philippine Peso: ₱1,234.56
 */
export function formatCurrency(num) {
  const rounded = roundCurrency(num || 0);
  return '₱' + rounded.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format number with commas: 1,234
 */
export function formatNumber(num) {
  return (num || 0).toLocaleString('en-PH');
}

/**
 * Generate a unique reference number: REF-YYYYMMDD-XXXXX
 */
export function generateReferenceNumber() {
  const now = new Date();
  const datePart = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `REF-${datePart}-${randomPart}`;
}

export function generateOrderNumber() {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${datePart}-${randomPart}`;
}

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

      // Ensure admin user exists and has valid username/password
      const allUsers = await db.users.toArray();
      let owner = allUsers.find(u => u.role === 'owner' || u.username === 'admin');
      if (owner) {
        await db.users.update(owner.id, {
          username: 'admin',
          password: owner.password && owner.password !== '1234' && owner.password !== 'changeme' ? owner.password : 'admin123',
          displayName: owner.displayName || 'Admin',
          status: 'active'
        });
      } else {
        await db.users.add({
          id: crypto.randomUUID(),
          name: 'Admin',
          displayName: 'Admin',
          username: 'admin',
          password: 'admin123',
          pin: '1234',
          role: 'owner',
          status: 'active',
          createdAt: new Date().toISOString()
        });
      }

      // Ensure cashier user exists and has valid username/password
      let cashier = allUsers.find(u => u.role === 'cashier' || u.username === 'cashier');
      if (cashier) {
        await db.users.update(cashier.id, {
          username: 'cashier',
          password: cashier.password && cashier.password !== '0000' && cashier.password !== 'changeme' ? cashier.password : 'cashier123',
          displayName: cashier.displayName || 'Cashier',
          status: 'active'
        });
      } else {
        await db.users.add({
          id: crypto.randomUUID(),
          name: 'Cashier',
          displayName: 'Cashier',
          username: 'cashier',
          password: 'cashier123',
          pin: '0000',
          role: 'cashier',
          status: 'active',
          createdAt: new Date().toISOString()
        });
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

  // Default admin user (owner) with username/password
  await db.users.add({
    id: crypto.randomUUID(),
    name: 'Owner',
    displayName: 'Admin',
    username: 'admin',
    password: 'admin123',
    pin: '1234',
    role: 'owner',
    status: 'active',
    createdAt: new Date().toISOString()
  });

  // Default cashier with username/password
  await db.users.add({
    id: crypto.randomUUID(),
    name: 'Cashier',
    displayName: 'Cire - Cashier',
    username: 'cashier',
    password: 'cashier123',
    pin: '0000',
    role: 'cashier',
    status: 'active',
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
