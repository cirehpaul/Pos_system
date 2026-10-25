import { create } from 'zustand';
import db, { generateReferenceNumber, resetAllFinancialData } from '../db/database';
import { logAudit, AUDIT_ACTIONS } from '../utils/auditLogger';

const useTransactionStore = create((set, get) => ({
  transactions: [],
  clients: [],

  // ── Transaction CRUD ──

  loadTransactions: async (filters = {}) => {
    let txns = await db.transactions.toArray();
    
    // Sort newest first
    txns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (filters.type && filters.type !== 'all') {
      txns = txns.filter(t => t.type === filters.type);
    }
    if (filters.status && filters.status !== 'all') {
      txns = txns.filter(t => t.status === filters.status);
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      txns = txns.filter(t => new Date(t.createdAt) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      txns = txns.filter(t => new Date(t.createdAt) <= to);
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      txns = txns.filter(t =>
        (t.clientName || '').toLowerCase().includes(s) ||
        (t.referenceNumber || '').toLowerCase().includes(s) ||
        (t.clientEmail || '').toLowerCase().includes(s)
      );
    }

    set({ transactions: txns });
    return txns;
  },

  createTransaction: async (data) => {
    const id = crypto.randomUUID();
    const referenceNumber = generateReferenceNumber();
    
    const transaction = {
      id,
      referenceNumber,
      type: data.type, // 'cash_in', 'cash_out', 'bills_payment'
      amount: parseFloat(data.amount),
      clientId: data.clientId || null,
      clientName: data.clientName,
      clientEmail: data.clientEmail || '',
      clientContact: data.clientContact || '',
      cashierId: data.cashierId,
      cashierName: data.cashierName,
      description: data.description || '',
      billType: data.billType || '', // For bills payment: 'electric', 'water', 'internet', etc.
      accountNumber: data.accountNumber || '', // Bills payment account number
      paymentCategory: data.paymentCategory || 'cash', // 'cash' | 'bank_transfer' | 'ewallet'
      paymentMethod: data.paymentMethod || data.paymentCategory || 'cash',
      paymentDetails: data.paymentDetails || {},
      status: 'completed',
      emailSent: false,
      createdAt: new Date().toISOString()
    };

    await db.transactions.add(transaction);
    await get().loadTransactions();

    logAudit({ action: AUDIT_ACTIONS.TRANSACTION_CREATED, description: `${data.type.replace('_', ' ')} of ₱${parseFloat(data.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} for ${data.clientName}`, userId: data.cashierId, userName: data.cashierName, userRole: 'cashier', metadata: { referenceNumber, amount: data.amount, type: data.type, clientName: data.clientName } });

    return { success: true, transaction };
  },

  voidTransaction: async (id) => {
    const txn = await db.transactions.get(id);
    if (!txn) return { success: false, message: 'Transaction not found' };
    if (txn.status === 'voided') return { success: false, message: 'Transaction already voided' };

    await db.transactions.update(id, { status: 'voided', voidedAt: new Date().toISOString() });
    await get().loadTransactions();

    logAudit({ action: AUDIT_ACTIONS.TRANSACTION_VOIDED, description: `Voided transaction ${txn.referenceNumber} (₱${parseFloat(txn.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })})`, metadata: { referenceNumber: txn.referenceNumber, amount: txn.amount, type: txn.type } });

    return { success: true };
  },

  markEmailSent: async (id) => {
    await db.transactions.update(id, { emailSent: true });
    await get().loadTransactions();
  },

  resetAllTransactions: async () => {
    try {
      await resetAllFinancialData();
      await get().loadTransactions();
      await get().loadCashAudits();

      logAudit({ action: AUDIT_ACTIONS.FINANCIAL_RESET, description: 'All financial data reset — transactions, cash audits, orders, and reservations cleared', severity: 'critical' });

      return { success: true };
    } catch (err) {
      console.error('Failed to reset transactions:', err);
      return { success: false, message: err.message };
    }
  },

  // ── Client CRUD ──

  loadClients: async () => {
    const clients = await db.clients.toArray();
    clients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    set({ clients });
    return clients;
  },

  addClient: async (clientData) => {
    const id = crypto.randomUUID();
    await db.clients.add({
      id,
      name: clientData.name.trim(),
      email: clientData.email?.trim() || '',
      contact: clientData.contact?.trim() || '',
      createdAt: new Date().toISOString()
    });
    await get().loadClients();
    return { success: true, id };
  },

  updateClient: async (id, clientData) => {
    await db.clients.update(id, {
      name: clientData.name.trim(),
      email: clientData.email?.trim() || '',
      contact: clientData.contact?.trim() || ''
    });
    await get().loadClients();
    return { success: true };
  },

  deleteClient: async (id) => {
    await db.clients.delete(id);
    await get().loadClients();
    return { success: true };
  },

  getClientById: async (id) => {
    return await db.clients.get(id);
  },

  // ── Cash Drawer & Money Checker ──

  cashAudits: [],

  loadCashAudits: async () => {
    try {
      let audits = await db.cashAudits.toArray();
      audits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      set({ cashAudits: audits });
      return audits;
    } catch (err) {
      console.error('Failed to load cash audits:', err);
      return [];
    }
  },

  saveCashAudit: async (auditData) => {
    const id = crypto.randomUUID();
    const audit = {
      id,
      cashierId: auditData.cashierId,
      cashierName: auditData.cashierName,
      denominations: auditData.denominations || {},
      countedAmount: parseFloat(auditData.countedAmount || 0),
      expectedAmount: parseFloat(auditData.expectedAmount || 0),
      variance: parseFloat(auditData.variance || 0),
      status: auditData.variance === 0 ? 'balanced' : auditData.variance > 0 ? 'over' : 'short',
      notes: auditData.notes || '',
      period: auditData.period || 'all',
      createdAt: new Date().toISOString()
    };

    await db.cashAudits.add(audit);
    await get().loadCashAudits();
    return { success: true, audit };
  },

  deleteCashAudit: async (id) => {
    await db.cashAudits.delete(id);
    await get().loadCashAudits();
    return { success: true };
  },

  getCashSummary: async (filters = {}) => {
    // 1. Transactions
    let txns = await db.transactions.toArray();
    txns = txns.filter(t => t.status === 'completed');

    if (filters.cashierId && filters.cashierId !== 'all') {
      txns = txns.filter(t => t.cashierId === filters.cashierId);
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      txns = txns.filter(t => new Date(t.createdAt) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      txns = txns.filter(t => new Date(t.createdAt) <= to);
    }

    let totalCashIn = 0;
    let countCashIn = 0;
    let totalCashOut = 0;
    let countCashOut = 0;
    let totalBillsPayment = 0;
    let totalBillsPaymentCash = 0;
    let totalBillsPaymentDigital = 0;
    let countBills = 0;

    for (const t of txns) {
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'cash_in') {
        totalCashIn += amt;
        countCashIn++;
      } else if (t.type === 'cash_out') {
        totalCashOut += amt;
        countCashOut++;
      } else if (t.type === 'bills_payment') {
        totalBillsPayment += amt;
        countBills++;
        if (t.paymentCategory === 'cash' || !t.paymentCategory) {
          totalBillsPaymentCash += amt;
        } else {
          totalBillsPaymentDigital += amt;
        }
      }
    }

    // 2. POS Orders (Cash payments)
    let posOrders = [];
    try {
      posOrders = await db.orders.toArray();
      posOrders = posOrders.filter(o => o.status === 'completed' && (o.paymentMethod === 'cash' || !o.paymentMethod));
      if (filters.cashierId && filters.cashierId !== 'all') {
        posOrders = posOrders.filter(o => o.cashierId === filters.cashierId);
      }
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        posOrders = posOrders.filter(o => new Date(o.createdAt) >= from);
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        posOrders = posOrders.filter(o => new Date(o.createdAt) <= to);
      }
    } catch (err) {
      console.warn('Orders table not queryable:', err);
    }

    let totalPosCashSales = 0;
    for (const o of posOrders) {
      totalPosCashSales += parseFloat(o.total || 0);
    }

    const expectedCashOnHand = (totalCashIn + totalBillsPaymentCash + totalPosCashSales) - totalCashOut;

    return {
      totalCashIn: Math.round(totalCashIn * 100) / 100,
      countCashIn,
      totalCashOut: Math.round(totalCashOut * 100) / 100,
      countCashOut,
      totalBillsPayment: Math.round(totalBillsPayment * 100) / 100,
      totalBillsPaymentCash: Math.round(totalBillsPaymentCash * 100) / 100,
      totalBillsPaymentDigital: Math.round(totalBillsPaymentDigital * 100) / 100,
      countBills,
      totalPosCashSales: Math.round(totalPosCashSales * 100) / 100,
      countPosSales: posOrders.length,
      expectedCashOnHand: Math.round(expectedCashOnHand * 100) / 100,
      totalTransactions: txns.length + posOrders.length
    };
  }
}));

export default useTransactionStore;
