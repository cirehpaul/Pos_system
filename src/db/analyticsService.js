import db, { roundCurrency } from './database';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subDays, subWeeks, subMonths,
  format, eachHourOfInterval, eachDayOfInterval,
  startOfYesterday, endOfYesterday
} from 'date-fns';

// ── Date Range Presets ──

export function getDateRange(preset, customStart, customEnd) {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday':
      return { start: startOfYesterday(), end: endOfYesterday() };
    case 'thisWeek':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) };
    case 'thisMonth':
      return { start: startOfMonth(now), end: endOfDay(now) };
    case 'lastMonth': {
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
    case 'custom':
      return {
        start: customStart ? startOfDay(new Date(customStart)) : startOfDay(now),
        end: customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now)
      };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

export function getPreviousPeriodRange(preset, customStart, customEnd) {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
    case 'yesterday':
      return { start: startOfDay(subDays(now, 2)), end: endOfDay(subDays(now, 2)) };
    case 'thisWeek':
      return {
        start: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
        end: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      };
    case 'thisMonth':
      return {
        start: startOfMonth(subMonths(now, 1)),
        end: endOfMonth(subMonths(now, 1))
      };
    case 'lastMonth': {
      const twoMonthsAgo = subMonths(now, 2);
      return { start: startOfMonth(twoMonthsAgo), end: endOfMonth(twoMonthsAgo) };
    }
    case 'custom': {
      const s = customStart ? new Date(customStart) : now;
      const e = customEnd ? new Date(customEnd) : now;
      const span = e.getTime() - s.getTime();
      return { start: new Date(s.getTime() - span), end: new Date(s.getTime() - 1) };
    }
    default:
      return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
  }
}

// ── Date Normalization Helpers ──

export function normalizeExpenseDate(exp) {
  if (exp.date && typeof exp.date === 'string' && exp.date.length === 10 && exp.date.includes('-')) {
    const [y, m, d] = exp.date.split('-').map(Number);
    // Use midday in local time to eliminate UTC offset day-shift bugs
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  return new Date(exp.createdAt || exp.date || new Date());
}

function filterOrdersByRange(orders, start, end) {
  return orders.filter(o => {
    if (!o.createdAt || o.status !== 'completed') return false;
    const d = new Date(o.createdAt);
    return d >= start && d <= end;
  });
}

function filterExpensesByRange(expenses, start, end) {
  return expenses.filter(e => {
    const d = normalizeExpenseDate(e);
    return d >= start && d <= end;
  });
}

// ── Financial Calculations ──

export function calculateFinancials(orders, products) {
  // Build product cost lookup for historical transactions that lack item-level snapshotted cost
  const productCostMap = {};
  products.forEach(p => {
    productCostMap[p.id] = p.cost || 0;
  });

  let grossSales = 0;
  let totalDiscount = 0;
  let cogs = 0;
  let totalOrders = orders.length;
  let totalItemsSold = 0;

  orders.forEach(order => {
    grossSales += order.total || 0;
    totalDiscount += order.discount || 0;

    (order.items || []).forEach(item => {
      const qty = item.quantity || 0;
      totalItemsSold += qty;
      // Strict COGS: Use snapshotted cost at sale time, fallback to catalog cost
      const itemCost = (item.cost !== undefined && item.cost !== null)
        ? item.cost
        : (productCostMap[item.productId] || 0);
      cogs += itemCost * qty;
    });
  });

  const netSales = roundCurrency(grossSales - totalDiscount);
  const roundedCogs = roundCurrency(cogs);
  const grossProfit = roundCurrency(netSales - roundedCogs);
  const grossMargin = netSales > 0 ? roundCurrency((grossProfit / netSales) * 100) : 0;
  const aov = totalOrders > 0 ? roundCurrency(netSales / totalOrders) : 0;

  return {
    grossSales: roundCurrency(grossSales),
    totalDiscount: roundCurrency(totalDiscount),
    netSales,
    cogs: roundedCogs,
    grossProfit,
    grossMargin,
    totalOrders,
    totalItemsSold,
    aov
  };
}

export function calcPercentageChange(current, previous) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return current > 0 ? 100 : -100;
  return roundCurrency(((current - previous) / Math.abs(previous)) * 100);
}

