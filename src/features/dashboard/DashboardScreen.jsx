import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, ShoppingBag, TrendingUp, AlertTriangle,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight,
  Eye, Plus, Activity, Wallet, CreditCard, Banknote,
  Smartphone, Clock, Receipt, ListMinus
} from 'lucide-react';
import { format } from 'date-fns';
import db, { formatCurrency, formatNumber } from '../../db/database';
import { getDashboardAnalytics } from '../../db/analyticsService';
import useAuthStore from '../../stores/authStore';
import Modal from '../../components/Modal/Modal';
import ReceiptPreview from '../receipt/ReceiptPreview';
import { useToast } from '../../components/Toast/Toast';
import './DashboardScreen.css';

// ── Lightweight SVG Area Chart ──
function AreaChart({ data, dataKey, color = '#6366f1', height = 260 }) {
  const [tooltip, setTooltip] = useState(null);

  if (!data || data.length === 0) return (
    <div className="chart-empty">
      <Activity size={32} />
      <p>No data for this period</p>
    </div>
  );

  const values = data.map(d => d[dataKey] || 0);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = 800;
  const chartHeight = height;
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  const points = values.map((v, i) => ({
    x: padding.left + (i / Math.max(values.length - 1, 1)) * innerW,
    y: padding.top + innerH - ((v - minVal) / range) * innerH
  }));

  // Smooth path
  const linePath = points.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
  }).join(' ');

  const areaPath = linePath +
    ` L ${points[points.length - 1].x} ${padding.top + innerH}` +
    ` L ${points[0].x} ${padding.top + innerH} Z`;

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    minVal + (range / (yTicks - 1)) * i
  );

  // X-axis labels (show max 8)
  const step = Math.max(1, Math.floor(data.length / 8));

  return (
    <div className="chart-container">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet" className="chart-svg">
        <defs>
          <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTickValues.map((v, i) => {
          const y = padding.top + innerH - ((v - minVal) / range) * innerH;
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y}
                stroke="var(--color-border)" strokeDasharray="4 4" strokeWidth="0.5" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-tick-label">
                {dataKey === 'orders' ? Math.round(v) : formatCurrency(v).replace('₱', '')}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#gradient-${dataKey})`} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points + hover areas */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill={color} stroke="white" strokeWidth="2"
              className="chart-dot" />
            <rect x={p.x - innerW / values.length / 2} y={padding.top} width={innerW / values.length}
              height={innerH} fill="transparent"
              onMouseEnter={() => setTooltip({ x: p.x, y: p.y, value: values[i], label: data[i].label })}
              onMouseLeave={() => setTooltip(null)} />
          </g>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          if (i % step !== 0 && i !== data.length - 1) return null;
          const x = padding.left + (i / Math.max(data.length - 1, 1)) * innerW;
          return (
            <text key={i} x={x} y={chartHeight - 8} textAnchor="middle" className="chart-tick-label">
              {d.label}
            </text>
          );
        })}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={padding.top + innerH}
              stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <rect x={tooltip.x - 55} y={tooltip.y - 42} width="110" height="34"
              rx="6" fill="var(--color-surface)" stroke="var(--color-border)" />
            <text x={tooltip.x} y={tooltip.y - 28} textAnchor="middle" className="chart-tooltip-label">
              {tooltip.label}
            </text>
            <text x={tooltip.x} y={tooltip.y - 14} textAnchor="middle" className="chart-tooltip-value">
              {dataKey === 'orders' ? tooltip.value : formatCurrency(tooltip.value)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ── Bar Chart for Profit Comparison ──
function ProfitBarChart({ data, height = 220 }) {
  if (!data || data.length === 0) return (
    <div className="chart-empty"><Activity size={32} /><p>No data for this period</p></div>
  );

  // Only show bars for buckets that have data
  const nonEmpty = data.filter(d => d.sales > 0 || d.cost > 0);
  const displayData = nonEmpty.length > 0 ? nonEmpty : data.slice(0, 7);

  const maxVal = Math.max(...displayData.map(d => Math.max(d.sales, d.cost, d.profit)), 1);
  const barW = Math.min(30, (600 / displayData.length) * 0.25);
  const gap = 4;

  const padding = { top: 15, right: 15, bottom: 35, left: 55 };
  const chartWidth = 700;
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  return (
    <div className="chart-container">
      <svg viewBox={`0 0 ${chartWidth} ${height}`} preserveAspectRatio="xMidYMid meet" className="chart-svg">
        {displayData.map((d, i) => {
          const groupX = padding.left + (i / displayData.length) * innerW + innerW / displayData.length / 2;
          const salesH = (d.sales / maxVal) * innerH;
          const costH = (d.cost / maxVal) * innerH;
          const profitH = (Math.max(0, d.profit) / maxVal) * innerH;

          return (
            <g key={i}>
              <rect x={groupX - barW * 1.5 - gap} y={padding.top + innerH - salesH}
                width={barW} height={salesH} rx="3" fill="#6366f1" opacity="0.85" />
              <rect x={groupX - barW / 2} y={padding.top + innerH - costH}
                width={barW} height={costH} rx="3" fill="#f59e0b" opacity="0.85" />
              <rect x={groupX + barW / 2 + gap} y={padding.top + innerH - profitH}
                width={barW} height={profitH} rx="3" fill="#10b981" opacity="0.85" />
              <text x={groupX} y={height - 8} textAnchor="middle" className="chart-tick-label">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chart-legend">
        <span className="chart-legend-item"><span className="chart-legend-dot" style={{ background: '#6366f1' }} /> Sales</span>
        <span className="chart-legend-item"><span className="chart-legend-dot" style={{ background: '#f59e0b' }} /> Cost</span>
        <span className="chart-legend-item"><span className="chart-legend-dot" style={{ background: '#10b981' }} /> Profit</span>
      </div>
    </div>
  );
}

// ── Donut/Ring Chart for Payment Methods ──
function PaymentDonut({ data }) {
  if (!data || data.length === 0) return (
    <div className="chart-empty"><PieChart size={32} /><p>No payment data</p></div>
  );

  const total = data.reduce((s, d) => s + d.total, 0);
  const colors = { cash: '#10b981', gcash: '#3b82f6', card: '#f59e0b', other: '#8b5cf6' };
  const labels = { cash: 'Cash', gcash: 'GCash', card: 'Card' };
  const icons = { cash: Banknote, gcash: Smartphone, card: CreditCard };

  let cumAngle = 0;
  const slices = data.map(d => {
    const pct = total > 0 ? d.total / total : 0;
    const startAngle = cumAngle;
    cumAngle += pct * 360;
    return { ...d, pct, startAngle, endAngle: cumAngle };
  });

  const r = 60, cx = 80, cy = 80, inner = 40;

  function arcPath(startDeg, endDeg, outerR, innerR) {
    const toRad = d => (d - 90) * Math.PI / 180;
    const s1 = toRad(startDeg), e1 = toRad(endDeg);
    const x1 = cx + outerR * Math.cos(s1), y1 = cy + outerR * Math.sin(s1);
    const x2 = cx + outerR * Math.cos(e1), y2 = cy + outerR * Math.sin(e1);
    const x3 = cx + innerR * Math.cos(e1), y3 = cy + innerR * Math.sin(e1);
    const x4 = cx + innerR * Math.cos(s1), y4 = cy + innerR * Math.sin(s1);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4} Z`;
  }

  return (
    <div className="payment-donut">
      <svg viewBox="0 0 160 160" className="donut-svg">
        {slices.map((s, i) => (
          <path key={i} d={arcPath(s.startAngle, s.endAngle, r, inner)}
            fill={colors[s.method] || colors.other} />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="donut-center-label">Total</text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="donut-center-value">
          {formatCurrency(total).replace('₱', '')}
        </text>
      </svg>
      <div className="payment-list">
        {slices.map((s, i) => {
          const Icon = icons[s.method] || Wallet;
          return (
            <div key={i} className="payment-item">
              <div className="payment-item__icon" style={{ background: (colors[s.method] || colors.other) + '18', color: colors[s.method] || colors.other }}>
                <Icon size={16} />
              </div>
              <div className="payment-item__info">
                <span className="payment-item__label">{labels[s.method] || s.method}</span>
                <span className="payment-item__value">{formatCurrency(s.total)}</span>
              </div>
              <span className="payment-item__pct">{(s.pct * 100).toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Dashboard Screen ──

export default function DashboardScreen() {
  const { currentUser } = useAuthStore();
  const toast = useToast();

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [chartMetric, setChartMetric] = useState('sales');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [restockProduct, setRestockProduct] = useState(null);
  const [addQty, setAddQty] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDashboardAnalytics(datePreset, customStart, customEnd);
      setAnalytics(data);
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
    setLoading(false);
  }, [datePreset, customStart, customEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRestock = async (e) => {
    e.preventDefault();
    if (!addQty || parseInt(addQty, 10) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    try {
      const qty = parseInt(addQty, 10);
      const newStock = restockProduct.stock + qty;
      await db.products.update(restockProduct.id, {
        stock: newStock,
        status: 'available',
        updatedAt: new Date().toISOString()
      });
      await db.inventoryTransactions.add({
        id: crypto.randomUUID(),
        productId: restockProduct.id,
        type: 'restock',
        quantity: qty,
        costPerUnit: restockProduct.cost || 0,
        previousStock: restockProduct.stock,
        newStock,
        reference: '',
        notes: 'Quick restock from dashboard',
        createdAt: new Date().toISOString()
      });
      toast.success(`Added ${qty} units to ${restockProduct.name}`);
      setRestockProduct(null);
      setAddQty('');
      loadData();
    } catch (err) {
      console.error('Failed to update stock:', err);
      toast.error('Failed to update stock');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const chartColors = { sales: '#6366f1', profit: '#10b981', netIncome: '#3b82f6', orders: '#f59e0b' };

  if (loading && !analytics) {
    return (
      <div className="dashboard animate-fade-in">
        <div className="dashboard__header">
          <div>
            <h1 className="dashboard__greeting">{getGreeting()}, {currentUser?.name || 'Owner'}</h1>
            <p className="dashboard__subtitle">Loading your business overview...</p>
          </div>
        </div>
        <div className="dashboard__cards stagger-children">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="kpi-card skeleton" style={{ height: 120 }}></div>
          ))}
        </div>
      </div>
    );
  }

  const kpis = analytics?.kpis || {};

  return (
    <div className="dashboard animate-fade-in">
      {/* Header */}
      <div className="dashboard__header">
        <div>
          <h1 className="dashboard__greeting">{getGreeting()}, {currentUser?.name || 'Owner'}</h1>
          <p className="dashboard__subtitle">Here's what's happening with your business {datePreset === 'today' ? 'today' : ''}.</p>
        </div>
        <div className="dashboard__date-controls">
          <div className="date-tabs">
            {[
              { key: 'today', label: 'Today' },
              { key: 'thisWeek', label: 'This Week' },
              { key: 'thisMonth', label: 'This Month' }
            ].map(tab => (
              <button key={tab.key}
                className={`date-tab ${datePreset === tab.key ? 'date-tab--active' : ''}`}
                onClick={() => { setDatePreset(tab.key); }}
              >{tab.label}</button>
            ))}
          </div>
          <div className="date-custom">
            <input type="date" value={customStart}
              onChange={e => { setCustomStart(e.target.value); setDatePreset('custom'); }}
              className="date-input" />
            <span className="date-separator">to</span>
            <input type="date" value={customEnd}
              onChange={e => { setCustomEnd(e.target.value); setDatePreset('custom'); }}
              className="date-input" />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dashboard__cards stagger-children">
        <KpiCard icon={DollarSign} label="Total Sales" value={formatCurrency(kpis.totalSales)}
          change={kpis.totalSalesChange} color="var(--color-primary)" bg="var(--color-primary-50)" />
        <KpiCard icon={ShoppingBag} label="Total Orders" value={formatNumber(kpis.totalOrders)}
          change={kpis.totalOrdersChange} color="#3b82f6" bg="#eff6ff" />
        <KpiCard icon={TrendingUp} label="Gross Profit" value={formatCurrency(kpis.grossProfit)}
          change={kpis.grossProfitChange} color="#10b981" bg="#ecfdf5" />
        <KpiCard icon={Wallet} label="Net Income" value={formatCurrency(kpis.netIncome)}
          change={kpis.netIncomeChange} color="#8b5cf6" bg="#f5f3ff"
          subtitle={kpis.totalExpenses > 0 ? `After ₱${kpis.totalExpenses.toLocaleString()} expenses` : 'No expenses logged'} />
        <KpiCard icon={BarChart3} label="Avg. Order Value" value={formatCurrency(kpis.aov)}
          change={kpis.aovChange} color="#f59e0b" bg="#fffbeb" />
        <KpiCard icon={AlertTriangle} label="Low Stock Items" value={formatNumber(kpis.lowStockCount)}
          color="#ef4444" bg="#fef2f2" isAlert={kpis.lowStockCount > 0} />
      </div>

      {/* Charts Row */}
      <div className="dashboard__charts-row">
        {/* Main Sales Chart */}
        <div className="dashboard__panel dashboard__panel--chart">
          <div className="dashboard__panel-header">
            <h3><Activity size={18} /> Sales Analytics</h3>
            <div className="metric-tabs">
              {[
                { key: 'sales', label: 'Sales' },
                { key: 'profit', label: 'Profit' },
                { key: 'netIncome', label: 'Net Income' },
                { key: 'orders', label: 'Orders' }
              ].map(m => (
                <button key={m.key}
                  className={`metric-tab ${chartMetric === m.key ? 'metric-tab--active' : ''}`}
                  onClick={() => setChartMetric(m.key)}
                >{m.label}</button>
              ))}
            </div>
          </div>
          <div className="dashboard__panel-body">
            <AreaChart data={analytics?.chartData} dataKey={chartMetric}
              color={chartColors[chartMetric]} height={260} />
          </div>
        </div>
      </div>

      {/* Profitability Row */}
      <div className="dashboard__charts-row">
        <div className="dashboard__panel dashboard__panel--profit">
          <div className="dashboard__panel-header">
            <h3><BarChart3 size={18} /> Sales vs Cost vs Profit</h3>
          </div>
          <div className="dashboard__panel-body">
            <ProfitBarChart data={analytics?.profitComparison} />
          </div>
        </div>
        <div className="dashboard__panel dashboard__panel--payments">
          <div className="dashboard__panel-header">
            <h3><PieChart size={18} /> Payment Methods</h3>
          </div>
          <div className="dashboard__panel-body">
            <PaymentDonut data={analytics?.paymentDistribution} />
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="dashboard__bottom-grid">
        {/* Top Products */}
        <div className="dashboard__panel">
          <div className="dashboard__panel-header">
            <h3><TrendingUp size={18} /> Top Products</h3>
          </div>
          <div className="dashboard__panel-body">
            {(!analytics?.topProducts || analytics.topProducts.length === 0) ? (
              <div className="dashboard__empty"><p>No sales data for this period.</p></div>
            ) : (
              <div className="top-products-list">
                {analytics.topProducts.slice(0, 5).map((item, i) => (
                  <div key={item.name} className="top-product-item">
                    <span className={`top-product-rank rank-${i + 1}`}>#{i + 1}</span>
                    <div className="top-product-info">
                      <span className="top-product-name">{item.name}</span>
                      <span className="top-product-qty">{item.unitsSold} sold</span>
                    </div>
                    <div className="top-product-financial">
                      <span className="top-product-sales">{formatCurrency(item.totalSales)}</span>
                      <span className="top-product-profit" style={{ color: item.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                        {formatCurrency(item.totalProfit)} profit
                      </span>
                    </div>
                    <div className="top-product-bar">
                      <div className="top-product-bar-fill"
                        style={{ width: `${(item.unitsSold / analytics.topProducts[0].unitsSold) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Low Stock */}
        <div className="dashboard__panel">
          <div className="dashboard__panel-header">
            <h3><AlertTriangle size={18} /> Low Stock Alert</h3>
          </div>
          <div className="dashboard__panel-body">
            {(!analytics?.lowStockItems || analytics.lowStockItems.length === 0) ? (
              <div className="dashboard__empty dashboard__empty--success">
                <p>All items are well stocked! ✓</p>
              </div>
            ) : (
              <div className="lowstock-list">
                {analytics.lowStockItems.slice(0, 6).map(item => (
                  <div key={item.id} className="lowstock-item">
                    <div className="lowstock-item__info">
                      <span className="lowstock-item__name">{item.name}</span>
                      <span className="lowstock-item__stock-label">
                        {item.stock === 0 ? 'Out of stock' : `${item.stock} remaining`}
                      </span>
                    </div>
                    <div className="lowstock-item__actions">
                      <span className={`status-badge status-badge--${item.stock === 0 ? 'danger' : 'warning'}`}>
                        {item.stock === 0 ? 'Out' : 'Low'}
                      </span>
                      <button className="btn btn--primary btn--small"
                        onClick={() => setRestockProduct(item)}>
                        <Plus size={14} /> Restock
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Expense Monitor ── */}
      <div className="dashboard__panel dashboard__panel--full">
        <div className="dashboard__panel-header">
          <h3><ListMinus size={18} /> Expense Monitor</h3>
          <div className="expense-header-meta">
            <span className="expense-total-badge">
              Total: {formatCurrency(analytics?.kpis?.totalExpenses || 0)}
            </span>
          </div>
        </div>
        <div className="dashboard__panel-body">
          {(!analytics?.expenses || analytics.expenses.length === 0) ? (
            <div className="dashboard__empty">
              <Receipt size={36} />
              <p style={{ marginTop: 'var(--space-3)' }}>No expenses logged for this period.</p>
              <p className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-1)' }}>
                Go to Sales Reports → Log Expense to record business expenses.
              </p>
            </div>
          ) : (
            <div className="expense-monitor-grid">
              {/* Category Breakdown */}
              <div className="expense-categories">
                <h4 className="expense-section-title">By Category</h4>
                {analytics.expensesByCategory.map(cat => {
                  const pct = analytics.kpis.totalExpenses > 0
                    ? (cat.total / analytics.kpis.totalExpenses) * 100
                    : 0;
                  return (
                    <div key={cat.category} className="expense-cat-item">
                      <div className="expense-cat-header">
                        <span className="expense-cat-name">{cat.category}</span>
                        <span className="expense-cat-amount">{formatCurrency(cat.total)}</span>
                      </div>
                      <div className="expense-cat-bar">
                        <div className="expense-cat-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="expense-cat-pct">{pct.toFixed(1)}% · {cat.count} entr{cat.count === 1 ? 'y' : 'ies'}</span>
                    </div>
                  );
                })}
              </div>

              {/* Itemized List */}
              <div className="expense-items">
                <h4 className="expense-section-title">Recent Entries</h4>
                <div className="expense-items-list">
                  {analytics.expenses.slice(0, 10).map(exp => (
                    <div key={exp.id} className="expense-item">
                      <div className="expense-item__cat-dot"
                        style={{ background: getCategoryColor(exp.category) }} />
                      <div className="expense-item__info">
                        <span className="expense-item__desc">
                          {exp.description || exp.category}
                        </span>
                        <span className="expense-item__meta">
                          {exp.category} · {exp.date
                            ? format(new Date(exp.date), 'MMM dd, yyyy')
                            : format(new Date(exp.createdAt), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <span className="expense-item__amount">
                        {formatCurrency(exp.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                {analytics.expenses.length > 10 && (
                  <p className="expense-more-hint">+{analytics.expenses.length - 10} more entries — view in Reports</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="dashboard__panel dashboard__panel--full">
        <div className="dashboard__panel-header">
          <h3><Clock size={18} /> Recent Transactions</h3>
        </div>
        <div className="dashboard__panel-body">
          {(!analytics?.recentTransactions || analytics.recentTransactions.length === 0) ? (
            <div className="dashboard__empty"><p>No transactions recorded yet.</p></div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Receipt No.</th>
                    <th>Date & Time</th>
                    <th>Cashier</th>
                    <th>Items</th>
                    <th>Method</th>
                    <th className="text-right">Total</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recentTransactions.map(order => (
                    <tr key={order.id}>
                      <td className="font-semibold text-primary">{order.orderNumber}</td>
                      <td>
                        <div className="date-cell">
                          <span>{format(new Date(order.createdAt), 'MMM dd, yyyy')}</span>
                          <span className="text-sm text-tertiary">{format(new Date(order.createdAt), 'hh:mm a')}</span>
                        </div>
                      </td>
                      <td>{order.cashierName || 'Unknown'}</td>
                      <td>{order.items?.length || 0} items</td>
                      <td>
                        <span className={`method-badge method-badge--${order.paymentMethod}`}>
                          {order.paymentMethod === 'gcash' ? 'GCash' : order.paymentMethod === 'card' ? 'Card' : 'Cash'}
                        </span>
                      </td>
                      <td className="text-right font-semibold">{formatCurrency(order.total)}</td>
                      <td>
                        <div className="table-actions justify-center">
                          <button className="btn btn--ghost btn--small" onClick={() => setSelectedOrder(order)}>
                            <Eye size={16} /> View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Modal */}
      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title="Transaction Details" size="sm">
        {selectedOrder && (
          <div className="order-details">
            <div className="receipt-container">
              <ReceiptPreview order={selectedOrder} />
            </div>
            <div className="form-actions mt-4">
              <button className="btn btn--ghost" onClick={() => setSelectedOrder(null)}>Close</button>
              <button className="btn btn--primary" onClick={() => window.print()}>Print Receipt</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Restock Modal */}
      <Modal isOpen={!!restockProduct} onClose={() => { setRestockProduct(null); setAddQty(''); }}
        title="Quick Restock" size="sm">
        {restockProduct && (
          <form onSubmit={handleRestock} className="category-form">
            <div className="restock-info">
              <span className="text-tertiary">Product:</span>
              <span className="font-semibold">{restockProduct.name}</span>
            </div>
            <div className="restock-info mb-4">
              <span className="text-tertiary">Current Stock:</span>
              <span className="font-bold text-primary">{restockProduct.stock}</span>
            </div>
            <div className="form-group">
              <label>Quantity to Add</label>
              <input type="number" min="1" step="1" required value={addQty}
                onChange={e => setAddQty(e.target.value)} placeholder="e.g. 50" autoFocus />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setRestockProduct(null)}>Cancel</button>
              <button type="submit" className="btn btn--primary">Update Stock</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

// ── KPI Card Component ──

function KpiCard({ icon: Icon, label, value, change, color, bg, subtitle, isAlert }) {
  const isPositive = change > 0;
  const hasChange = change !== undefined && change !== null;

  return (
    <div className="kpi-card" style={{ '--kpi-color': color, '--kpi-bg': bg }}>
      <div className="kpi-card__icon">
        <Icon size={22} />
      </div>
      <div className="kpi-card__content">
        <span className="kpi-card__label">{label}</span>
        <span className="kpi-card__value">{value}</span>
        {hasChange && (
          <span className={`kpi-card__change ${isPositive ? 'kpi-card__change--up' : 'kpi-card__change--down'}`}>
            {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(change)}% vs prev period
          </span>
        )}
        {subtitle && <span className="kpi-card__subtitle">{subtitle}</span>}
        {isAlert && <span className="kpi-card__alert-dot" />}
      </div>
    </div>
  );
}

// ── Expense Category Color Map ──
function getCategoryColor(category) {
  const map = {
    Operations: '#6366f1',
    Rent:       '#f59e0b',
    Utilities:  '#3b82f6',
    Wages:      '#10b981',
    Packaging:  '#8b5cf6',
    Maintenance:'#ef4444',
    Marketing:  '#f97316',
    Other:      '#94a3b8',
  };
  return map[category] || '#94a3b8';
}
