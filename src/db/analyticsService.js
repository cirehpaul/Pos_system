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

// ── Core Data Fetching ──

function filterOrdersByRange(orders, start, end) {
  return orders.filter(o => {
    if (!o.createdAt || o.status !== 'completed') return false;
    const d = new Date(o.createdAt);
    return d >= start && d <= end;
  });
}

// ── Financial Calculations ──

function calculateFinancials(orders, products) {
  // Build product cost lookup for legacy orders without item-level cost
  const productCostMap = {};
  products.forEach(p => {
    productCostMap[p.id] = p.cost || 0;
  });

  let grossSales = 0;
  let totalDiscount = 0;
  let cogs = 0;
  let totalOrders = orders.length;

  orders.forEach(order => {
    grossSales += order.total || 0;
    totalDiscount += order.discount || 0;
    
    (order.items || []).forEach(item => {
      const qty = item.quantity || 0;
      // Use item-level cost if snapshotted, otherwise fallback to product cost lookup
      const itemCost = (item.cost !== undefined && item.cost !== null)
        ? item.cost
        : (productCostMap[item.productId] || 0);
      cogs += itemCost * qty;
    });
  });

  const netSales = roundCurrency(grossSales - totalDiscount);
  const grossProfit = roundCurrency(netSales - cogs);
  const aov = totalOrders > 0 ? roundCurrency(netSales / totalOrders) : 0;

  return {
    grossSales: roundCurrency(grossSales),
    totalDiscount: roundCurrency(totalDiscount),
    netSales,
    cogs: roundCurrency(cogs),
    grossProfit,
    totalOrders,
    aov
  };
}

function calcPercentageChange(current, previous) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return current > 0 ? 100 : -100;
  return roundCurrency(((current - previous) / Math.abs(previous)) * 100);
}

// ── Dashboard Analytics (single optimized call) ──

export async function getDashboardAnalytics(preset = 'today', customStart, customEnd) {
  const range = getDateRange(preset, customStart, customEnd);
  const prevRange = getPreviousPeriodRange(preset, customStart, customEnd);

  // Load all data in parallel
  const [allOrders, allProducts, allExpenses, lowStockThresholdSetting] = await Promise.all([
    db.orders.toArray(),
    db.products.filter(p => p.status !== 'deleted').toArray(),
    db.expenses.toArray(),
    db.settings.where('key').equals('lowStockThreshold').first()
  ]);

  const lowStockThreshold = lowStockThresholdSetting?.value || 10;

  // Filter orders for current and previous period
  const currentOrders = filterOrdersByRange(allOrders, range.start, range.end);
  const previousOrders = filterOrdersByRange(allOrders, prevRange.start, prevRange.end);

  // Financial calcs
  const current = calculateFinancials(currentOrders, allProducts);
  const previous = calculateFinancials(previousOrders, allProducts);

  // Expenses for current period
  const currentExpenses = allExpenses.filter(e => {
    const d = new Date(e.date || e.createdAt);
    return d >= range.start && d <= range.end;
  });
  const totalExpenses = roundCurrency(
    currentExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  );

  const previousExpenses = allExpenses.filter(e => {
    const d = new Date(e.date || e.createdAt);
    return d >= prevRange.start && d <= prevRange.end;
  });
  const prevTotalExpenses = roundCurrency(
    previousExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  );

  const netIncome = roundCurrency(current.grossProfit - totalExpenses);
  const prevNetIncome = roundCurrency(previous.grossProfit - prevTotalExpenses);

  // Low stock items
  const lowStockItems = allProducts
    .filter(p => p.stock <= lowStockThreshold)
    .sort((a, b) => a.stock - b.stock);

  // KPI cards
  const kpis = {
    totalSales: current.netSales,
    totalSalesChange: calcPercentageChange(current.netSales, previous.netSales),
    totalOrders: current.totalOrders,
    totalOrdersChange: calcPercentageChange(current.totalOrders, previous.totalOrders),
    grossProfit: current.grossProfit,
    grossProfitChange: calcPercentageChange(current.grossProfit, previous.grossProfit),
    netIncome,
    netIncomeChange: calcPercentageChange(netIncome, prevNetIncome),
    aov: current.aov,
    aovChange: calcPercentageChange(current.aov, previous.aov),
    lowStockCount: lowStockItems.length,
    cogs: current.cogs,
    grossSales: current.grossSales,
    totalDiscount: current.totalDiscount,
    totalExpenses
  };

  // Time-series chart data
  const chartData = buildTimeSeries(currentOrders, allProducts, preset, range);

  // Sales vs Cost vs Profit comparison
  const profitComparison = buildProfitComparison(currentOrders, allProducts, preset, range);

  // Top products
  const topProducts = buildTopProducts(currentOrders, allProducts);

  // Payment method distribution
  const paymentDistribution = buildPaymentDistribution(currentOrders);

  // Recent transactions (latest 6 from all completed orders)
  const completedOrders = allOrders
    .filter(o => o.status === 'completed')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const recentTransactions = completedOrders.slice(0, 6);

  // Expense breakdown by category
  const expensesByCategory = currentExpenses.reduce((acc, e) => {
    const cat = e.category || 'Other';
    if (!acc[cat]) acc[cat] = { category: cat, total: 0, count: 0 };
    acc[cat].total = roundCurrency(acc[cat].total + (e.amount || 0));
    acc[cat].count++;
    return acc;
  }, {});

  return {
    kpis,
    chartData,
    profitComparison,
    topProducts,
    lowStockItems,
    paymentDistribution,
    recentTransactions,
    expenses: currentExpenses.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)),
    expensesByCategory: Object.values(expensesByCategory).sort((a, b) => b.total - a.total),
    range
  };
}

// ── Time-Series Builder ──

