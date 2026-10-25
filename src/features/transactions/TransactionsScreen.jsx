import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownCircle, ArrowUpCircle, Receipt, Plus, Search,
  Filter, Eye, XCircle, Mail, Printer, ChevronLeft, 
  ChevronRight, Users, UserPlus, Edit3, Trash2, Save,
  Copy, CheckCircle, FileText, Banknote, Coins, Calculator,
  RotateCcw, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  Clock, DollarSign, Sparkles, LayoutDashboard, Building2, Smartphone
} from 'lucide-react';
import { format } from 'date-fns';
import useAuthStore from '../../stores/authStore';
import useTransactionStore from '../../stores/transactionStore';
import { formatCurrency, formatNumber } from '../../db/database';
import { useToast } from '../../components/Toast/Toast';
import Modal from '../../components/Modal/Modal';
import './TransactionsScreen.css';

const BANK_OPTIONS = ['BDO', 'BPI', 'UnionBank', 'Metrobank', 'Security Bank', 'Landbank', 'Other Bank'];
const EWALLET_OPTIONS = [
  { id: 'gcash', name: 'GCash', color: '#007dfa' },
  { id: 'maya', name: 'Maya', color: '#00d632' }
];

const TRANSACTION_TYPES = [
  { value: 'cash_in', label: 'Cash In', icon: ArrowDownCircle, color: '#10b981' },
  { value: 'cash_out', label: 'Cash Out', icon: ArrowUpCircle, color: '#ef4444' },
  { value: 'bills_payment', label: 'Bills Payment', icon: Receipt, color: '#6366f1' },
];

const BILL_TYPES = [
  'Electric Bill', 'Water Bill', 'Internet Bill', 'Phone Bill',
  'Cable TV', 'Insurance', 'Loan Payment', 'Government', 'Credit Card', 'Other'
];

const DENOMINATIONS = [
  { label: '₱1,000 Bill', value: 1000, type: 'bill' },
  { label: '₱500 Bill', value: 500, type: 'bill' },
  { label: '₱200 Bill', value: 200, type: 'bill' },
  { label: '₱100 Bill', value: 100, type: 'bill' },
  { label: '₱50 Bill', value: 50, type: 'bill' },
  { label: '₱20 Bill', value: 20, type: 'bill' },
  { label: '₱20 Coin', value: 20, type: 'coin' },
  { label: '₱10 Coin', value: 10, type: 'coin' },
  { label: '₱5 Coin', value: 5, type: 'coin' },
  { label: '₱1 Coin', value: 1, type: 'coin' },
  { label: '¢25 Centavo', value: 0.25, type: 'coin' },
];