// ── Dashboard Analytics (single unified financial pipeline) ──

export async function getDashboardAnalytics(preset = 'today', customStart, customEnd) {
  const range = getDateRange(preset, customStart, customEnd);
  const prevRange = getPreviousPeriodRange(preset, customStart, customEnd);

  // Parallel load of tables
  const [allOrders, allProducts, allExpenses, allTransactions, lowStockThresholdSetting] = await Promise.all([
    db.orders.toArray(),
    db.products.filter(p => p.status !== 'deleted').toArray(),
    db.expenses.toArray(),
    db.transactions ? db.transactions.toArray() : Promise.resolve([]),
    db.settings.where('key').equals('lowStockThreshold').first()
  ]);

  const lowStockThreshold = lowStockThresholdSetting?.value || 10;

  // Filter orders for current and comparison periods
  const currentOrders = filterOrdersByRange(allOrders, range.start, range.end);
  const previousOrders = filterOrdersByRange(allOrders, prevRange.start, prevRange.end);

  // Filter transactions for current period (bills payments, cash-ins)
  const currentTransactions = (allTransactions || []).filter(t => {
    if (!t.createdAt || t.status === 'voided') return false;
    const d = new Date(t.createdAt);
    return d >= range.start && d <= range.end;
  });

  // Financial calculations
  const current = calculateFinancials(currentOrders, allProducts);
  const previous = calculateFinancials(previousOrders, allProducts);

  // Filter expenses strictly for selected range
  const currentExpenses = filterExpensesByRange(allExpenses, range.start, range.end);
  const totalExpenses = roundCurrency(
    currentExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  );

  const previousExpenses = filterExpensesByRange(allExpenses, prevRange.start, prevRange.end);
  const prevTotalExpenses = roundCurrency(
    previousExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  );

  // Strict Net Income: Gross Profit - Operating Expenses
  const netIncome = roundCurrency(current.grossProfit - totalExpenses);
  const prevNetIncome = roundCurrency(previous.grossProfit - prevTotalExpenses);
  const profitMargin = current.netSales > 0 ? roundCurrency((netIncome / current.netSales) * 100) : 0;
  const prevProfitMargin = previous.netSales > 0 ? roundCurrency((prevNetIncome / previous.netSales) * 100) : 0;

  // Low stock items
  const lowStockItems = allProducts
    .filter(p => p.stock <= (p.minStock ?? lowStockThreshold))
    .sort((a, b) => a.stock - b.stock);

  // 8 Core Daily KPI Cards with percentage change vs previous period
  const kpis = {
    totalSales: current.netSales,
    totalSalesChange: calcPercentageChange(current.netSales, previous.netSales),
    cogs: current.cogs,
    cogsChange: calcPercentageChange(current.cogs, previous.cogs),
    grossProfit: current.grossProfit,
    grossProfitChange: calcPercentageChange(current.grossProfit, previous.grossProfit),
    operatingExpenses: totalExpenses,
    operatingExpensesChange: calcPercentageChange(totalExpenses, prevTotalExpenses),
    netIncome,
    netIncomeChange: calcPercentageChange(netIncome, prevNetIncome),
    profitMargin,
    profitMarginChange: roundCurrency(profitMargin - prevProfitMargin),
    grossMargin: current.grossMargin,
    totalOrders: current.totalOrders,
    totalOrdersChange: calcPercentageChange(current.totalOrders, previous.totalOrders),
    totalItemsSold: current.totalItemsSold,
    totalItemsSoldChange: calcPercentageChange(current.totalItemsSold, previous.totalItemsSold),
    aov: current.aov,
    aovChange: calcPercentageChange(current.aov, previous.aov),
    lowStockCount: lowStockItems.length,
    grossSales: current.grossSales,
    totalDiscount: current.totalDiscount
  };

  // Daily Performance Comparison (Current Period vs Previous Period)
  const dailyPerformance = {
    current: {
      sales: current.netSales,
      cogs: current.cogs,
      grossProfit: current.grossProfit,
      expenses: totalExpenses,
      netIncome,
      margin: profitMargin
    },
    previous: {
      sales: previous.netSales,
      cogs: previous.cogs,
      grossProfit: previous.grossProfit,
      expenses: prevTotalExpenses,
      netIncome: prevNetIncome,
      margin: prevProfitMargin
    },
    growth: {
      sales: calcPercentageChange(current.netSales, previous.netSales),
      cogs: calcPercentageChange(current.cogs, previous.cogs),
      expenses: calcPercentageChange(totalExpenses, prevTotalExpenses),
      profit: calcPercentageChange(netIncome, prevNetIncome)
    }
  };

  // Profitability Scorecard
  const profitability = {
    revenue: current.netSales,
    cogs: current.cogs,
    cogsPct: current.netSales > 0 ? roundCurrency((current.cogs / current.netSales) * 100) : 0,
    grossProfit: current.grossProfit,
    grossMargin: current.grossMargin,
    operatingExpenses: totalExpenses,
    expensesPct: current.netSales > 0 ? roundCurrency((totalExpenses / current.netSales) * 100) : 0,
    netIncome,
    netMargin: profitMargin
  };

  // Dedicated Product-Level COGS Breakdown
  const cogsBreakdown = buildCogsBreakdown(currentOrders, allProducts);

  // Time-series Chart Data (Sales vs COGS vs Expenses vs Gross Profit vs Net Income)
  const chartData = buildTimeSeries(currentOrders, allProducts, currentExpenses, preset, range);

  // Top Products with full financial metrics
  const topProducts = buildTopProducts(currentOrders, allProducts);

  // Payment Method Distribution (3 categories: Cash / Bank Transfer / E-Wallet GCash & Maya)
  const paymentDistribution = buildPaymentDistribution(currentOrders, currentTransactions);

  // Cost lookup for enriching transactions
  const productCostMap = {};
  allProducts.forEach(p => { productCostMap[p.id] = p.cost || 0; });

  // Map transactions with items count, COGS, and gross profit
  const enrichOrder = order => {
    let orderCogs = 0;
    let itemsCount = 0;
    (order.items || []).forEach(item => {
      const qty = item.quantity || 0;
      itemsCount += qty;
      const itemCost = (item.cost !== undefined && item.cost !== null)
        ? item.cost : (productCostMap[item.productId] || 0);
      orderCogs += itemCost * qty;
    });
    const total = order.total || 0;
    const orderCogsRounded = roundCurrency(orderCogs);
    const grossProfit = roundCurrency(total - orderCogsRounded);
    return {
      ...order,
      itemsCount,
      cogs: orderCogsRounded,
      grossProfit
    };
  };

  const periodTransactions = currentOrders
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(enrichOrder);

  const completedOrders = allOrders
    .filter(o => o.status === 'completed')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const recentTransactions = completedOrders.slice(0, 10).map(enrichOrder);

  // Expense breakdown by category
  const categoriesList = ['Packaging', 'Transportation', 'Supplies', 'Utilities', 'Rent', 'Marketing', 'Maintenance', 'Operations', 'Other'];
  const catMap = {};
  categoriesList.forEach(c => { catMap[c] = { category: c, total: 0, count: 0, pct: 0 }; });

  currentExpenses.forEach(e => {
    const cat = e.category || 'Other';
    if (!catMap[cat]) catMap[cat] = { category: cat, total: 0, count: 0, pct: 0 };
    catMap[cat].total = roundCurrency(catMap[cat].total + (e.amount || 0));
    catMap[cat].count++;
  });

  const expensesByCategory = Object.values(catMap).map(c => ({
    ...c,
    pct: totalExpenses > 0 ? roundCurrency((c.total / totalExpenses) * 100) : 0
  })).sort((a, b) => b.total - a.total);

  return {
    kpis,
    dailyPerformance,
    profitability,
    cogsBreakdown,
    chartData,
    topProducts,
    lowStockItems,
    paymentDistribution,
    recentTransactions: periodTransactions.length > 0 ? periodTransactions : recentTransactions,
    isShowingAllRecent: periodTransactions.length === 0,
    expenses: currentExpenses.sort((a, b) => {
      const da = normalizeExpenseDate(a);
      const dbDate = normalizeExpenseDate(b);
      return dbDate - da;
    }),
    expensesByCategory,
    range
  };
}