function buildTimeSeries(orders, products, preset, range) {
  let buckets = [];
  let labelFormat = 'HH:mm';

  if (preset === 'today' || preset === 'yesterday') {
    // Hourly buckets
    buckets = eachHourOfInterval({ start: range.start, end: range.end });
    labelFormat = 'ha';
  } else if (preset === 'thisWeek') {
    buckets = eachDayOfInterval({ start: range.start, end: range.end });
    labelFormat = 'EEE';
  } else if (preset === 'thisMonth' || preset === 'lastMonth') {
    buckets = eachDayOfInterval({ start: range.start, end: range.end });
    labelFormat = 'MMM d';
  } else {
    // Custom range: determine bucket type based on span
    const spanDays = (range.end - range.start) / (1000 * 60 * 60 * 24);
    if (spanDays <= 1) {
      buckets = eachHourOfInterval({ start: range.start, end: range.end });
      labelFormat = 'ha';
    } else {
      buckets = eachDayOfInterval({ start: range.start, end: range.end });
      labelFormat = spanDays <= 7 ? 'EEE' : 'MMM d';
    }
  }

  // Product cost lookup
  const productCostMap = {};
  products.forEach(p => { productCostMap[p.id] = p.cost || 0; });

  const series = buckets.map((bucketStart, idx) => {
    const bucketEnd = idx < buckets.length - 1 ? buckets[idx + 1] : range.end;
    
    const bucketOrders = orders.filter(o => {
      const d = new Date(o.createdAt);
      return d >= bucketStart && d < bucketEnd;
    });

    let sales = 0, profit = 0, orderCount = bucketOrders.length;
    let cogs = 0;
    
    bucketOrders.forEach(order => {
      sales += order.total || 0;
      (order.items || []).forEach(item => {
        const itemCost = (item.cost !== undefined && item.cost !== null)
          ? item.cost : (productCostMap[item.productId] || 0);
        cogs += itemCost * (item.quantity || 0);
      });
    });
    
    profit = sales - cogs;

    return {
      label: format(bucketStart, labelFormat),
      date: bucketStart.toISOString(),
      sales: roundCurrency(sales),
      profit: roundCurrency(profit),
      netIncome: roundCurrency(profit), // Without per-bucket expenses
      orders: orderCount
    };
  });

  return series;
}

// ── Profit Comparison ──

function buildProfitComparison(orders, products, preset, range) {
  const productCostMap = {};
  products.forEach(p => { productCostMap[p.id] = p.cost || 0; });

  let buckets = [];
  let labelFormat = 'HH:mm';

  if (preset === 'today' || preset === 'yesterday') {
    buckets = eachHourOfInterval({ start: range.start, end: range.end });
    labelFormat = 'ha';
  } else if (preset === 'thisWeek') {
    buckets = eachDayOfInterval({ start: range.start, end: range.end });
    labelFormat = 'EEE';
  } else {
    buckets = eachDayOfInterval({ start: range.start, end: range.end });
    labelFormat = 'MMM d';
  }

  return buckets.map((bucketStart, idx) => {
    const bucketEnd = idx < buckets.length - 1 ? buckets[idx + 1] : range.end;
    
    const bucketOrders = orders.filter(o => {
      const d = new Date(o.createdAt);
      return d >= bucketStart && d < bucketEnd;
    });

    let sales = 0, cogs = 0;
    bucketOrders.forEach(order => {
      sales += order.total || 0;
      (order.items || []).forEach(item => {
        const itemCost = (item.cost !== undefined && item.cost !== null)
          ? item.cost : (productCostMap[item.productId] || 0);
        cogs += itemCost * (item.quantity || 0);
      });
    });

    return {
      label: format(bucketStart, labelFormat),
      sales: roundCurrency(sales),
      cost: roundCurrency(cogs),
      profit: roundCurrency(sales - cogs)
    };
  });
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
          totalProfit: 0
        };
      }
      const qty = item.quantity || 0;
      const revenue = item.subtotal || (item.price * qty);
      const itemCost = (item.cost !== undefined && item.cost !== null)
        ? item.cost : (productCostMap[item.productId] || 0);
      
      itemMap[key].unitsSold += qty;
      itemMap[key].totalSales += revenue;
      itemMap[key].totalProfit += revenue - (itemCost * qty);
    });
  });

  return Object.values(itemMap)
    .map(p => ({
      ...p,
      totalSales: roundCurrency(p.totalSales),
      totalProfit: roundCurrency(p.totalProfit)
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 10);
}

// ── Payment Distribution ──

function buildPaymentDistribution(orders) {
  const dist = {};
  orders.forEach(order => {
    const method = order.paymentMethod || 'cash';
    if (!dist[method]) {
      dist[method] = { method, count: 0, total: 0 };
    }
    dist[method].count++;
    dist[method].total += order.total || 0;
  });

  const result = Object.values(dist).map(d => ({
    ...d,
    total: roundCurrency(d.total)
  }));

  return result.sort((a, b) => b.total - a.total);
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
    // Filter orders that contain items from the category
    const categoryProducts = allProducts.filter(p => p.categoryId === categoryId);
    const categoryProductIds = new Set(categoryProducts.map(p => p.id));
    filteredOrders = filteredOrders.filter(o =>
      (o.items || []).some(item => categoryProductIds.has(item.productId))
    );
  }

  const financials = calculateFinancials(filteredOrders, allProducts);

  // Expenses for the period
  const periodExpenses = allExpenses.filter(e => {
    const d = new Date(e.date || e.createdAt);
    return d >= range.start && d <= range.end;
  });
  const totalExpenses = roundCurrency(
    periodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  );
  const netIncome = roundCurrency(financials.grossProfit - totalExpenses);

  // Unique cashiers & payment methods for filter dropdowns
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