export default function TransactionsScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const { currentUser } = useAuthStore();
  const {
    transactions, loadTransactions, createTransaction, voidTransaction,
    clients, loadClients, addClient, updateClient, deleteClient,
    cashAudits, loadCashAudits, saveCashAudit, deleteCashAudit, getCashSummary,
    resetAllTransactions
  } = useTransactionStore();

  // Active view: 'transactions' | 'check_money' | 'clients'
  const [activeView, setActiveView] = useState('transactions');

  // ── Transaction state ──
  const [txnFilter, setTxnFilter] = useState({ type: 'all', search: '', dateFrom: '', dateTo: '' });
  const [txnPage, setTxnPage] = useState(1);
  const txnPerPage = 12;

  // New Transaction modal
  const [showTxnModal, setShowTxnModal] = useState(false);
  const [selectedType, setSelectedType] = useState('cash_in');
  const [txnForm, setTxnForm] = useState({
    clientName: '', clientEmail: '', clientContact: '',
    amount: '', description: '', billType: '', accountNumber: '',
    paymentCategory: 'cash',
    bankName: 'BDO', bankRef: '',
    ewalletProvider: 'gcash', ewalletRef: '',
    cashTendered: '',
    clientId: null, isWalkIn: true
  });

  // Receipt modal
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [copiedRef, setCopiedRef] = useState(false);

  // ── Client state ──
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientForm, setClientForm] = useState({ name: '', email: '', contact: '' });
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientSearchRef = useRef(null);

  // ── Check Money state ──
  const [moneyPeriod, setMoneyPeriod] = useState('all'); // 'today' | 'this_week' | 'all'
  const [cashSummary, setCashSummary] = useState({
    totalCashIn: 0, countCashIn: 0,
    totalCashOut: 0, countCashOut: 0,
    totalBillsPayment: 0, countBills: 0,
    totalPosCashSales: 0, countPosSales: 0,
    expectedCashOnHand: 0, totalTransactions: 0
  });

  // Physical denomination counter counts { [value]: quantity }
  const [denomCounts, setDenomCounts] = useState(() => {
    const init = {};
    DENOMINATIONS.forEach(d => { init[d.value] = 0; });
    return init;
  });
  const [auditNotes, setAuditNotes] = useState('');
  const [savingAudit, setSavingAudit] = useState(false);

  // ── Fetch summary based on period ──
  const refreshCashSummary = useCallback(async () => {
    let dateFrom = '';
    const now = new Date();
    if (moneyPeriod === 'today') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (moneyPeriod === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      dateFrom = new Date(now.setDate(diff)).toISOString();
    }
    const summary = await getCashSummary({ dateFrom });
    setCashSummary(summary);
  }, [moneyPeriod, getCashSummary]);

  // Load initial data
  useEffect(() => {
    loadTransactions(txnFilter);
    loadClients();
    loadCashAudits();
  }, []);

  useEffect(() => {
    loadTransactions(txnFilter);
    setTxnPage(1);
  }, [txnFilter, loadTransactions]);

  useEffect(() => {
    if (activeView === 'check_money') {
      refreshCashSummary();
      loadCashAudits();
    }
  }, [activeView, moneyPeriod, refreshCashSummary, loadCashAudits]);

  // ── Transaction Handlers ──

  const openNewTransaction = (type) => {
    setSelectedType(type);
    setTxnForm({
      clientName: '', clientEmail: '', clientContact: '',
      amount: '', description: '', billType: '', accountNumber: '',
      paymentCategory: 'cash',
      bankName: 'BDO', bankRef: '',
      ewalletProvider: 'gcash', ewalletRef: '',
      cashTendered: '',
      clientId: null, isWalkIn: true
    });
    setClientSearch('');
    setShowTxnModal(true);
  };

  const selectClient = (client) => {
    setTxnForm(prev => ({
      ...prev,
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email || '',
      clientContact: client.contact || '',
      isWalkIn: false
    }));
    setClientSearch(client.name);
    setShowClientDropdown(false);
  };

  const switchToWalkIn = () => {
    setTxnForm(prev => ({
      ...prev,
      clientId: null,
      clientName: '',
      clientEmail: '',
      clientContact: '',
      isWalkIn: true
    }));
    setClientSearch('');
  };

  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    if (!txnForm.clientName.trim()) { toast.error('Client name is required'); return; }
    if (!txnForm.amount || parseFloat(txnForm.amount) <= 0) { toast.error('Valid amount is required'); return; }
    if (selectedType === 'bills_payment' && !txnForm.billType) { toast.error('Bill type is required'); return; }

    let paymentDetails = {};
    if (txnForm.paymentCategory === 'cash') {
      const tendered = parseFloat(txnForm.cashTendered || txnForm.amount || 0);
      paymentDetails = {
        cashTendered: tendered,
        change: Math.max(0, tendered - parseFloat(txnForm.amount || 0))
      };
    } else if (txnForm.paymentCategory === 'bank_transfer') {
      paymentDetails = {
        bankName: txnForm.bankName,
        reference: txnForm.bankRef
      };
    } else if (txnForm.paymentCategory === 'ewallet') {
      paymentDetails = {
        provider: txnForm.ewalletProvider,
        reference: txnForm.ewalletRef
      };
    }

    const result = await createTransaction({
      type: selectedType,
      amount: txnForm.amount,
      clientId: txnForm.clientId,
      clientName: txnForm.clientName.trim(),
      clientEmail: txnForm.clientEmail.trim(),
      clientContact: txnForm.clientContact.trim(),
      description: txnForm.description.trim(),
      billType: txnForm.billType,
      accountNumber: txnForm.accountNumber.trim(),
      paymentCategory: selectedType === 'bills_payment' ? txnForm.paymentCategory : 'cash',
      paymentMethod: selectedType === 'bills_payment' ? (txnForm.paymentCategory === 'ewallet' ? txnForm.ewalletProvider : txnForm.paymentCategory) : 'cash',
      paymentDetails,
      cashierId: currentUser?.id,
      cashierName: currentUser?.displayName || currentUser?.name
    });

    if (result.success) {
      toast.success('Transaction catered successfully');
      setShowTxnModal(false);
      setReceiptData(result.transaction);
      setShowReceipt(true);
      refreshCashSummary();
    }
  };

  const handleVoid = async (txn) => {
    if (!window.confirm(`Void transaction ${txn.referenceNumber}? This cannot be undone.`)) return;
    const result = await voidTransaction(txn.id);
    if (result.success) {
      toast.success('Transaction voided');
      refreshCashSummary();
    } else {
      toast.error(result.message);
    }
  };

  const viewReceipt = (txn) => {
    setReceiptData(txn);
    setShowReceipt(true);
  };

  const copyReference = (ref) => {
    navigator.clipboard.writeText(ref);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
    toast.success('Reference number copied');
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleSendEmail = async (txn) => {
    if (!txn.clientEmail) {
      toast.error('No email address provided for this client');
      return;
    }
    const subject = encodeURIComponent(`Transaction Receipt — ${txn.referenceNumber}`);
    const body = encodeURIComponent(
      `Transaction Receipt\n` +
      `════════════════════════════════\n\n` +
      `Reference: ${txn.referenceNumber}\n` +
      `Date: ${format(new Date(txn.createdAt), 'MMMM dd, yyyy — hh:mm a')}\n` +
      `Type: ${txn.type === 'cash_in' ? 'Cash In' : txn.type === 'cash_out' ? 'Cash Out' : 'Bills Payment'}\n` +
      `Amount: ${formatCurrency(txn.amount)}\n\n` +
      `Client: ${txn.clientName}\n` +
      (txn.billType ? `Bill Type: ${txn.billType}\n` : '') +
      (txn.accountNumber ? `Account No: ${txn.accountNumber}\n` : '') +
      (txn.description ? `Notes: ${txn.description}\n` : '') +
      `\nProcessed by: ${txn.cashierName}\n` +
      `Status: ${txn.status === 'completed' ? 'Completed' : 'Voided'}\n\n` +
      `Thank you for transacting with us!`
    );
    window.open(`mailto:${txn.clientEmail}?subject=${subject}&body=${body}`, '_blank');
    toast.success(`Opening email client for ${txn.clientEmail}`);
  };

  // ── Client Handlers ──

  const openCreateClient = () => {
    setEditingClient(null);
    setClientForm({ name: '', email: '', contact: '' });
    setShowClientModal(true);
  };

  const openEditClient = (client) => {
    setEditingClient(client);
    setClientForm({ name: client.name, email: client.email || '', contact: client.contact || '' });
    setShowClientModal(true);
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    if (!clientForm.name.trim()) { toast.error('Name is required'); return; }

    let result;
    if (editingClient) {
      result = await updateClient(editingClient.id, clientForm);
    } else {
      result = await addClient(clientForm);
    }

    if (result.success) {
      toast.success(editingClient ? 'Client updated' : 'Client added');
      setShowClientModal(false);
    }
  };

  const handleDeleteClient = async (client) => {
    if (!window.confirm(`Delete client "${client.name}"?`)) return;
    await deleteClient(client.id);
    toast.success('Client deleted');
  };

  // ── Denomination / Check Money Handlers ──

  const updateDenomCount = (value, count) => {
    const validCount = Math.max(0, parseInt(count) || 0);
    setDenomCounts(prev => ({
      ...prev,
      [value]: validCount
    }));
  };

  const incrementDenomCount = (value, delta) => {
    setDenomCounts(prev => ({
      ...prev,
      [value]: Math.max(0, (prev[value] || 0) + delta)
    }));
  };

  const resetDenomCounts = () => {
    const reset = {};
    DENOMINATIONS.forEach(d => { reset[d.value] = 0; });
    setDenomCounts(reset);
    setAuditNotes('');
    toast.success('Money counter reset');
  };

  // Total counted amount from physical denominations
  const totalCountedAmount = DENOMINATIONS.reduce((sum, d) => {
    const qty = denomCounts[d.value] || 0;
    return sum + (d.value * qty);
  }, 0);

  const roundedCounted = Math.round(totalCountedAmount * 100) / 100;
  const variance = Math.round((roundedCounted - cashSummary.expectedCashOnHand) * 100) / 100;

  const handleSaveAudit = async () => {
    if (roundedCounted === 0) {
      if (!window.confirm('The total counted amount is ₱0.00. Do you still want to record this cash audit?')) {
        return;
      }
    }

    setSavingAudit(true);
    const result = await saveCashAudit({
      cashierId: currentUser?.id,
      cashierName: currentUser?.displayName || currentUser?.name || 'Cashier',
      denominations: denomCounts,
      countedAmount: roundedCounted,
      expectedAmount: cashSummary.expectedCashOnHand,
      variance,
      notes: auditNotes.trim(),
      period: moneyPeriod
    });
    setSavingAudit(false);

    if (result.success) {
      toast.success('Cash audit recorded successfully');
      setAuditNotes('');
    } else {
      toast.error('Failed to save cash audit');
    }
  };

  const handleDeleteAudit = async (audit) => {
    if (!window.confirm(`Delete audit from ${format(new Date(audit.createdAt), 'MMM dd, yyyy hh:mm a')}?`)) return;
    await deleteCashAudit(audit.id);
    toast.success('Cash audit record deleted');
  };

  const isSuperAdmin = currentUser?.role === 'owner' || currentUser?.role === 'admin' || currentUser?.username === 'admin';

  const handleResetAllTransactions = async () => {
    if (!isSuperAdmin) {
      toast.error('Permission denied: Only Super Admin can reset transactions');
      return;
    }
    const confirmed = window.confirm(
      '⚠️ SUPER ADMIN ACTION:\n\nAre you sure you want to RESET ALL TRANSACTIONS, MONEY, AND AUDITS?\n\nThis will permanently delete all transaction records and reset your cash balance. This action cannot be undone.\n\nClick OK to confirm reset.'
    );
    if (!confirmed) return;

    const res = await resetAllTransactions();
    if (res.success) {
      toast.success('All transactions, orders, and cash audits have been completely reset');
      await getCashSummary();
    } else {
      toast.error(res.message || 'Failed to reset transactions');
    }
  };

  // ── Pagination ──
  const totalTxnPages = Math.ceil(transactions.length / txnPerPage);
  const paginatedTxns = transactions.slice((txnPage - 1) * txnPerPage, txnPage * txnPerPage);

  // Filter clients for dropdown
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const getTypeInfo = (type) => TRANSACTION_TYPES.find(t => t.value === type) || TRANSACTION_TYPES[0];

  return (
    <div className="transactions-page animate-fade-in">

      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-header__badge">
            <Banknote size={14} />
            <span>Money & Client Counter</span>
          </div>
          <h1>Money Transactions & Cash Control</h1>
          <p>Cater client money transactions (Cash In, Cash Out, Bills Payment) and audit drawer cash balance.</p>
        </div>
        <div className="page-header__actions">
          <div className="txn-view-tabs">
            <button
              className={`txn-view-tab ${activeView === 'transactions' ? 'txn-view-tab--active' : ''}`}
              onClick={() => setActiveView('transactions')}
            >
              <Receipt size={16} /> Cater Transactions
            </button>
            <button
              className={`txn-view-tab ${activeView === 'check_money' ? 'txn-view-tab--active' : ''}`}
              onClick={() => setActiveView('check_money')}
            >
              <Calculator size={16} /> Check the Money
            </button>
            <button
              className={`txn-view-tab ${activeView === 'clients' ? 'txn-view-tab--active' : ''}`}
              onClick={() => setActiveView('clients')}
            >
              <Users size={16} /> Clients
            </button>
          </div>

          {isSuperAdmin && (
            <button
              type="button"
              className="btn btn--danger btn--sm txn-reset-btn"
              onClick={handleResetAllTransactions}
              title="Super Admin Only: Reset All Transactions"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <RotateCcw size={14} />
              <span>Reset All Transactions</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* 1. Transactions View (Cater Clients)  */}
      {/* ═══════════════════════════════════════ */}
      {activeView === 'transactions' && (
        <>
          {/* Quick Action Cards */}
          <div className="txn-quick-actions stagger-children">
            {TRANSACTION_TYPES.map(type => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  className="txn-action-card"
                  onClick={() => openNewTransaction(type.value)}
                  style={{ '--action-color': type.color }}
                >
                  <div className="txn-action-card__icon">
                    <Icon size={28} />
                  </div>
                  <div className="txn-action-card__info">
                    <span className="txn-action-card__label">{type.label}</span>
                    <span className="txn-action-card__hint">
                      {type.value === 'cash_in' && 'Receive / deposit money from client'}
                      {type.value === 'cash_out' && 'Release / payout cash to client'}
                      {type.value === 'bills_payment' && 'Cater client bills & utility payments'}
                    </span>
                  </div>
                  <Plus size={20} className="txn-action-card__plus" />
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div className="txn-filters">
            <div className="search-bar">
              <Search size={16} className="search-bar__icon" />
              <input
                type="text"
                placeholder="Search by client, reference number, or email..."
                value={txnFilter.search}
                onChange={e => setTxnFilter(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            <div className="filter-select">
              <Filter size={16} className="filter-select__icon" />
              <select value={txnFilter.type} onChange={e => setTxnFilter(prev => ({ ...prev, type: e.target.value }))}>
                <option value="all">All Transaction Types</option>
                <option value="cash_in">Cash In</option>
                <option value="cash_out">Cash Out</option>
                <option value="bills_payment">Bills Payment</option>
              </select>
            </div>
            <div className="date-custom">
              <input type="date" className="date-input" value={txnFilter.dateFrom}
                onChange={e => setTxnFilter(prev => ({ ...prev, dateFrom: e.target.value }))} />
              <span className="date-separator">to</span>
              <input type="date" className="date-input" value={txnFilter.dateTo}
                onChange={e => setTxnFilter(prev => ({ ...prev, dateTo: e.target.value }))} />
            </div>
          </div>

          {/* Transaction Table */}
          {transactions.length === 0 ? (
            <div className="empty-state">
              <Receipt size={48} />
              <h3>No transactions yet</h3>
              <p>Cater client money transactions using Cash In, Cash Out, or Bills Payment buttons above</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Type</th>
                      <th>Client</th>
                      <th>Amount</th>
                      <th>Date & Time</th>
                      <th>Cashier</th>
                      <th>Status</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTxns.map(txn => {
                      const typeInfo = getTypeInfo(txn.type);
                      return (
                        <tr key={txn.id} className={txn.status === 'voided' ? 'row--voided' : ''}>
                          <td>
                            <span className="ref-number" onClick={() => copyReference(txn.referenceNumber)}
                              title="Click to copy">
                              {txn.referenceNumber}
                            </span>
                          </td>
                          <td>
                            <span className="txn-type-badge" style={{ '--type-color': typeInfo.color }}>
                              {typeInfo.label}
                            </span>
                          </td>
                          <td>
                            <div className="client-cell">
                              <span className="font-semibold">{txn.clientName}</span>
                              {txn.clientEmail && (
                                <span className="text-sm text-tertiary">{txn.clientEmail}</span>
                              )}
                            </div>
                          </td>
                          <td className="font-bold" style={{ color: typeInfo.color }}>
                            {txn.type === 'cash_out' ? '-' : '+'}{formatCurrency(txn.amount)}
                          </td>
                          <td>
                            <div className="date-cell">
                              <span>{format(new Date(txn.createdAt), 'MMM dd, yyyy')}</span>
                              <span className="text-sm text-tertiary">{format(new Date(txn.createdAt), 'hh:mm a')}</span>
                            </div>
                          </td>
                          <td>{txn.cashierName}</td>
                          <td>
                            <span className={`status-badge status-badge--${txn.status === 'completed' ? 'success' : 'danger'}`}>
                              {txn.status === 'completed' ? 'Completed' : 'Voided'}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions justify-center">
                              <button className="icon-btn" onClick={() => viewReceipt(txn)} title="View Receipt">
                                <Eye size={16} />
                              </button>
                              {txn.clientEmail && (
                                <button className="icon-btn" onClick={() => handleSendEmail(txn)} title="Send Receipt via Email">
                                  <Mail size={16} />
                                </button>
                              )}
                              {txn.status === 'completed' && currentUser?.role === 'owner' && (
                                <button className="icon-btn icon-btn--danger" onClick={() => handleVoid(txn)} title="Void Transaction">
                                  <XCircle size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalTxnPages > 1 && (
                <div className="pagination">
                  <span className="pagination__info">
                    Showing {(txnPage - 1) * txnPerPage + 1}–{Math.min(txnPage * txnPerPage, transactions.length)} of {transactions.length}
                  </span>
                  <div className="pagination__controls">
                    <button className="pagination__btn" disabled={txnPage <= 1}
                      onClick={() => setTxnPage(p => p - 1)}>
                      <ChevronLeft size={16} /> Prev
                    </button>
                    <span className="pagination__page">Page {txnPage} of {totalTxnPages}</span>
                    <button className="pagination__btn" disabled={txnPage >= totalTxnPages}
                      onClick={() => setTxnPage(p => p + 1)}>
                      Next <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* 2. Check the Money View                */}
      {/* ═══════════════════════════════════════ */}
      {activeView === 'check_money' && (
        <div className="check-money-container animate-fade-in">
          {/* Header & Filter */}
          <div className="check-money-header">
            <div className="check-money-title">
              <h2>Cash Drawer & Money Checker</h2>
              <p>Verify physical cash in drawer matches system expected balance</p>
            </div>
            <div className="period-pills">
              <button
                className={`period-pill ${moneyPeriod === 'today' ? 'period-pill--active' : ''}`}
                onClick={() => setMoneyPeriod('today')}
              >
                Today's Shift
              </button>
              <button
                className={`period-pill ${moneyPeriod === 'this_week' ? 'period-pill--active' : ''}`}
                onClick={() => setMoneyPeriod('this_week')}
              >
                This Week
              </button>
              <button
                className={`period-pill ${moneyPeriod === 'all' ? 'period-pill--active' : ''}`}
                onClick={() => setMoneyPeriod('all')}
              >
                All Time Record
              </button>
            </div>
          </div>

          {/* Live System Balances Grid */}
          <div className="money-kpi-grid">
            {/* Hero Expected Cash Balance Card */}
            <div className="money-kpi-card money-kpi-card--hero">
              <div className="money-kpi-card__glow"></div>
              <div className="money-kpi-card__header">
                <span className="money-kpi-card__label">Expected Cash in Drawer</span>
                <span className="money-kpi-card__badge">Live System</span>
              </div>
              <div className="money-kpi-card__amount">
                {formatCurrency(cashSummary.expectedCashOnHand)}
              </div>
              <div className="money-kpi-card__formula">
                <span>(Cash In + Bills + POS Sales) − Cash Out</span>
              </div>
            </div>

            {/* Total Cash In */}
            <div className="money-kpi-card">
              <div className="money-kpi-card__header">
                <span className="money-kpi-card__label">Total Cash In</span>
                <span className="money-kpi-card__icon text-success"><ArrowDownCircle size={18} /></span>
              </div>
              <div className="money-kpi-card__amount text-success">
                +{formatCurrency(cashSummary.totalCashIn)}
              </div>
              <div className="money-kpi-card__sub">{cashSummary.countCashIn} client transactions</div>
            </div>

            {/* Total Cash Out */}
            <div className="money-kpi-card">
              <div className="money-kpi-card__header">
                <span className="money-kpi-card__label">Total Cash Out</span>
                <span className="money-kpi-card__icon text-danger"><ArrowUpCircle size={18} /></span>
              </div>
              <div className="money-kpi-card__amount text-danger">
                -{formatCurrency(cashSummary.totalCashOut)}
              </div>
              <div className="money-kpi-card__sub">{cashSummary.countCashOut} client releases</div>
            </div>

            {/* Total Bills Collected */}
            <div className="money-kpi-card">
              <div className="money-kpi-card__header">
                <span className="money-kpi-card__label">Bills Payments Collected</span>
                <span className="money-kpi-card__icon text-accent"><Receipt size={18} /></span>
              </div>
              <div className="money-kpi-card__amount text-accent">
                +{formatCurrency(cashSummary.totalBillsPayment)}
              </div>
              <div className="money-kpi-card__sub">{cashSummary.countBills} client payments</div>
            </div>

            {/* Total POS Cash Sales */}
            <div className="money-kpi-card">
              <div className="money-kpi-card__header">
                <span className="money-kpi-card__label">POS Cash Sales</span>
                <span className="money-kpi-card__icon text-warning"><Banknote size={18} /></span>
              </div>
              <div className="money-kpi-card__amount text-warning">
                +{formatCurrency(cashSummary.totalPosCashSales)}
              </div>
              <div className="money-kpi-card__sub">{cashSummary.countPosSales} completed orders</div>
            </div>
          </div>

          {/* Interactive Denomination Counter & Live Reconciliation */}
          <div className="denomination-section">
            <div className="denomination-header">
              <div>
                <h3 className="section-title">
                  <Calculator size={20} />
                  <span>Physical Cash Counter & Denomination Audit</span>
                </h3>
                <p className="section-subtitle">Input the quantity of each bill and coin currently in the cash drawer</p>
              </div>
              <div className="denomination-actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={resetDenomCounts}>
                  <RotateCcw size={15} /> Reset Counts
                </button>
              </div>
            </div>

            <div className="denomination-grid">
              {DENOMINATIONS.map(denom => {
                const qty = denomCounts[denom.value] || 0;
                const subtotal = Math.round(denom.value * qty * 100) / 100;
                return (
                  <div key={denom.value} className={`denom-item denom-item--${denom.type}`}>
                    <div className="denom-item__badge">
                      {denom.type === 'bill' ? <Banknote size={16} /> : <Coins size={16} />}
                      <span>{denom.label}</span>
                    </div>

                    <div className="denom-item__counter">
                      <button
                        type="button"
                        className="denom-btn"
                        onClick={() => incrementDenomCount(denom.value, -1)}
                        disabled={qty <= 0}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        className="denom-input"
                        value={qty || ''}
                        placeholder="0"
                        onChange={e => updateDenomCount(denom.value, e.target.value)}
                      />
                      <button
                        type="button"
                        className="denom-btn"
                        onClick={() => incrementDenomCount(denom.value, 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="denom-preset-btn"
                        onClick={() => incrementDenomCount(denom.value, 5)}
                        title="Add 5"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        className="denom-preset-btn"
                        onClick={() => incrementDenomCount(denom.value, 10)}
                        title="Add 10"
                      >
                        +10
                      </button>
                    </div>

                    <div className="denom-item__subtotal">
                      <span>Subtotal:</span>
                      <strong>{formatCurrency(subtotal)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reconciliation Comparison Card */}
            <div className="reconciliation-card">
              <div className="reconciliation-row">
                <div className="reconciliation-col">
                  <span className="recon-label">Physical Cash Counted</span>
                  <span className="recon-value">{formatCurrency(roundedCounted)}</span>
                </div>
                <div className="reconciliation-divider">vs</div>
                <div className="reconciliation-col">
                  <span className="recon-label">Expected System Cash</span>
                  <span className="recon-value">{formatCurrency(cashSummary.expectedCashOnHand)}</span>
                </div>
                <div className="reconciliation-divider">=</div>
                <div className="reconciliation-col">
                  <span className="recon-label">Difference / Variance</span>
                  <span className={`recon-variance recon-variance--${variance === 0 ? 'balanced' : variance > 0 ? 'over' : 'short'}`}>
                    {variance === 0 ? (
                      <>
                        <CheckCircle2 size={20} />
                        <span>Perfect Match (₱0.00)</span>
                      </>
                    ) : variance > 0 ? (
                      <>
                        <TrendingUp size={20} />
                        <span>Over by +{formatCurrency(variance)}</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown size={20} />
                        <span>Short by {formatCurrency(variance)}</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Audit Save Bar */}
              <div className="audit-save-bar">
                <div className="audit-notes-input">
                  <input
                    type="text"
                    value={auditNotes}
                    onChange={e => setAuditNotes(e.target.value)}
                    placeholder="Audit notes (e.g. End of morning shift count, Cashier drawer handoff...)"
                  />
                </div>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleSaveAudit}
                  disabled={savingAudit}
                >
                  <Save size={16} />
                  <span>{savingAudit ? 'Recording Audit...' : 'Record Cash Audit'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Past Cash Audit History */}
          <div className="audit-history-section">
            <h3 className="section-title">
              <Clock size={18} />
              <span>Cash Audit Records & Discrepancy History</span>
            </h3>

            {cashAudits.length === 0 ? (
              <div className="empty-state empty-state--compact">
                <p>No cash audits recorded yet. Count your drawer above and click "Record Cash Audit".</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Cashier</th>
                      <th>Counted Cash</th>
                      <th>Expected Cash</th>
                      <th>Discrepancy (Variance)</th>
                      <th>Audit Status</th>
                      <th>Notes</th>
                      {currentUser?.role === 'owner' && <th className="text-center">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {cashAudits.map(audit => (
                      <tr key={audit.id}>
                        <td>
                          <div className="date-cell">
                            <span>{format(new Date(audit.createdAt), 'MMM dd, yyyy')}</span>
                            <span className="text-sm text-tertiary">{format(new Date(audit.createdAt), 'hh:mm a')}</span>
                          </div>
                        </td>
                        <td className="font-semibold">{audit.cashierName}</td>
                        <td className="font-bold">{formatCurrency(audit.countedAmount)}</td>
                        <td>{formatCurrency(audit.expectedAmount)}</td>
                        <td className="font-bold">
                          <span className={`variance-tag variance-tag--${audit.status}`}>
                            {audit.variance === 0 ? '₱0.00' : (audit.variance > 0 ? '+' : '') + formatCurrency(audit.variance)}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge status-badge--${audit.status === 'balanced' ? 'success' : audit.status === 'over' ? 'info' : 'danger'}`}>
                            {audit.status === 'balanced' ? 'Balanced' : audit.status === 'over' ? 'Cash Over' : 'Cash Short'}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm text-secondary">{audit.notes || '—'}</span>
                        </td>
                        {currentUser?.role === 'owner' && (
                          <td>
                            <div className="table-actions justify-center">
                              <button
                                className="icon-btn icon-btn--danger"
                                onClick={() => handleDeleteAudit(audit)}
                                title="Delete Audit Record"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* 3. Clients View                        */}
      {/* ═══════════════════════════════════════ */}
      {activeView === 'clients' && (
        <>
          <div className="txn-filters" style={{ marginBottom: 'var(--space-4)' }}>
            <button className="btn btn--primary" onClick={openCreateClient}>
              <UserPlus size={16} /> Add Registered Client
            </button>
          </div>

          {clients.length === 0 ? (
            <div className="empty-state">
              <Users size={48} />
              <h3>No registered clients</h3>
              <p>Add regular clients for instant auto-fill during money transactions</p>
            </div>
          ) : (
            <div className="clients-grid">
              {clients.map(client => (
                <div key={client.id} className="client-card">
                  <div className="client-card__avatar">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="client-card__info">
                    <span className="client-card__name">{client.name}</span>
                    {client.email && <span className="client-card__detail">{client.email}</span>}
                    {client.contact && <span className="client-card__detail">{client.contact}</span>}
                  </div>
                  <div className="client-card__actions">
                    <button className="icon-btn" onClick={() => openEditClient(client)} title="Edit Client">
                      <Edit3 size={15} />
                    </button>
                    <button className="icon-btn icon-btn--danger" onClick={() => handleDeleteClient(client)} title="Delete Client">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* New Transaction Modal                  */}
      {/* ═══════════════════════════════════════ */}
      <Modal isOpen={showTxnModal} onClose={() => setShowTxnModal(false)}
        title={`Cater New ${getTypeInfo(selectedType)?.label || 'Transaction'}`} size="md">
        <form onSubmit={handleCreateTransaction} className="txn-modal-form">
          {/* Client Selection Toggle */}
          <div className="txn-client-toggle">
            <button type="button"
              className={`txn-client-toggle__btn ${txnForm.isWalkIn ? 'txn-client-toggle__btn--active' : ''}`}
              onClick={switchToWalkIn}>
              Walk-in Client
            </button>
            <button type="button"
              className={`txn-client-toggle__btn ${!txnForm.isWalkIn ? 'txn-client-toggle__btn--active' : ''}`}
              onClick={() => setTxnForm(prev => ({ ...prev, isWalkIn: false }))}>
              Registered Client
            </button>
          </div>

          {/* Registered client search */}
          {!txnForm.isWalkIn && (
            <div className="form-group" style={{ position: 'relative' }}>
              <label>Search Client Database</label>
              <input
                ref={clientSearchRef}
                type="text"
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                onFocus={() => setShowClientDropdown(true)}
                placeholder="Type name to search..."
              />
              {showClientDropdown && filteredClients.length > 0 && (
                <div className="client-dropdown">
                  {filteredClients.slice(0, 8).map(c => (
                    <button type="button" key={c.id} className="client-dropdown__item"
                      onClick={() => selectClient(c)}>
                      <span className="client-dropdown__name">{c.name}</span>
                      {c.email && <span className="client-dropdown__email">{c.email}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label>Client Name *</label>
            <input type="text" required value={txnForm.clientName}
              onChange={e => setTxnForm(prev => ({ ...prev, clientName: e.target.value }))}
              placeholder="Full name of client" readOnly={!txnForm.isWalkIn && txnForm.clientId} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email Address (for receipt)</label>
              <input type="email" value={txnForm.clientEmail}
                onChange={e => setTxnForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                placeholder="client@email.com" />
            </div>
            <div className="form-group">
              <label>Contact Number</label>
              <input type="text" value={txnForm.clientContact}
                onChange={e => setTxnForm(prev => ({ ...prev, clientContact: e.target.value }))}
                placeholder="09XX-XXX-XXXX" />
            </div>
          </div>

          {/* Bills Payment specific fields */}
          {selectedType === 'bills_payment' && (
            <div className="form-row">
              <div className="form-group">
                <label>Biller / Bill Type *</label>
                <select value={txnForm.billType}
                  onChange={e => setTxnForm(prev => ({ ...prev, billType: e.target.value }))}>
                  <option value="">Select biller</option>
                  {BILL_TYPES.map(bt => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Account / Reference Number</label>
                <input type="text" value={txnForm.accountNumber}
                  onChange={e => setTxnForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                  placeholder="e.g. 1234-5678-90" />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Amount (₱) *</label>
            <input type="number" required min="0.01" step="0.01" value={txnForm.amount}
              onChange={e => setTxnForm(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
              className="txn-amount-input" />
          </div>

          {/* 3 Categories of Payment (Cash / Bank Transfer / E-Wallet GCash & Maya) */}
          {selectedType === 'bills_payment' && (
            <div className="txn-payment-method-section animate-fade-in">
              <label className="txn-section-title">
                Payment Category (How client pays) *
              </label>
              <div className="txn-payment-categories">
                <button
                  type="button"
                  className={`txn-payment-cat-btn ${txnForm.paymentCategory === 'cash' ? 'txn-payment-cat-btn--active' : ''}`}
                  onClick={() => setTxnForm(prev => ({ ...prev, paymentCategory: 'cash' }))}
                >
                  <Banknote size={20} />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  className={`txn-payment-cat-btn ${txnForm.paymentCategory === 'bank_transfer' ? 'txn-payment-cat-btn--active' : ''}`}
                  onClick={() => setTxnForm(prev => ({ ...prev, paymentCategory: 'bank_transfer' }))}
                >
                  <Building2 size={20} />
                  <span>Bank Transfer</span>
                </button>
                <button
                  type="button"
                  className={`txn-payment-cat-btn ${txnForm.paymentCategory === 'ewallet' ? 'txn-payment-cat-btn--active' : ''}`}
                  onClick={() => setTxnForm(prev => ({ ...prev, paymentCategory: 'ewallet' }))}
                >
                  <Smartphone size={20} />
                  <span>E-Wallet (GCash/Maya)</span>
                </button>
              </div>

              {/* Cash Sub-details */}
              {txnForm.paymentCategory === 'cash' && (
                <div className="txn-payment-details-box animate-fade-in">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Cash Tendered (₱)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={txnForm.cashTendered}
                        onChange={e => setTxnForm(prev => ({ ...prev, cashTendered: e.target.value }))}
                        placeholder={txnForm.amount || '0.00'}
                      />
                    </div>
                    <div className="form-group">
                      <label>Change (₱)</label>
                      <div className="txn-change-display">
                        {formatCurrency(Math.max(0, (parseFloat(txnForm.cashTendered || 0) - parseFloat(txnForm.amount || 0))))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bank Transfer Sub-details */}
              {txnForm.paymentCategory === 'bank_transfer' && (
                <div className="txn-payment-details-box animate-fade-in">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Bank *</label>
                      <select
                        value={txnForm.bankName}
                        onChange={e => setTxnForm(prev => ({ ...prev, bankName: e.target.value }))}
                      >
                        {BANK_OPTIONS.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Bank Ref / Confirmation No.</label>
                      <input
                        type="text"
                        value={txnForm.bankRef}
                        onChange={e => setTxnForm(prev => ({ ...prev, bankRef: e.target.value }))}
                        placeholder="e.g. BDO-987654"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* E-Wallet Sub-details */}
              {txnForm.paymentCategory === 'ewallet' && (
                <div className="txn-payment-details-box animate-fade-in">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Provider *</label>
                      <div className="ewallet-pills">
                        {EWALLET_OPTIONS.map(ew => (
                          <button
                            key={ew.id}
                            type="button"
                            className={`ewallet-pill ${txnForm.ewalletProvider === ew.id ? 'ewallet-pill--active' : ''}`}
                            onClick={() => setTxnForm(prev => ({ ...prev, ewalletProvider: ew.id }))}
                          >
                            {ew.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Reference No.</label>
                      <input
                        type="text"
                        value={txnForm.ewalletRef}
                        onChange={e => setTxnForm(prev => ({ ...prev, ewalletRef: e.target.value }))}
                        placeholder="e.g. MP-12345678"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label>Description / Transaction Notes</label>
            <textarea value={txnForm.description}
              onChange={e => setTxnForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional notes or details for this transaction..."
              rows={2} />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setShowTxnModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary">
              <CheckCircle size={16} /> Complete & Issue Receipt
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════ */}
      {/* Receipt Modal                          */}
      {/* ═══════════════════════════════════════ */}
      <Modal isOpen={showReceipt} onClose={() => setShowReceipt(false)}
        title="Transaction Receipt" size="sm">
        {receiptData && (
          <div className="receipt-view">
            <div className="receipt-view__header">
              <div className="receipt-view__icon" style={{ '--receipt-color': getTypeInfo(receiptData.type)?.color }}>
                <CheckCircle size={32} />
              </div>
              <h3 className="receipt-view__title">Transaction {receiptData.status === 'completed' ? 'Successful' : 'Voided'}</h3>
              <div className="receipt-view__ref" onClick={() => copyReference(receiptData.referenceNumber)}
                title="Click to copy reference">
                <span>{receiptData.referenceNumber}</span>
                {copiedRef ? <CheckCircle size={14} /> : <Copy size={14} />}
              </div>
            </div>

            <div className="receipt-view__body">
              <div className="receipt-row">
                <span>Transaction Type</span>
                <span className="txn-type-badge" style={{ '--type-color': getTypeInfo(receiptData.type)?.color }}>
                  {getTypeInfo(receiptData.type)?.label}
                </span>
              </div>
              <div className="receipt-row receipt-row--amount">
                <span>Amount Catered</span>
                <span className="receipt-amount">{formatCurrency(receiptData.amount)}</span>
              </div>
              {receiptData.paymentCategory && (
                <div className="receipt-row">
                  <span>Payment Category</span>
                  <span className="font-semibold" style={{ textTransform: 'capitalize' }}>
                    {receiptData.paymentCategory === 'cash' ? '💵 Cash' :
                     receiptData.paymentCategory === 'bank_transfer' ? `🏦 Bank Transfer (${receiptData.paymentDetails?.bankName || 'Bank'})` :
                     `📱 E-Wallet (${receiptData.paymentDetails?.provider?.toUpperCase() || 'GCash/Maya'})`}
                  </span>
                </div>
              )}
              {receiptData.paymentDetails?.reference && (
                <div className="receipt-row">
                  <span>Payment Ref</span>
                  <span>{receiptData.paymentDetails.reference}</span>
                </div>
              )}
              {receiptData.paymentDetails?.change > 0 && (
                <div className="receipt-row">
                  <span>Change</span>
                  <span className="text-success font-semibold">{formatCurrency(receiptData.paymentDetails.change)}</span>
                </div>
              )}
              <div className="receipt-divider"></div>
              <div className="receipt-row">
                <span>Client Name</span>
                <span className="font-semibold">{receiptData.clientName}</span>
              </div>
              {receiptData.clientEmail && (
                <div className="receipt-row">
                  <span>Email</span>
                  <span>{receiptData.clientEmail}</span>
                </div>
              )}
              {receiptData.clientContact && (
                <div className="receipt-row">
                  <span>Contact</span>
                  <span>{receiptData.clientContact}</span>
                </div>
              )}
              {receiptData.billType && (
                <div className="receipt-row">
                  <span>Bill Type</span>
                  <span>{receiptData.billType}</span>
                </div>
              )}
              {receiptData.accountNumber && (
                <div className="receipt-row">
                  <span>Account No.</span>
                  <span>{receiptData.accountNumber}</span>
                </div>
              )}
              {receiptData.description && (
                <div className="receipt-row">
                  <span>Notes</span>
                  <span>{receiptData.description}</span>
                </div>
              )}
              <div className="receipt-divider"></div>
              <div className="receipt-row">
                <span>Date & Time</span>
                <span>{format(new Date(receiptData.createdAt), 'MMM dd, yyyy — hh:mm a')}</span>
              </div>
              <div className="receipt-row">
                <span>Catered by (Cashier)</span>
                <span>{receiptData.cashierName}</span>
              </div>
              <div className="receipt-row">
                <span>Status</span>
                <span className={`status-badge status-badge--${receiptData.status === 'completed' ? 'success' : 'danger'}`}>
                  {receiptData.status === 'completed' ? 'Completed' : 'Voided'}
                </span>
              </div>
            </div>

            <div className="receipt-view__actions">
              <button
                className="btn btn--primary"
                onClick={() => {
                  setShowReceipt(false);
                  navigate('/dashboard');
                }}
              >
                <LayoutDashboard size={16} /> Direct to Dashboard (Accounting)
              </button>
              {receiptData.clientEmail && (
                <button className="btn btn--ghost" onClick={() => handleSendEmail(receiptData)}>
                  <Mail size={16} /> Send via Email
                </button>
              )}
              <button className="btn btn--ghost" onClick={handlePrintReceipt}>
                <Printer size={16} /> Print Receipt
              </button>
              <button className="btn btn--ghost" onClick={() => setShowReceipt(false)}>
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══════════════════════════════════════ */}
      {/* Client Create/Edit Modal               */}
      {/* ═══════════════════════════════════════ */}
      <Modal isOpen={showClientModal} onClose={() => setShowClientModal(false)}
        title={editingClient ? 'Edit Client' : 'Add New Client'} size="sm">
        <form onSubmit={handleSaveClient} className="category-form">
          <div className="form-group">
            <label>Full Name *</label>
            <input type="text" required value={clientForm.name}
              onChange={e => setClientForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Maria Santos" />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={clientForm.email}
              onChange={e => setClientForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="maria@example.com" />
          </div>
          <div className="form-group">
            <label>Contact Number</label>
            <input type="text" value={clientForm.contact}
              onChange={e => setClientForm(prev => ({ ...prev, contact: e.target.value }))}
              placeholder="0917-123-4567" />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setShowClientModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary">
              <Save size={16} /> {editingClient ? 'Save Changes' : 'Add Client'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