// ── Dedicated COGS Breakdown Table ──

function buildCogsBreakdown(orders, products) {
  const productCostMap = {};
  const productPriceMap = {};
  const productSkuMap = {};
  products.forEach(p => {
    productCostMap[p.id] = p.cost || 0;
    productPriceMap[p.id] = p.price || 0;
    productSkuMap[p.id] = p.sku || '—';
  });

  const itemMap = {};
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      const key = item.productId || item.name;
      if (!itemMap[key]) {
        itemMap[key] = {
          productId: item.productId,
          name: item.name,
          sku: productSkuMap[item.productId] || '—',
          unitsSold: 0,
          unitCost: (item.cost !== undefined && item.cost !== null) ? item.cost : (productCostMap[item.productId] || 0),
          unitPrice: item.price || (productPriceMap[item.productId] || 0),
          totalRevenue: 0,
          totalCogs: 0,
          grossProfit: 0,
          marginPct: 0
        };
      }
      const qty = item.quantity || 0;
      const unitCost = (item.cost !== undefined && item.cost !== null) ? item.cost : (productCostMap[item.productId] || 0);
      const unitPrice = item.price || (productPriceMap[item.productId] || 0);
      const revenue = item.subtotal || (unitPrice * qty);
      const cogs = unitCost * qty;

      itemMap[key].unitsSold += qty;
      itemMap[key].totalRevenue += revenue;
      itemMap[key].totalCogs += cogs;
      itemMap[key].grossProfit += (revenue - cogs);
    });
  });

  return Object.values(itemMap).map(p => {
    const totalRev = roundCurrency(p.totalRevenue);
    const totalCost = roundCurrency(p.totalCogs);
    const profit = roundCurrency(p.grossProfit);
    const margin = totalRev > 0 ? roundCurrency((profit / totalRev) * 100) : 0;
    return {
      ...p,
      totalRevenue: totalRev,
      totalCogs: totalCost,
      grossProfit: profit,
      marginPct: margin
    };
  }).sort((a, b) => b.totalCogs - a.totalCogs);
}

