import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, ShoppingBag, TrendingUp,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight,
  Eye, Activity, Wallet, Banknote,
  Smartphone, Receipt, Building2,
  RefreshCw, Layers, Printer
} from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, formatNumber } from '../../db/database';
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

// ── 3 Categories of Bills Payment & Collections Card ──

function PaymentDonut({ data }) {
  if (!data || !data.methods || data.methods.length === 0) {
    return (
      <div className="payment-empty">
        <p>No billing or payment records for this period</p>
      </div>
    );
  }

  const colors = {
    cash: '#10b981',
    bank_transfer: '#8b5cf6',
    ewallet: '#007dfa',
    other: '#64748b'
  };

  const labels = {
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    ewallet: 'E-Wallet (GCash / Maya)',
    other: 'Other'
  };

  const subtitles = {
    cash: 'Physical bills & coins',
    bank_transfer: 'BDO, BPI, UnionBank, etc.',
    ewallet: 'GCash & Maya digital payments',
    other: 'Other collections'
  };

  const icons = {
    cash: Banknote,
    bank_transfer: Building2,
    ewallet: Smartphone,
    other: Wallet
  };

  return (
    <div className="payment-card-body">
      <div className="payment-total-banner">
        <div>
          <span className="text-secondary text-xs font-medium uppercase tracking-wide">Total Bills & Collections</span>
          <div className="payment-total-amount">{formatCurrency(data.totalCollected)}</div>
        </div>
        <div className="payment-3-cat-pills">
          <span className="badge badge--success">Cash</span>
          <span className="badge badge--primary">Bank Transfer</span>
          <span className="badge badge--info">GCash / Maya</span>
        </div>
      </div>

      {/* 3 Categories Mini Cards */}
      <div className="payment-3-kpi-row">
        {data.methods.map(s => {
          const Icon = icons[s.method] || icons.other;
          const color = colors[s.method] || colors.other;
          return (
            <div
              key={s.method}
              className="payment-cat-kpi"
              style={{ '--kpi-border': color }}
            >
              <div className="payment-cat-kpi__header">
                <div className="payment-cat-kpi__icon" style={{ backgroundColor: `${color}18`, color }}>
                  <Icon size={16} />
                </div>
                <span className="payment-cat-kpi__pct">{s.pct}%</span>
              </div>
              <div className="payment-cat-kpi__total">{formatCurrency(s.total)}</div>
              <div className="payment-cat-kpi__name">{labels[s.method] || s.method}</div>
              <div className="payment-cat-kpi__count">{s.count} bill{s.count === 1 ? '' : 's'} paid</div>
            </div>
          );
        })}
      </div>

      {/* Distribution Segment Bar */}
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

      {/* Itemized Legend List */}
      <div className="payment-legend-list">
        {data.methods.map(s => {
          const Icon = icons[s.method] || icons.other;
          const color = colors[s.method] || colors.other;
          return (
            <div key={s.method} className="payment-row-item">
              <div className="payment-row-left">
                <div className="payment-row-icon" style={{ backgroundColor: `${color}18`, color }}>
                  <Icon size={18} />
                </div>
                <div>
                  <div className="payment-row-name font-bold">{labels[s.method] || s.method}</div>
                  <div className="payment-row-count text-xs text-secondary">
                    {subtitles[s.method] || subtitles.other} · {s.count} transaction{s.count === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
              <div className="payment-row-right">
                <div className="payment-row-val font-bold" style={{ color }}>{formatCurrency(s.total)}</div>
                <div className="payment-row-pct badge" style={{ backgroundColor: `${color}18`, color }}>
                  {s.pct}%
                </div>
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
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="kpi-card skeleton" style={{ height: 110 }}></div>
          ))}
        </div>
      </div>
    );
  }

  const kpis = analytics?.kpis || {};

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

        {/* Orders */}
        <KpiCard
          icon={ShoppingBag}
          label="Orders"
          value={`${formatNumber(kpis.totalOrders)} Orders`}
          change={kpis.totalOrdersChange}
          color="#06b6d4"
          bg="#ecfeff"
          subtitle={`AOV: ${formatCurrency(kpis.aov)}`}
        />
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* SECTION 2 & 3 — FINANCIAL ANALYTICS REDESIGN */}
      {/* ════════════════════════════════════════════ */}
      <FinancialLineChart data={analytics?.chartData || []} />

      <div className="analytics-split">
        <CompactFinancialSummary kpis={kpis} />

        {/* Bills Payment & Collections — 3 Categories */}
        <div className="dashboard__panel">
          <div className="dashboard__panel-header">
            <h3><PieChart size={18} /> Bills Payment &amp; Collections</h3>
            <span className="text-secondary text-xs">Cash · Bank Transfer · E-Wallet</span>
          </div>
          <div className="dashboard__panel-body">
            <PaymentDonut data={analytics?.paymentDistribution} />
          </div>
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
          <Icon size={18} />
        </div>
      </div>
      <div className="kpi-card__value-wrap">
        <span className="kpi-card__value">{value}</span>
      </div>
      <div className="kpi-card__bottom">
        <span className="kpi-card__subtitle" title={subtitle || ''}>{subtitle || ''}</span>
        {hasChange && (
          <span className={`kpi-card__change ${change === 100 && value !== '₱0.00' && value !== '0 Units' && value !== '0 Orders' ? 'kpi-card__change--up' : isPositive ? 'kpi-card__change--up' : 'kpi-card__change--down'}`}>
            {change === 100 && (value !== '₱0.00' && value !== '0 Units' && value !== '0 Orders' && value !== '0%') ? (
              <span>New</span>
            ) : change === 0 ? (
              <span>—</span>
            ) : (
              <>
                {change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                <span>{Math.abs(change)}%</span>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}


