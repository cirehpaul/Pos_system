import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign, ShoppingBag, TrendingUp, AlertTriangle,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight,
  Eye, Plus, Activity, Wallet, CreditCard, Banknote,
  Smartphone, Receipt, ListMinus, Search,
  Edit2, Trash2, RefreshCw, Layers, Printer
} from 'lucide-react';
import { format } from 'date-fns';
import db, { formatCurrency, formatNumber } from '../../db/database';
import { getDashboardAnalytics } from '../../db/analyticsService';
import useAuthStore from '../../stores/authStore';
import Modal from '../../components/Modal/Modal';
import { useToast } from '../../components/Toast/Toast';
import './DashboardScreen.css';

// ── Financial Line Chart ──

function FinancialLineChart({ data }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <Activity size={32} />
        <p>No financial data recorded for this period</p>
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 30, left: 60 };
  const width = 800;
  const height = 280;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Find max value for Y-axis scaling
  const maxVal = Math.max(
    ...data.map(d => Math.max(d.sales || 0, d.cogs || 0, d.expenses || 0, d.netIncome || 0)),
    100
  );
  
  // Find min value to support negative net income
  const minVal = Math.min(...data.map(d => Math.min(0, d.netIncome || 0)));
  const yRange = maxVal - minVal;

  const getX = (index) => padding.left + (index * (innerWidth / Math.max(1, data.length - 1)));
  const getY = (val) => padding.top + innerHeight - (((val - minVal) / yRange) * innerHeight);

  // Generate path commands
  const makePath = (key) => {
    if (data.length === 1) {
      return `M ${padding.left},${getY(data[0][key])} L ${width - padding.right},${getY(data[0][key])}`;
    }
    return data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)},${getY(d[key])}`).join(' ');
  };

  return (
    <div className="fin-chart-panel">
      <div className="fin-chart-header">
        <div>
          <h3 className="fin-chart-title">Daily Financial Performance</h3>
          <p className="fin-chart-subtitle">Track sales, costs, expenses, and net income over time.</p>
        </div>
        <div className="fin-chart-legend">
          <div className="legend-item"><span className="legend-dot" style={{ background: '#6366f1' }} /> Sales</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: '#f59e0b' }} /> COGS</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: '#ef4444' }} /> Expenses</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: '#8b5cf6' }} /> Net Income</div>
        </div>
      </div>

      <div className="fin-chart-svg-container">
        <svg viewBox={`0 0 ${width} ${height}`} className="fin-chart-svg" preserveAspectRatio="none">
          {/* Grid lines */}
          <g className="fin-chart-grid">
            {[0, 0.25, 0.5, 0.75, 1].map(tick => {
              const y = padding.top + innerHeight - (tick * innerHeight);
              return <line key={tick} x1={padding.left} y1={y} x2={width - padding.right} y2={y} />;
            })}
            {/* Zero line if minVal < 0 */}
            {minVal < 0 && (
              <line x1={padding.left} y1={getY(0)} x2={width - padding.right} y2={getY(0)} style={{ stroke: 'var(--color-border-hover)', strokeDasharray: 0 }} />
            )}
          </g>
          
          {/* Y Axis Labels */}
          <g className="fin-chart-axis">
            {[0, 0.5, 1].map(tick => {
              const val = minVal + (tick * yRange);
              const y = padding.top + innerHeight - (tick * innerHeight);
              return (
                <text key={tick} x={padding.left - 10} y={y + 4} textAnchor="end">
                  {val >= 1000 ? `₱${(val/1000).toFixed(1)}k` : `₱${val}`}
                </text>
              );
            })}
          </g>

          {/* X Axis Labels */}
          <g className="fin-chart-axis">
            {data.map((d, i) => {
              if (data.length > 15 && i % Math.ceil(data.length / 8) !== 0 && i !== data.length - 1) return null;
              return (
                <text key={i} x={getX(i)} y={height - 10} textAnchor="middle">
                  {d.label}
                </text>
              );
            })}
          </g>

          {/* Lines */}
          <path d={makePath('sales')} className="fin-chart-line" stroke="#6366f1" />
          <path d={makePath('cogs')} className="fin-chart-line" stroke="#f59e0b" />
          <path d={makePath('expenses')} className="fin-chart-line" stroke="#ef4444" />
          <path d={makePath('netIncome')} className="fin-chart-line" stroke="#8b5cf6" />

          {/* Interaction Overlays */}
          {data.map((d, i) => (
            <g key={i}>
              {/* Invisible wide rect for easier hover targeting */}
              <rect
                x={getX(i) - (innerWidth / Math.max(1, data.length - 1)) / 2}
                y={padding.top}
                width={innerWidth / Math.max(1, data.length - 1)}
                height={innerHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
              {hoverIndex === i && (
                <>
                  <line x1={getX(i)} y1={padding.top} x2={getX(i)} y2={height - padding.bottom} stroke="var(--color-border-hover)" strokeDasharray="4" />
                  <circle cx={getX(i)} cy={getY(d.sales)} r="4" fill="#6366f1" />
                  <circle cx={getX(i)} cy={getY(d.cogs)} r="4" fill="#f59e0b" />
                  <circle cx={getX(i)} cy={getY(d.expenses)} r="4" fill="#ef4444" />
                  <circle cx={getX(i)} cy={getY(d.netIncome)} r="4" fill="#8b5cf6" />
                </>
              )}
            </g>
          ))}
        </svg>
        
        {/* HTML Tooltip */}
        {hoverIndex !== null && data[hoverIndex] && (
          <div 
            className="fin-chart-tooltip" 
            style={{ 
              left: `${(getX(hoverIndex) / width) * 100}%`,
              top: `${(Math.min(getY(data[hoverIndex].sales), getY(data[hoverIndex].netIncome)) / height) * 100}%`
            }}
          >
            <div className="fin-chart-tooltip__title">{data[hoverIndex].label}</div>
            <div className="fin-chart-tooltip__row"><span style={{ color: '#6366f1' }}>Sales</span><span>{formatCurrency(data[hoverIndex].sales)}</span></div>
            <div className="fin-chart-tooltip__row"><span style={{ color: '#f59e0b' }}>COGS</span><span>{formatCurrency(data[hoverIndex].cogs)}</span></div>
            <div className="fin-chart-tooltip__row"><span style={{ color: '#ef4444' }}>Expenses</span><span>{formatCurrency(data[hoverIndex].expenses)}</span></div>
            <div className="fin-chart-tooltip__row" style={{ marginTop: 4, paddingTop: 4, borderTop: '1px dashed var(--color-border)' }}>
              <span style={{ color: '#8b5cf6' }}>Net Income</span><span className="font-semibold">{formatCurrency(data[hoverIndex].netIncome)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Expense Breakdown Component ──

function ExpenseBreakdown({ categories = [], total = 0 }) {
  if (categories.length === 0) {
    return <div className="chart-empty"><p>No expenses</p></div>;
  }

  // Show top 6, sum the rest as "Others"
  let displayCats = [...categories];
  let othersTotal = 0;
  if (displayCats.length > 6) {
    const rest = displayCats.splice(6);
    othersTotal = rest.reduce((sum, c) => sum + c.total, 0);
    displayCats.push({
      category: 'Others',
      total: othersTotal,
      pct: total > 0 ? (othersTotal / total) * 100 : 0
    });
  }

  return (
    <div className="fin-chart-panel h-full">
      <h3 className="fin-chart-title">Expense Breakdown</h3>
      <p className="fin-chart-subtitle">See where your operating expenses are going.</p>
      
      <div className="expense-hbar-container">
        {displayCats.map(cat => (
          <div key={cat.category} className="expense-hbar-row" title={`${cat.category}: ${formatCurrency(cat.total)} (${cat.pct.toFixed(1)}%)`}>
            <div className="expense-hbar-label">{cat.category}</div>
            <div className="expense-hbar-track">
              <div 
                className="expense-hbar-fill" 
                style={{ 
                  width: `${cat.pct}%`, 
                  backgroundColor: getCategoryColor(cat.category) 
                }} 
              />
            </div>
            <div className="expense-hbar-value">{formatCurrency(cat.total)}</div>
          </div>
        ))}
        <div className="expense-hbar-total">
          <span>Total Operating Expenses</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Compact Financial Summary ──

function CompactFinancialSummary({ kpis }) {
  return (
    <div className="fin-chart-panel h-full">
      <h3 className="fin-chart-title">Financial Summary</h3>
      <p className="fin-chart-subtitle">Quick overview of your net position.</p>
      
      <div className="fin-summary-stack">
        <div className="fin-summary-row">
          <span className="fin-summary-label">Sales</span>
          <span className="fin-summary-value">{formatCurrency(kpis.totalSales)}</span>
        </div>
        <div className="fin-summary-row">
          <span className="fin-summary-label">
            COGS 
            {kpis.totalSales > 0 && <span className="fin-summary-sub">({((kpis.cogs / kpis.totalSales) * 100).toFixed(1)}%)</span>}
          </span>
          <span className="fin-summary-value">{formatCurrency(kpis.cogs)}</span>
        </div>
        <div className="fin-summary-row fin-summary-row--border">
          <span className="fin-summary-label">Gross Profit</span>
          <span className="fin-summary-value">{formatCurrency(kpis.grossProfit)}</span>
        </div>
        <div className="fin-summary-row">
          <span className="fin-summary-label">
            Operating Expenses
            {kpis.totalSales > 0 && <span className="fin-summary-sub">({((kpis.operatingExpenses / kpis.totalSales) * 100).toFixed(1)}%)</span>}
          </span>
          <span className="fin-summary-value">{formatCurrency(kpis.operatingExpenses)}</span>
        </div>
        <div className={`fin-summary-row fin-summary-row--border ${kpis.netIncome < 0 ? 'fin-summary-row--loss' : 'fin-summary-row--profit'}`}>
          <span className="fin-summary-label font-bold text-main">
            Net Income
            {kpis.netIncome < 0 && <span className="badge badge--danger" style={{ marginLeft: 8, padding: '2px 4px', fontSize: 10 }}>LOSS</span>}
          </span>
          <span className="fin-summary-value" style={{ fontSize: '1.25rem' }}>{formatCurrency(kpis.netIncome)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Payment Methods Breakdown Card ──

function PaymentDonut({ data }) {
  if (!data || !data.methods || data.methods.length === 0) {
    return (
      <div className="payment-empty">
        <p>No transaction payments recorded</p>
      </div>
    );
  }

  const colors = {
    cash: '#10b981',
    gcash: '#007dfa',
    maya: '#00d632',
    card: '#8b5cf6',
    other: '#64748b'
  };

  const labels = {
    cash: 'Cash',
    gcash: 'GCash',
    maya: 'Maya',
    card: 'Card',
    other: 'Other'
  };

  const icons = {
    cash: Banknote,
    gcash: Smartphone,
    maya: Smartphone,
    card: CreditCard,
    other: Wallet
  };

  return (
    <div className="payment-card-body">
      <div className="payment-total-banner">
        <span className="text-secondary text-xs font-medium uppercase tracking-wide">Total Collected</span>
        <span className="payment-total-amount">{formatCurrency(data.totalCollected)}</span>
      </div>

      <div className="payment-multi-bar">
        {data.methods.map(s => (
          <div
            key={s.method}
            className="payment-multi-bar__seg"
            style={{
              width: `${Math.max(s.pct, 4)}%`,
              backgroundColor: colors[s.method] || colors.other
            }}
            title={`${labels[s.method] || s.method}: ${formatCurrency(s.total)} (${s.pct}%)`}
          />
        ))}
      </div>

      <div className="payment-legend-list">
        {data.methods.map(s => {
          const Icon = icons[s.method] || icons.other;
          const color = colors[s.method] || colors.other;
          return (
            <div key={s.method} className="payment-row-item">
              <div className="payment-row-left">
                <div className="payment-row-icon" style={{ backgroundColor: `${color}18`, color }}>
                  <Icon size={16} />
                </div>
                <div>
                  <div className="payment-row-name">{labels[s.method] || s.method}</div>
                  <div className="payment-row-count">{s.count} transaction{s.count === 1 ? '' : 's'}</div>
                </div>
              </div>
              <div className="payment-row-right">
                <div className="payment-row-val">{formatCurrency(s.total)}</div>
                <div className="payment-row-pct">{s.pct}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Dashboard Screen Component ──

export default function DashboardScreen() {
  const { currentUser } = useAuthStore();
  const toast = useToast();

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [chartMetric, setChartMetric] = useState('all');

  // Restock state
  const [restockProduct, setRestockProduct] = useState(null);
  const [addQty, setAddQty] = useState('');

  // Top products sort
  const [productSortBy, setProductSortBy] = useState('revenue'); // revenue, profit, sold, margin

  // Expense management state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [expenseForm, setExpenseForm] = useState({
    name: '',
    category: 'Packaging',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'hh:mm a'),
    notes: ''
  });

  // Transaction view state
  const [viewingOrder, setViewingOrder] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDashboardAnalytics(datePreset, customStart, customEnd);
      setAnalytics(data);
    } catch (err) {
      console.error('Dashboard financial load error:', err);
      toast.error('Failed to load dashboard data');
    }
    setLoading(false);
  }, [datePreset, customStart, customEnd, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Quick Restock
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
      toast.success(`Restocked ${qty} units for ${restockProduct.name}`);
      setRestockProduct(null);
      setAddQty('');
      loadData();
    } catch (err) {
      console.error('Failed to update stock:', err);
      toast.error('Failed to update stock');
    }
  };

  // Open Add/Edit Expense
  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      name: '',
      category: 'Packaging',
      amount: '',
      date: datePreset === 'yesterday'
        ? format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'hh:mm a'),
      notes: ''
    });
    setShowExpenseModal(true);
  };

  const handleOpenEditExpense = (exp) => {
    setEditingExpense(exp);
    setExpenseForm({
      name: exp.name || exp.description || '',
      category: exp.category || 'Packaging',
      amount: exp.amount || '',
      date: exp.date ? format(new Date(exp.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      time: exp.time || format(new Date(exp.createdAt || new Date()), 'hh:mm a'),
      notes: exp.notes || ''
    });
    setShowExpenseModal(true);
  };

  // Save Expense
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.name.trim()) {
      toast.error('Expense name is required');
      return;
    }
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    try {
      const payload = {
        name: expenseForm.name.trim(),
        description: expenseForm.name.trim(),
        category: expenseForm.category,
        amount: parseFloat(expenseForm.amount),
        date: expenseForm.date,
        time: expenseForm.time,
        notes: expenseForm.notes.trim(),
        createdBy: currentUser?.displayName || currentUser?.name || 'Owner'
      };

      if (editingExpense) {
        await db.expenses.update(editingExpense.id, {
          ...payload,
          updatedAt: new Date().toISOString()
        });
        toast.success('Expense updated');
      } else {
        await db.expenses.add({
          id: crypto.randomUUID(),
          ...payload,
          createdAt: new Date().toISOString()
        });
        toast.success('Expense recorded');
      }

      setShowExpenseModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to save expense:', err);
      toast.error('Failed to save expense');
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (exp) => {
    if (!window.confirm(`Delete expense "${exp.name || exp.description}" for ${formatCurrency(exp.amount)}?`)) {
      return;
    }
    try {
      await db.expenses.delete(exp.id);
      toast.info('Expense deleted');
      loadData();
    } catch (err) {
      console.error('Failed to delete expense:', err);
      toast.error('Failed to delete expense');
    }
  };

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    if (!analytics?.expenses) return [];
    return analytics.expenses.filter(exp => {
      const matchesCat = expenseCategoryFilter === 'all' || exp.category === expenseCategoryFilter;
      const searchTarget = `${exp.name || ''} ${exp.description || ''} ${exp.notes || ''} ${exp.category || ''}`.toLowerCase();
      const matchesSearch = !expenseSearch || searchTarget.includes(expenseSearch.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [analytics?.expenses, expenseCategoryFilter, expenseSearch]);

  // Sorted Top Products
  const sortedTopProducts = useMemo(() => {
    if (!analytics?.topProducts) return [];
    const list = [...analytics.topProducts];
    switch (productSortBy) {
      case 'profit':
        return list.sort((a, b) => b.totalProfit - a.totalProfit);
      case 'sold':
        return list.sort((a, b) => b.unitsSold - a.unitsSold);
      case 'margin':
        return list.sort((a, b) => b.marginPct - a.marginPct);
      case 'revenue':
      default:
        return list.sort((a, b) => b.totalSales - a.totalSales);
    }
  }, [analytics?.topProducts, productSortBy]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getActivePeriodLabel = () => {
    switch (datePreset) {
      case 'today':
        return `Today · ${format(new Date(), 'EEEE, MMMM d, yyyy')}`;
      case 'yesterday':
        return `Yesterday · ${format(new Date(Date.now() - 86400000), 'EEEE, MMMM d, yyyy')}`;
      case 'thisWeek':
        return 'This Week';
      case 'thisMonth':
        return `This Month · ${format(new Date(), 'MMMM yyyy')}`;
      case 'custom':
        return customStart && customEnd ? `${customStart} to ${customEnd}` : 'Custom Range';
      default:
        return 'Selected Period';
    }
  };

  if (loading && !analytics) {
    return (
      <div className="dashboard animate-fade-in">
        <div className="dashboard__header">
          <div>
            <h1 className="dashboard__greeting">{getGreeting()}, {currentUser?.name || 'Owner'}</h1>
            <p className="dashboard__subtitle">Calculating daily financial metrics...</p>
          </div>
        </div>
        <div className="dashboard__cards stagger-children">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="kpi-card skeleton" style={{ height: 110 }}></div>
          ))}
        </div>
      </div>
    );
  }

  const kpis = analytics?.kpis || {};
  const daily = analytics?.dailyPerformance || {};
  const scorecard = analytics?.profitability || {};

  return (
    <div className="dashboard animate-fade-in">
      {/* ════════════════════════════════════════════ */}
      {/* Top Header & Date Filter */}
      {/* ════════════════════════════════════════════ */}
      <div className="dashboard__header">
        <div>
          <div className="dashboard__status-tag">
            <span className="status-indicator-live" /> Daily Business Financial Control Center
          </div>
          <h1 className="dashboard__greeting">{getGreeting()}, {currentUser?.displayName || currentUser?.name || 'Owner'}</h1>
          <p className="dashboard__subtitle">{getActivePeriodLabel()}</p>
        </div>

        <div className="dashboard__header-actions">
          <div className="dashboard__date-controls">
            <div className="date-tabs">
              {[
                { key: 'today', label: 'Today' },
                { key: 'yesterday', label: 'Yesterday' },
                { key: 'thisWeek', label: 'This Week' },
                { key: 'thisMonth', label: 'This Month' }
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className={`date-tab ${datePreset === tab.key ? 'date-tab--active' : ''}`}
                  onClick={() => setDatePreset(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="date-custom">
              <input
                type="date"
                value={customStart}
                onChange={e => { setCustomStart(e.target.value); setDatePreset('custom'); }}
                className="date-input"
              />
              <span className="date-separator">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => { setCustomEnd(e.target.value); setDatePreset('custom'); }}
                className="date-input"
              />
            </div>
          </div>

          <div className="header-button-group">
            <button
              type="button"
              className="btn btn--secondary btn--icon-only"
              onClick={loadData}
              title="Refresh financial metrics"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* SECTION 1 — DAILY FINANCIAL SUMMARY (8 KPI CARDS) */}
      {/* ════════════════════════════════════════════ */}
      <div className="dashboard__cards-8">
        {/* 1. Total Sales */}
        <KpiCard
          icon={DollarSign}
          label="Total Sales"
          value={formatCurrency(kpis.totalSales)}
          change={kpis.totalSalesChange}
          color="#6366f1"
          bg="#eef2ff"
          subtitle="Net revenue after discounts"
        />

        {/* 2. COGS */}
        <KpiCard
          icon={Layers}
          label="COGS"
          value={formatCurrency(kpis.cogs)}
          change={kpis.cogsChange}
          color="#f59e0b"
          bg="#fffbeb"
          subtitle="Cost of products sold"
          invertChangeColors
        />

        {/* 3. Gross Profit */}
        <KpiCard
          icon={TrendingUp}
          label="Gross Profit"
          value={formatCurrency(kpis.grossProfit)}
          change={kpis.grossProfitChange}
          color="#10b981"
          bg="#ecfdf5"
          subtitle={`${kpis.grossMargin}% Gross Margin`}
        />

        {/* 4. Operating Expenses */}
        <KpiCard
          icon={Receipt}
          label="Operating Expenses"
          value={formatCurrency(kpis.operatingExpenses)}
          change={kpis.operatingExpensesChange}
          color="#ef4444"
          bg="#fef2f2"
          subtitle="Rent, supplies, utilities, etc."
          invertChangeColors
        />

        {/* 5. Net Income */}
        <KpiCard
          icon={Wallet}
          label="Net Income"
          value={formatCurrency(kpis.netIncome)}
          change={kpis.netIncomeChange}
          color="#8b5cf6"
          bg="#f5f3ff"
          subtitle="True take-home profit"
          isHighlight={kpis.netIncome >= 0}
          isNegative={kpis.netIncome < 0}
        />

        {/* 6. Profit Margin */}
        <KpiCard
          icon={BarChart3}
          label="Profit Margin"
          value={`${kpis.profitMargin}%`}
          change={kpis.profitMarginChange}
          color={kpis.profitMargin < 0 ? '#ef4444' : '#3b82f6'}
          bg={kpis.profitMargin < 0 ? '#fef2f2' : '#eff6ff'}
          subtitle="Net income / Total sales"
          isNegative={kpis.profitMargin < 0}
        />

        {/* 7. Orders */}
        <KpiCard
          icon={ShoppingBag}
          label="Orders"
          value={`${formatNumber(kpis.totalOrders)} Orders`}
          change={kpis.totalOrdersChange}
          color="#06b6d4"
          bg="#ecfeff"
          subtitle={`AOV: ${formatCurrency(kpis.aov)}`}
        />

        {/* 8. Items Sold */}
        <KpiCard
          icon={Activity}
          label="Items Sold"
          value={`${formatNumber(kpis.totalItemsSold)} Units`}
          change={kpis.totalItemsSoldChange}
          color="#84cc16"
          bg="#f7fee7"
          subtitle="Total product volume"
        />
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* SECTION 2 & 3 — FINANCIAL ANALYTICS REDESIGN */}
      {/* ════════════════════════════════════════════ */}
      <FinancialLineChart data={analytics?.chartData || []} />
      
      <div className="analytics-split">
        <ExpenseBreakdown categories={analytics?.expensesByCategory || []} total={kpis.operatingExpenses || 0} />
        <CompactFinancialSummary kpis={kpis} />
      </div>



      {/* ════════════════════════════════════════════ */}
      {/* SECTION 6 — EXPENSE MONITOR (FULL CRUD + CATEGORIES) */}
      {/* ════════════════════════════════════════════ */}
      <div className="dashboard__panel dashboard__panel--full">
        <div className="dashboard__panel-header">
          <div>
            <h3><ListMinus size={18} /> Business Operating Expenses</h3>
            <p className="text-secondary text-xs" style={{ marginTop: 2 }}>
              Store overhead expenses (Rent, Utilities, Packaging, Supplies) strictly tracked separately from COGS
            </p>
          </div>
          <div className="expense-header-actions">
            <span className="expense-total-badge font-bold">
              Total Expenses: {formatCurrency(kpis.operatingExpenses)}
            </span>
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={handleOpenAddExpense}
            >
              <Plus size={14} /> Add Expense
            </button>
          </div>
        </div>

        <div className="dashboard__panel-body">
          {(!analytics?.expenses || analytics.expenses.length === 0) ? (
            <div className="dashboard__empty">
              <Receipt size={36} />
              <p style={{ marginTop: 'var(--space-3)' }}>No business expenses logged for this period.</p>
              <button
                type="button"
                className="btn btn--primary mt-3"
                onClick={handleOpenAddExpense}
              >
                <Plus size={16} /> Log First Expense
              </button>
            </div>
          ) : (
            <div className="expense-monitor-layout">
              {/* Category Breakdown Progress Bars */}
              <div className="expense-categories-card">
                <h4 className="section-small-title">Expenses by Category</h4>
                <div className="category-bars-list">
                  {analytics.expensesByCategory.map(cat => (
                    <div key={cat.category} className="expense-cat-progress">
                      <div className="expense-cat-meta">
                        <span className="expense-cat-name">{cat.category}</span>
                        <span className="expense-cat-amount">{formatCurrency(cat.total)}</span>
                      </div>
                      <div className="expense-cat-track">
                        <div
                          className="expense-cat-fill"
                          style={{
                            width: `${cat.pct}%`,
                            backgroundColor: getCategoryColor(cat.category)
                          }}
                        />
                      </div>
                      <div className="expense-cat-sub">
                        <span>{cat.pct}% of total</span>
                        <span>{cat.count} item{cat.count === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Itemized Expense List with Controls */}
              <div className="expense-table-card">
                <div className="expense-toolbar">
                  <div className="search-bar expense-search">
                    <Search size={16} className="search-bar__icon" />
                    <input
                      type="search"
                      placeholder="Search expense description, category, or notes..."
                      value={expenseSearch}
                      onChange={e => setExpenseSearch(e.target.value)}
                    />
                  </div>

                  <select
                    className="category-filter-select"
                    value={expenseCategoryFilter}
                    onChange={e => setExpenseCategoryFilter(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    <option value="Packaging">Packaging</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Rent">Rent</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Operations">Operations</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="responsive-table-wrapper" style={{ maxHeight: 380, overflowY: 'auto' }}>
                  <table className="expense-itemized-table">
                    <thead>
                      <tr>
                        <th>Expense Name</th>
                        <th>Category</th>
                        <th>Date & Time</th>
                        <th>Notes</th>
                        <th className="text-right">Amount</th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map(exp => (
                        <tr key={exp.id}>
                          <td>
                            <div className="expense-title-cell">
                              <span
                                className="cat-dot"
                                style={{ backgroundColor: getCategoryColor(exp.category) }}
                              />
                              <span className="font-semibold text-main">{exp.name || exp.description}</span>
                            </div>
                          </td>
                          <td>
                            <span
                              className="cat-pill"
                              style={{
                                backgroundColor: `${getCategoryColor(exp.category)}18`,
                                color: getCategoryColor(exp.category)
                              }}
                            >
                              {exp.category}
                            </span>
                          </td>
                          <td className="text-secondary text-sm">
                            {exp.date ? format(new Date(exp.date), 'MMM dd, yyyy') : '—'}
                            {exp.time ? ` · ${exp.time}` : ''}
                          </td>
                          <td className="text-secondary text-xs max-w-xs truncate">{exp.notes || '—'}</td>
                          <td className="text-right font-semibold text-danger">
                            {formatCurrency(exp.amount)}
                          </td>
                          <td className="text-center">
                            <div className="table-actions-inline">
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => handleOpenEditExpense(exp)}
                                title="Edit Expense"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn-icon text-danger"
                                onClick={() => handleDeleteExpense(exp)}
                                title="Delete Expense"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* SECTION 7 & 8 — PAYMENT METHODS & TOP PRODUCTS */}
      {/* ════════════════════════════════════════════ */}
      <div className="dashboard__charts-row">
        {/* Payment Methods */}
        <div className="dashboard__panel">
          <div className="dashboard__panel-header">
            <h3><PieChart size={18} /> Payment Methods Distribution</h3>
            <span className="text-secondary text-xs">Actual collections for this period</span>
          </div>
          <div className="dashboard__panel-body">
            <PaymentDonut data={analytics?.paymentDistribution} />
          </div>
        </div>

        {/* Top Products Performance */}
        <div className="dashboard__panel">
          <div className="dashboard__panel-header">
            <h3><TrendingUp size={18} /> Top Products & Profitability</h3>
            <div className="top-product-tabs">
              {[
                { key: 'revenue', label: 'Revenue' },
                { key: 'profit', label: 'Gross Profit' },
                { key: 'sold', label: 'Units Sold' },
                { key: 'margin', label: 'Margin %' }
              ].map(sort => (
                <button
                  key={sort.key}
                  type="button"
                  className={`sort-tab ${productSortBy === sort.key ? 'sort-tab--active' : ''}`}
                  onClick={() => setProductSortBy(sort.key)}
                >
                  {sort.label}
                </button>
              ))}
            </div>
          </div>
          <div className="dashboard__panel-body">
            {(!sortedTopProducts || sortedTopProducts.length === 0) ? (
              <div className="dashboard__empty"><p>No product sales for this period.</p></div>
            ) : (
              <div className="top-products-enriched-list">
                {sortedTopProducts.slice(0, 6).map((item, i) => (
                  <div key={item.name} className="top-product-rich-item">
                    <span className={`top-product-rank rank-${i + 1}`}>#{i + 1}</span>
                    <div className="top-product-main">
                      <div className="top-product-header-line">
                        <span className="top-product-name">{item.name}</span>
                        <span className="top-product-sales font-bold">{formatCurrency(item.totalSales)}</span>
                      </div>
                      <div className="top-product-sub-line">
                        <span>{item.unitsSold} sold</span>
                        <span>COGS: {formatCurrency(item.totalCogs)}</span>
                        <span className="font-semibold text-success">Profit: {formatCurrency(item.totalProfit)}</span>
                        <span className="margin-pill">{item.marginPct}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* SECTION 9 — LOW STOCK ALERT */}
      {/* ════════════════════════════════════════════ */}
      <div className="dashboard__panel dashboard__panel--full">
        <div className="dashboard__panel-header">
          <h3><AlertTriangle size={18} /> Low Stock Alert</h3>
          <span className="text-secondary text-xs">Items requiring replenishment</span>
        </div>
        <div className="dashboard__panel-body">
          {(!analytics?.lowStockItems || analytics.lowStockItems.length === 0) ? (
            <div className="dashboard__empty dashboard__empty--success">
              <p>All items are well stocked! ✓</p>
            </div>
          ) : (
            <div className="lowstock-grid">
              {analytics.lowStockItems.slice(0, 8).map(item => (
                <div key={item.id} className="lowstock-card">
                  <div className="lowstock-card__top">
                    <span className="lowstock-card__name">{item.name}</span>
                    <span className={`status-badge status-badge--${item.stock === 0 ? 'danger' : 'warning'}`}>
                      {item.stock === 0 ? 'Out of Stock' : 'Low Stock'}
                    </span>
                  </div>
                  <div className="lowstock-card__mid">
                    <div className="stock-counter">
                      <span className="stock-number">{item.stock}</span>
                      <span className="stock-label">units left</span>
                    </div>
                    <span className="min-stock-hint">Min: {item.minStock || 10}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary btn--small w-full"
                    onClick={() => setRestockProduct(item)}
                  >
                    <Plus size={14} /> Quick Restock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* SECTION 10 — RECENT TRANSACTIONS TABLE */}
      {/* ════════════════════════════════════════════ */}
      <div className="dashboard__panel dashboard__panel--full">
        <div className="dashboard__panel-header">
          <div>
            <h3><Receipt size={18} /> Recent Transactions</h3>
            <p className="text-secondary text-xs" style={{ marginTop: 2 }}>
              {analytics?.isShowingAllRecent ? 'Showing latest transactions in database' : 'Transactions completed during the selected period'}
            </p>
          </div>
          <span className="badge badge--neutral">
            {analytics?.recentTransactions?.length || 0} Transactions
          </span>
        </div>

        <div className="dashboard__panel-body">
          {(!analytics?.recentTransactions || analytics.recentTransactions.length === 0) ? (
            <div className="dashboard__empty"><p>No transactions found for this period.</p></div>
          ) : (
            <div className="responsive-table-wrapper">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Receipt No.</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Cashier</th>
                    <th className="text-center">Items</th>
                    <th className="text-right">Subtotal</th>
                    <th className="text-right">Discount</th>
                    <th className="text-right">Total</th>
                    <th>Payment</th>
                    <th className="text-right">COGS</th>
                    <th className="text-right">Gross Profit</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recentTransactions.map(tx => (
                    <tr key={tx.id}>
                      <td className="font-semibold text-primary">{tx.orderNumber}</td>
                      <td>{format(new Date(tx.createdAt), 'MMM dd, yyyy')}</td>
                      <td className="text-secondary">{format(new Date(tx.createdAt), 'hh:mm a')}</td>
                      <td>{tx.cashierName || 'Cashier'}</td>
                      <td className="text-center font-medium">{tx.itemsCount || tx.items?.length || 1}</td>
                      <td className="text-right text-secondary">{formatCurrency(tx.subtotal || tx.total)}</td>
                      <td className="text-right text-secondary">{formatCurrency(tx.discount || 0)}</td>
                      <td className="text-right font-bold text-main">{formatCurrency(tx.total)}</td>
                      <td>
                        <span className={`payment-badge payment-badge--${(tx.paymentMethod || 'cash').toLowerCase()}`}>
                          {tx.paymentMethod?.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-right font-semibold text-warning">{formatCurrency(tx.cogs || 0)}</td>
                      <td className="text-right font-semibold text-success">{formatCurrency(tx.grossProfit || (tx.total - (tx.cogs || 0)))}</td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn btn--ghost btn--small btn--view"
                          onClick={() => setViewingOrder(tx)}
                          title="View complete financial transaction"
                        >
                          <Eye size={14} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* SECTION 11 — FINANCIAL TRANSACTION DETAILS MODAL */}
      {/* ════════════════════════════════════════════ */}
      <Modal
        isOpen={!!viewingOrder}
        onClose={() => setViewingOrder(null)}
        title={`Transaction Details — ${viewingOrder?.orderNumber}`}
        size="lg"
      >
        {viewingOrder && (
          <div className="transaction-detail-modal">
            <div className="tx-modal-header-grid">
              <div className="tx-meta-item">
                <span className="text-secondary text-xs uppercase">Receipt No:</span>
                <span className="font-bold text-primary">{viewingOrder.orderNumber}</span>
              </div>
              <div className="tx-meta-item">
                <span className="text-secondary text-xs uppercase">Date & Time:</span>
                <span>{format(new Date(viewingOrder.createdAt), 'MMM dd, yyyy · hh:mm a')}</span>
              </div>
              <div className="tx-meta-item">
                <span className="text-secondary text-xs uppercase">Cashier:</span>
                <span>{viewingOrder.cashierName || 'Owner'}</span>
              </div>
              <div className="tx-meta-item">
                <span className="text-secondary text-xs uppercase">Payment Method:</span>
                <span className="font-semibold uppercase">{viewingOrder.paymentMethod}</span>
              </div>
            </div>

            <div className="tx-items-section">
              <h4 className="section-small-title">Itemized Line Products & Profitability</h4>
              <table className="tx-items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Selling Price</th>
                    <th className="text-right">Unit Cost</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">COGS</th>
                    <th className="text-right">Gross Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewingOrder.items || []).map((item, idx) => {
                    const lineRevenue = item.subtotal || (item.price * item.quantity);
                    const lineCogs = (item.cost || 0) * item.quantity;
                    const lineProfit = lineRevenue - lineCogs;
                    return (
                      <tr key={idx}>
                        <td className="font-semibold">{item.name}</td>
                        <td className="text-center font-medium">{item.quantity}</td>
                        <td className="text-right">{formatCurrency(item.price)}</td>
                        <td className="text-right text-secondary">{formatCurrency(item.cost || 0)}</td>
                        <td className="text-right font-medium">{formatCurrency(lineRevenue)}</td>
                        <td className="text-right text-warning">{formatCurrency(lineCogs)}</td>
                        <td className="text-right font-semibold text-success">{formatCurrency(lineProfit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="tx-summary-panel">
              <div className="tx-summary-row">
                <span>Subtotal</span>
                <span>{formatCurrency(viewingOrder.subtotal || viewingOrder.total)}</span>
              </div>
              {viewingOrder.discount > 0 && (
                <div className="tx-summary-row text-danger">
                  <span>Discount</span>
                  <span>−{formatCurrency(viewingOrder.discount)}</span>
                </div>
              )}
              <div className="tx-summary-row tx-summary-row--total">
                <span>Total Amount Paid</span>
                <span>{formatCurrency(viewingOrder.total)}</span>
              </div>
              <div className="tx-summary-row text-warning">
                <span>Total Transaction COGS</span>
                <span>−{formatCurrency(viewingOrder.cogs || 0)}</span>
              </div>
              <div className="tx-summary-row text-success font-bold" style={{ fontSize: '1.05rem', borderTop: '1px dashed var(--color-border)' }}>
                <span>Transaction Gross Profit</span>
                <span>{formatCurrency(viewingOrder.grossProfit || (viewingOrder.total - (viewingOrder.cogs || 0)))}</span>
              </div>
              {viewingOrder.amountReceived && (
                <div className="tx-summary-row text-secondary text-xs pt-2">
                  <span>Amount Received: {formatCurrency(viewingOrder.amountReceived)}</span>
                  <span>Change: {formatCurrency(viewingOrder.change || 0)}</span>
                </div>
              )}
            </div>

            <div className="form-actions mt-4">
              <button type="button" className="btn btn--ghost" onClick={() => setViewingOrder(null)}>
                Close
              </button>
              <button type="button" className="btn btn--primary" onClick={() => window.print()}>
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ════════════════════════════════════════════ */}
      {/* ADD / EDIT EXPENSE MODAL */}
      {/* ════════════════════════════════════════════ */}
      <Modal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        title={editingExpense ? 'Edit Business Expense' : 'Record Operating Expense'}
        size="md"
      >
        <form onSubmit={handleSaveExpense} className="expense-form">
          <div className="form-group">
            <label>Expense Name / Description <span className="text-danger">*</span></label>
            <input
              type="text"
              required
              placeholder="e.g. Biodegradable Takeout Packaging"
              value={expenseForm.name}
              onChange={e => setExpenseForm(prev => ({ ...prev, name: e.target.value }))}
              autoFocus
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Category <span className="text-danger">*</span></label>
              <select
                value={expenseForm.category}
                onChange={e => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
              >
                <option value="Packaging">Packaging</option>
                <option value="Transportation">Transportation</option>
                <option value="Supplies">Supplies</option>
                <option value="Utilities">Utilities</option>
                <option value="Rent">Rent</option>
                <option value="Marketing">Marketing</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Operations">Operations</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Amount (₱) <span className="text-danger">*</span></label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="599.00"
                value={expenseForm.amount}
                onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Date <span className="text-danger">*</span></label>
              <input
                type="date"
                required
                value={expenseForm.date}
                onChange={e => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Time</label>
              <input
                type="text"
                placeholder="e.g. 04:00 PM"
                value={expenseForm.time}
                onChange={e => setExpenseForm(prev => ({ ...prev, time: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Notes / Receipt Reference (Optional)</label>
            <textarea
              rows={2}
              placeholder="Receipt or vendor notes..."
              value={expenseForm.notes}
              onChange={e => setExpenseForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setShowExpenseModal(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editingExpense ? 'Update Expense' : 'Record Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ════════════════════════════════════════════ */}
      {/* QUICK RESTOCK MODAL */}
      {/* ════════════════════════════════════════════ */}
      <Modal
        isOpen={!!restockProduct}
        onClose={() => { setRestockProduct(null); setAddQty(''); }}
        title="Quick Restock"
        size="sm"
      >
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
              <input
                type="number"
                min="1"
                step="1"
                required
                value={addQty}
                onChange={e => setAddQty(e.target.value)}
                placeholder="e.g. 50"
                autoFocus
              />
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setRestockProduct(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn--primary">
                Update Stock
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

// ── Reusable KPI Card Component ──

function KpiCard({ icon: Icon, label, value, change, color, bg, subtitle, isHighlight, isNegative, invertChangeColors }) {
  const hasChange = change !== undefined && change !== null && !isNaN(change);
  // If invertChangeColors is true (like expenses/costs), lower is positive (green) and higher is negative (red)
  const isPositive = invertChangeColors ? change <= 0 : change >= 0;

  return (
    <div
      className={`kpi-card ${isHighlight ? 'kpi-card--highlight' : ''} ${isNegative ? 'kpi-card--negative' : ''}`}
      style={{ '--kpi-color': color, '--kpi-bg': bg }}
    >
      <div className="kpi-card__top">
        <span className="kpi-card__label">{label}</span>
        <div className="kpi-card__icon">
          <Icon size={20} />
        </div>
      </div>
      <div className="kpi-card__body">
        <span className="kpi-card__value">{value}</span>
        {hasChange && (
          <span className={`kpi-card__change ${change === 100 && value !== '₱0.00' && value !== '0 Units' && value !== '0 Orders' ? 'kpi-card__change--up' : isPositive ? 'kpi-card__change--up' : 'kpi-card__change--down'}`}>
            {change === 100 && (value !== '₱0.00' && value !== '0 Units' && value !== '0 Orders' && value !== '0%') ? (
              <span>New</span>
            ) : change === 0 ? (
              <span>—</span>
            ) : (
              <>
                {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                <span>{Math.abs(change)}% vs prev</span>
              </>
            )}
          </span>
        )}
      </div>
      {subtitle && <span className="kpi-card__subtitle">{subtitle}</span>}
    </div>
  );
}

// ── Category Color Map Helper ──

function getCategoryColor(category) {
  const map = {
    Packaging: '#8b5cf6',
    Transportation: '#06b6d4',
    Supplies: '#3b82f6',
    Utilities: '#f59e0b',
    Rent: '#ec4899',
    Marketing: '#f97316',
    Maintenance: '#ef4444',
    Operations: '#6366f1',
    Other: '#64748b'
  };
  return map[category] || '#64748b';
}