// ── Time-Series Builder (Sales vs COGS vs Expenses vs Profit) ──

function buildTimeSeries(orders, products, expenses, preset, range) {
  let buckets = [];
  let labelFormat = 'HH:mm';

  if (preset === 'today' || preset === 'yesterday') {
    buckets = eachHourOfInterval({ start: range.start, end: range.end });
    labelFormat = 'ha';
  } else if (preset === 'thisWeek') {
    buckets = eachDayOfInterval({ start: range.start, end: range.end });
    labelFormat = 'EEE';
  } else if (preset === 'thisMonth' || preset === 'lastMonth') {
    buckets = eachDayOfInterval({ start: range.start, end: range.end });
    labelFormat = 'MMM d';
  } else {
    const spanDays = (range.end - range.start) / (1000 * 60 * 60 * 24);
    if (spanDays <= 1) {
      buckets = eachHourOfInterval({ start: range.start, end: range.end });
      labelFormat = 'ha';
    } else {
      buckets = eachDayOfInterval({ start: range.start, end: range.end });
      labelFormat = spanDays <= 7 ? 'EEE' : 'MMM d';
    }
  }

  const productCostMap = {};
  products.forEach(p => { productCostMap[p.id] = p.cost || 0; });

  const totalExpenseSum = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const expensePerBucket = buckets.length > 0 ? totalExpenseSum / buckets.length : 0;

  const series = buckets.map((bucketStart, idx) => {
    const bucketEnd = idx < buckets.length - 1 ? buckets[idx + 1] : range.end;

    const bucketOrders = orders.filter(o => {
      const d = new Date(o.createdAt);
      return d >= bucketStart && d < bucketEnd;
    });

    let sales = 0;
    let cogs = 0;
    let orderCount = bucketOrders.length;

    bucketOrders.forEach(order => {
      sales += order.total || 0;
      (order.items || []).forEach(item => {
        const itemCost = (item.cost !== undefined && item.cost !== null)
          ? item.cost : (productCostMap[item.productId] || 0);
        cogs += itemCost * (item.quantity || 0);
      });
    });

    // Bucket expenses: assign directly if timestamp falls in interval, otherwise allocate
    const exactExpenses = expenses.filter(e => {
      const d = new Date(e.createdAt || e.date);
      return d >= bucketStart && d < bucketEnd;
    }).reduce((sum, e) => sum + (e.amount || 0), 0);

    const bucketExpenses = exactExpenses > 0 ? exactExpenses : (preset === 'today' || preset === 'yesterday' ? 0 : roundCurrency(expensePerBucket));
    const grossProfit = roundCurrency(sales - cogs);
    const netIncome = roundCurrency(grossProfit - bucketExpenses);

    return {
      label: format(bucketStart, labelFormat),
      date: bucketStart.toISOString(),
      sales: roundCurrency(sales),
      cogs: roundCurrency(cogs),
      expenses: roundCurrency(bucketExpenses),
      grossProfit,
      netIncome,
      profit: grossProfit, // alias
      orders: orderCount
    };
  });

  return series;
}

