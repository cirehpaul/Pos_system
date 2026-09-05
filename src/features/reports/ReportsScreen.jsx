import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Download, Calendar, Search, Filter,
  DollarSign, TrendingUp, ShoppingBag, Wallet, ChevronLeft, ChevronRight,
  Plus, Clock, FileText, User
} from 'lucide-react';
import { format } from 'date-fns';
import db, { formatCurrency, formatNumber } from '../../db/database';
import { getReportsAnalytics } from '../../db/analyticsService';
import { useToast } from '../../components/Toast/Toast';
import Modal from '../../components/Modal/Modal';
import './ReportsScreen.css';

export default function ReportsScreen() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [datePreset, setDatePreset] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [cashierFilter, setCashierFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getReportsAnalytics({
        preset: datePreset,
        customStart,
        customEnd,
        paymentMethod: paymentFilter,
        cashier: cashierFilter
      });
      setData(result);
      setPage(1);
    } catch (err) {
      console.error('Reports load error:', err);
    }
    setLoading(false);
  }, [datePreset, customStart, customEnd, paymentFilter, cashierFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExport = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = await import('file-saver');
      
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sales Report');

      // Report metadata
      const range = data?.range;
      ws.addRow(['FoodPOS — Sales Report']);
      ws.addRow(['From Date:', range ? format(new Date(range.start), 'MMM dd, yyyy hh:mm a') : '—']);
      ws.addRow(['To Date:', range ? format(new Date(range.end), 'MMM dd, yyyy hh:mm a') : '—']);
      ws.addRow(['Generated:', format(new Date(), 'MMM dd, yyyy hh:mm a')]);
      ws.addRow([]);

      // Header row
      ws.columns = [
        { header: 'Order No.', key: 'orderNumber', width: 18 },
        { header: 'Date & Time', key: 'date', width: 22 },
        { header: 'Cashier', key: 'cashier', width: 15 },
        { header: 'Role', key: 'role', width: 10 },
        { header: 'Items', key: 'items', width: 10 },
        { header: 'Payment', key: 'payment', width: 12 },
        { header: 'Subtotal', key: 'subtotal', width: 15 },
        { header: 'Total', key: 'total', width: 15 }
      ];

      // Re-add header row (columns set above applies to row 1, so we re-set for row 6)
      const headerRow = ws.addRow(['Order No.', 'Date & Time', 'Cashier', 'Role', 'Items', 'Payment', 'Subtotal', 'Total']);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };

      filteredOrders.forEach(order => {
        ws.addRow([
          order.orderNumber,
          format(new Date(order.createdAt), 'MMM dd, yyyy hh:mm a'),
          order.cashierName || 'Unknown',
          order.cashierRole || '—',
          order.items?.length || 0,
          order.paymentMethod === 'gcash' ? 'GCash' : 'Cash',
          order.subtotal || order.total,
          order.total
        ]);
      });

      // Summary
      ws.addRow([]);
      ws.addRow(['SUMMARY']);
      ws.addRow(['Gross Sales', '', '', '', '', '', '', fin.grossSales]);
      ws.addRow(['Net Sales', '', '', '', '', '', '', fin.netSales]);
      ws.addRow(['COGS', '', '', '', '', '', '', fin.cogs]);
      ws.addRow(['Gross Profit', '', '', '', '', '', '', fin.grossProfit]);
      ws.addRow(['Net Income', '', '', '', '', '', '', fin.netIncome]);

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `FoodPOS_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('Report exported!');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export');
    }
  };

  if (loading && !data) {
    return (
      <div className="reports-page animate-fade-in">
        <div className="page-header"><div><h1>Sales Reports</h1><p>Analyze your business performance</p></div></div>
        <div className="reports-kpis stagger-children">
          {[1,2,3,4,5,6].map(i => <div key={i} className="report-kpi skeleton" style={{ height: 90 }} />)}
        </div>
      </div>
    );
  }

  const orders = data?.orders || [];
  const fin = data?.financials || {};
  const range = data?.range;

  // Client-side search on top of server filters
  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.orderNumber?.toLowerCase().includes(q) ||
      o.cashierName?.toLowerCase().includes(q) ||
      (o.items || []).some(i => i.name?.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(filteredOrders.length / perPage);
  const paginatedOrders = filteredOrders.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="reports-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Sales Reports</h1>
          <p>Analyze your business performance</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={handleExport}>
            <Download size={16} /> Export to Excel
          </button>
        </div>
      </div>

      {/* ── Report Date Range Banner ── */}
      <div className="report-date-banner">
        <div className="report-date-banner__item">
          <FileText size={16} />
          <span className="report-date-banner__label">Report Period</span>
        </div>
        <div className="report-date-banner__dates">
          <div className="report-date-banner__field">
            <span className="report-date-banner__field-label">From Date</span>
            <span className="report-date-banner__field-value">
              {range ? format(new Date(range.start), 'MMMM dd, yyyy — hh:mm a') : '—'}
            </span>
          </div>
          <span className="report-date-banner__separator">→</span>
          <div className="report-date-banner__field">
            <span className="report-date-banner__field-label">To Date</span>
            <span className="report-date-banner__field-value">
              {range ? format(new Date(range.end), 'MMMM dd, yyyy — hh:mm a') : '—'}
            </span>
          </div>
        </div>
        <div className="report-date-banner__generated">
          <Clock size={14} />
          <span>Generated: {format(new Date(), 'MMM dd, yyyy — hh:mm a')}</span>
        </div>
      </div>

      {/* Date Presets */}
      <div className="reports-date-bar">
        <div className="date-tabs">
          {[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'thisWeek', label: 'This Week' },
            { key: 'thisMonth', label: 'This Month' },
            { key: 'lastMonth', label: 'Last Month' }
          ].map(tab => (
            <button key={tab.key}
              className={`date-tab ${datePreset === tab.key ? 'date-tab--active' : ''}`}
              onClick={() => setDatePreset(tab.key)}
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

      {/* KPI Cards */}
      <div className="reports-kpis stagger-children">
        <div className="report-kpi">
          <DollarSign size={18} className="report-kpi__icon" style={{ color: '#6366f1' }} />
          <div>
            <span className="report-kpi__label">Gross Sales</span>
            <span className="report-kpi__value">{formatCurrency(fin.grossSales)}</span>
          </div>
        </div>
        <div className="report-kpi">
          <TrendingUp size={18} className="report-kpi__icon" style={{ color: '#3b82f6' }} />
          <div>
            <span className="report-kpi__label">Net Sales</span>
            <span className="report-kpi__value">{formatCurrency(fin.netSales)}</span>
          </div>
        </div>
        <div className="report-kpi">
          <BarChart3 size={18} className="report-kpi__icon" style={{ color: '#f59e0b' }} />
          <div>
            <span className="report-kpi__label">COGS</span>
            <span className="report-kpi__value">{formatCurrency(fin.cogs)}</span>
          </div>
        </div>
        <div className="report-kpi">
          <TrendingUp size={18} className="report-kpi__icon" style={{ color: '#10b981' }} />
          <div>
            <span className="report-kpi__label">Gross Profit</span>
            <span className="report-kpi__value">{formatCurrency(fin.grossProfit)}</span>
          </div>
        </div>
        <div className="report-kpi">
          <Wallet size={18} className="report-kpi__icon" style={{ color: '#8b5cf6' }} />
          <div>
            <span className="report-kpi__label">Net Income</span>
            <span className="report-kpi__value">{formatCurrency(fin.netIncome)}</span>
          </div>
        </div>
        <div className="report-kpi">
          <ShoppingBag size={18} className="report-kpi__icon" style={{ color: '#ef4444' }} />
          <div>
            <span className="report-kpi__label">Orders</span>
            <span className="report-kpi__value">{formatNumber(fin.totalOrders)}</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="reports-filters">
        <div className="search-bar">
          <Search size={18} className="search-bar__icon" />
          <input type="search" placeholder="Search orders..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="filter-select">
          <Filter size={16} className="filter-select__icon" />
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
            <option value="all">All Methods</option>
            {(data?.uniquePaymentMethods || []).map(m => (
              <option key={m} value={m}>{m === 'gcash' ? 'GCash' : m === 'cash' ? 'Cash' : m}</option>
            ))}
          </select>
        </div>
        <div className="filter-select">
          <User size={16} className="filter-select__icon" />
          <select value={cashierFilter} onChange={e => setCashierFilter(e.target.value)}>
            <option value="all">All Cashiers</option>
            {(data?.uniqueCashiers || []).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="reports-table-container">
        {filteredOrders.length === 0 ? (
          <div className="empty-state">
            <Calendar size={48} />
            <h3>No transactions found</h3>
            <p>Try adjusting your filters or date range.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order No.</th>
                    <th>Date & Time</th>
                    <th>Cashier</th>
                    <th>Items</th>
                    <th>Method</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map(order => (
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
                          {order.paymentMethod === 'gcash' ? 'GCash' : 'Cash'}
                        </span>
                      </td>
                      <td className="text-right font-semibold">{formatCurrency(order.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <span className="pagination__info">
                  Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filteredOrders.length)} of {filteredOrders.length}
                </span>
                <div className="pagination__controls">
                  <button className="pagination__btn" disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <span className="pagination__page">Page {page} of {totalPages}</span>
                  <button className="pagination__btn" disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}>
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>


    </div>
  );
}