// ── Top Products ──

function buildTopProducts(orders, products) {
  const productCostMap = {};
  products.forEach(p => { productCostMap[p.id] = p.cost || 0; });

  const itemMap = {};
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      const key = item.productId || item.name;
      if (!itemMap[key]) {
        itemMap[key] = {
          name: item.name,
          productId: item.productId,
          unitsSold: 0,
          totalSales: 0,
          totalCogs: 0,
          totalProfit: 0,
          marginPct: 0
        };
      }
      const qty = item.quantity || 0;
      const revenue = item.subtotal || (item.price * qty);
      const itemCost = (item.cost !== undefined && item.cost !== null)
        ? item.cost : (productCostMap[item.productId] || 0);
      const cogs = itemCost * qty;

      itemMap[key].unitsSold += qty;
      itemMap[key].totalSales += revenue;
      itemMap[key].totalCogs += cogs;
      itemMap[key].totalProfit += (revenue - cogs);
    });
  });

  return Object.values(itemMap).map(p => {
    const sales = roundCurrency(p.totalSales);
    const cogs = roundCurrency(p.totalCogs);
    const profit = roundCurrency(p.totalProfit);
    const margin = sales > 0 ? roundCurrency((profit / sales) * 100) : 0;
    return {
      ...p,
      totalSales: sales,
      totalCogs: cogs,
      totalProfit: profit,
      marginPct: margin
    };
  }).sort((a, b) => b.totalSales - a.totalSales);
}

// ── 3-Category Payment Distribution (Cash / Bank Transfer / E-Wallet GCash & Maya) ──

function normalizeCategory(method, provider) {
  const m = (method || '').toLowerCase();
  const p = (provider || '').toLowerCase();
  if (m === 'bank_transfer' || m === 'bank' || p.includes('bank') || p.includes('bdo') || p.includes('bpi')) {
    return 'bank_transfer';
  }
  if (m === 'ewallet' || m === 'gcash' || m === 'maya' || p === 'gcash' || p === 'maya') {
    return 'ewallet';
  }
  return 'cash';
}

function buildPaymentDistribution(orders = [], transactions = []) {
  const categories = {
    cash: {
      method: 'cash',
      label: 'Cash',
      subtitle: 'Physical Currency & Drawer',
      count: 0,
      total: 0,
      color: '#10b981'
    },
    bank_transfer: {
      method: 'bank_transfer',
      label: 'Bank Transfer',
      subtitle: 'BDO, BPI, UnionBank, etc.',
      count: 0,
      total: 0,
      color: '#8b5cf6'
    },
    ewallet: {
      method: 'ewallet',
      label: 'E-Wallet (GCash / Maya)',
      subtitle: 'GCash & Maya Payments',
      count: 0,
      total: 0,
      color: '#007dfa'
    }
  };

  let grandTotal = 0;

  // 1. Process POS Orders
  orders.forEach(order => {
    const catKey = normalizeCategory(order.paymentCategory || order.paymentMethod, order.paymentProvider);
    const orderTotal = order.total || 0;
    categories[catKey].count++;
    categories[catKey].total += orderTotal;
    grandTotal += orderTotal;
  });

  // 2. Process Client Transactions (Bills Payments & Cash-ins)
  transactions.forEach(txn => {
    const catKey = normalizeCategory(txn.paymentCategory || txn.paymentMethod || txn.type, txn.paymentProvider);
    const txnAmount = parseFloat(txn.amount || 0);
    categories[catKey].count++;
    categories[catKey].total += txnAmount;
    grandTotal += txnAmount;
  });

  const methods = Object.values(categories).map(cat => ({
    ...cat,
    total: roundCurrency(cat.total),
    pct: grandTotal > 0 ? roundCurrency((cat.total / grandTotal) * 100) : 0
  }));

  return {
    totalCollected: roundCurrency(grandTotal),
    methods,
    cashTotal: roundCurrency(categories.cash.total),
    bankTotal: roundCurrency(categories.bank_transfer.total),
    ewalletTotal: roundCurrency(categories.ewallet.total)
  };
}

// ── Inventory Analytics ──

export async function getInventoryAnalytics() {
  const [products, categories, lowStockThresholdSetting] = await Promise.all([
    db.products.filter(p => p.status !== 'deleted').toArray(),
    db.categories.toArray(),
    db.settings.where('key').equals('lowStockThreshold').first()
  ]);

  const threshold = lowStockThresholdSetting?.value || 10;

  const totalProducts = products.length;
  const inStock = products.filter(p => p.stock > threshold).length;
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= threshold).length;
  const outOfStock = products.filter(p => p.stock <= 0).length;
  const inventoryValue = roundCurrency(
    products.reduce((sum, p) => sum + ((p.stock || 0) * (p.cost || 0)), 0)
  );

  return {
    totalProducts,
    inStock,
    lowStock,
    outOfStock,
    inventoryValue,
    products,
    categories,
    threshold
  };
}

// ── Reports Analytics ──

export async function getReportsAnalytics(options = {}) {
  const {
    preset = 'today',
    customStart,
    customEnd,
    paymentMethod,
    cashier,
    categoryId
  } = options;

  const range = getDateRange(preset, customStart, customEnd);

  const [allOrders, allProducts, allExpenses, allCategories] = await Promise.all([
    db.orders.toArray(),
    db.products.toArray(),
    db.expenses.toArray(),
    db.categories.toArray()
  ]);

  let filteredOrders = filterOrdersByRange(allOrders, range.start, range.end);

  // Apply filters
  if (paymentMethod && paymentMethod !== 'all') {
    filteredOrders = filteredOrders.filter(o => o.paymentMethod === paymentMethod);
  }
  if (cashier && cashier !== 'all') {
    filteredOrders = filteredOrders.filter(o => o.cashierName === cashier);
  }
  if (categoryId && categoryId !== 'all') {
    const categoryProducts = allProducts.filter(p => p.categoryId === categoryId);
    const categoryProductIds = new Set(categoryProducts.map(p => p.id));
    filteredOrders = filteredOrders.filter(o =>
      (o.items || []).some(item => categoryProductIds.has(item.productId))
    );
  }

  const financials = calculateFinancials(filteredOrders, allProducts);

  const periodExpenses = filterExpensesByRange(allExpenses, range.start, range.end);
  const totalExpenses = roundCurrency(
    periodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  );
  const netIncome = roundCurrency(financials.grossProfit - totalExpenses);

  const completedOrders = allOrders.filter(o => o.status === 'completed');
  const uniqueCashiers = [...new Set(completedOrders.map(o => o.cashierName).filter(Boolean))];
  const uniquePaymentMethods = [...new Set(completedOrders.map(o => o.paymentMethod).filter(Boolean))];

  return {
    orders: filteredOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    financials: {
      ...financials,
      totalExpenses,
      netIncome
    },
    uniqueCashiers,
    uniquePaymentMethods,
    categories: allCategories,
    range
  };
}
