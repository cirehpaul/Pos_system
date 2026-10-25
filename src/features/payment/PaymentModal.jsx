import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Banknote, Smartphone, Building2, Check,
  ArrowRight, LayoutDashboard, RotateCcw, Clock, ShieldCheck
} from 'lucide-react';
import db from '../../db/database';
import useCartStore from '../../stores/cartStore';
import useAuthStore from '../../stores/authStore';
import { useToast } from '../../components/Toast/Toast';
import ReceiptPreview from '../receipt/ReceiptPreview';
import './PaymentModal.css';

const BANK_OPTIONS = ['BDO', 'BPI', 'UnionBank', 'Metrobank', 'Security Bank', 'Landbank', 'Other Bank'];
const EWALLET_OPTIONS = [
  { id: 'gcash', name: 'GCash', color: '#007dfa', tag: '09XX-XXX-XXXX' },
  { id: 'maya', name: 'Maya', color: '#00d632', tag: '09XX-XXX-XXXX' }
];

export default function PaymentModal({ onClose, onComplete }) {
  const navigate = useNavigate();
  const [step, setStep] = useState('method'); // method, amount, success
  const [paymentCategory, setPaymentCategory] = useState('cash'); // 'cash' | 'bank_transfer' | 'ewallet'
  const [amountReceived, setAmountReceived] = useState('');
  
  // Bank details
  const [selectedBank, setSelectedBank] = useState('BDO');
  const [bankRefNumber, setBankRefNumber] = useState('');

  // E-Wallet details
  const [selectedEwallet, setSelectedEwallet] = useState('gcash');
  const [ewalletRefNumber, setEwalletRefNumber] = useState('');
  
  const [orderData, setOrderData] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Auto-redirect to dashboard timer state
  const [countdown, setCountdown] = useState(4);
  const [autoRedirectPaused, setAutoRedirectPaused] = useState(false);

  const { items, getSubtotal, clearCart } = useCartStore();
  const { currentUser } = useAuthStore();
  const toast = useToast();

  const total = getSubtotal();
  const change = parseFloat(amountReceived || 0) - total;

  // Auto-redirect countdown effect on success
  useEffect(() => {
    let timer;
    if (step === 'success' && !autoRedirectPaused && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (step === 'success' && !autoRedirectPaused && countdown === 0) {
      onComplete();
      navigate('/dashboard');
    }
    return () => clearTimeout(timer);
  }, [step, countdown, autoRedirectPaused, onComplete, navigate]);

  const handleNumpadInput = (val) => {
    if (val === 'clear') {
      setAmountReceived('');
    } else if (val === 'backspace') {
      setAmountReceived(prev => prev.slice(0, -1));
    } else if (val === '.') {
      if (!amountReceived.includes('.')) {
        setAmountReceived(prev => prev + '.');
      }
    } else {
      setAmountReceived(prev => {
        const newVal = prev + val;
        if (newVal.includes('.') && newVal.split('.')[1].length > 2) return prev;
        return newVal;
      });
    }
  };

  const quickAmounts = [
    { label: 'Exact', value: total },
    { label: '₱50', value: 50 },
    { label: '₱100', value: 100 },
    { label: '₱200', value: 200 },
    { label: '₱500', value: 500 },
    { label: '₱1000', value: 1000 },
  ];

  const handleSelectMethod = (method) => {
    setPaymentCategory(method);
    if (method === 'cash') {
      setAmountReceived('');
    } else {
      setAmountReceived(String(total));
    }
    setStep('amount');
  };

  const handleConfirmPayment = async () => {
    if (paymentCategory === 'cash' && parseFloat(amountReceived || 0) < total) {
      toast.error('Insufficient cash amount received');
      return;
    }

    if (processing) return;
    setProcessing(true);

    try {
      const orderCount = await db.orders.count();
      const orderNumber = `ORD-${String(orderCount + 1).padStart(6, '0')}`;

      // Build structured payment information
      let paymentMethodCode = paymentCategory;
      let paymentDetails = {
        category: paymentCategory,
        provider: null,
        reference: null
      };

      if (paymentCategory === 'bank_transfer') {
        paymentDetails.provider = selectedBank;
        paymentDetails.reference = bankRefNumber.trim() || 'N/A';
      } else if (paymentCategory === 'ewallet') {
        paymentDetails.provider = selectedEwallet === 'gcash' ? 'GCash' : 'Maya';
        paymentDetails.reference = ewalletRefNumber.trim() || 'N/A';
        paymentMethodCode = selectedEwallet; // 'gcash' or 'maya' for backwards compatibility
      }

      const order = {
        id: crypto.randomUUID(),
        orderNumber,
        items: items.map(item => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          cost: item.cost || 0,
          quantity: item.quantity,
          subtotal: item.subtotal
        })),
        subtotal: total,
        tax: 0,
        discount: 0,
        total: total,
        paymentMethod: paymentMethodCode,
        paymentCategory: paymentCategory,
        paymentProvider: paymentDetails.provider,
        paymentReference: paymentDetails.reference,
        amountReceived: paymentCategory === 'cash' ? parseFloat(amountReceived) : total,
        change: paymentCategory === 'cash' ? Math.max(0, change) : 0,
        cashierId: currentUser?.id || null,
        cashierName: currentUser?.displayName || currentUser?.name || 'Cashier',
        status: 'completed',
        createdAt: new Date().toISOString()
      };

      // Save order to IndexedDB
      await db.orders.add(order);

      // Deduct stock and record inventory transaction
      for (const item of items) {
        const product = await db.products.get(item.productId);
        if (product) {
          const newStock = Math.max(0, product.stock - item.quantity);
          await db.products.update(item.productId, {
            stock: newStock,
            status: newStock === 0 ? 'out_of_stock' : 'available',
            updatedAt: new Date().toISOString()
          });

          await db.inventoryTransactions.add({
            id: crypto.randomUUID(),
            productId: item.productId,
            type: 'sale',
            quantity: -item.quantity,
            costPerUnit: item.cost || 0,
            previousStock: product.stock,
            newStock,
            reference: orderNumber,
            notes: `Bar billing order - ${order.orderNumber} (${paymentCategory.toUpperCase()})`,
            createdAt: new Date().toISOString()
          });
        }
      }

      setOrderData(order);
      setStep('success');
      setCountdown(4);
      clearCart();
      toast.success('Billing settled successfully!');
    } catch (err) {
      console.error('Payment settlement error:', err);
      toast.error('Payment failed. Please try again.');
    }

    setProcessing(false);
  };

  return (
    <div className="payment-overlay" onClick={onClose}>
      <div className="payment-modal" onClick={e => e.stopPropagation()}>
        {/* Close Button */}
        {step !== 'success' && (
          <button className="payment-close" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* Step 1: Select 3 Payment Categories     */}
        {/* ═══════════════════════════════════════ */}
        {step === 'method' && (
          <div className="payment-step animate-fade-in">
            <div className="payment-header-badge">
              <ShieldCheck size={14} />
              <span>Bar Billing & Settlement</span>
            </div>
            <h2 className="payment-title">Select Bills Payment Category</h2>
            
            <div className="payment-total-display">
              <span>Total Bill Due</span>
              <h1>₱{total.toFixed(2)}</h1>
            </div>

            {/* 3 Categories: Cash / Bank Transfer / E-Wallet (GCash/Maya) */}
            <div className="payment-3-categories">
              {/* Category 1: Cash */}
              <button
                type="button"
                className={`payment-cat-card ${paymentCategory === 'cash' ? 'payment-cat-card--active' : ''}`}
                onClick={() => handleSelectMethod('cash')}
                style={{ '--cat-accent': '#10b981' }}
              >
                <div className="payment-cat-card__icon">
                  <Banknote size={32} />
                </div>
                <div className="payment-cat-card__info">
                  <span className="payment-cat-card__title">1. Cash</span>
                  <span className="payment-cat-card__hint">Physical bills & coins</span>
                </div>
                <div className="payment-cat-card__arrow">
                  <ArrowRight size={16} />
                </div>
              </button>

              {/* Category 2: Bank Transfer */}
              <button
                type="button"
                className={`payment-cat-card ${paymentCategory === 'bank_transfer' ? 'payment-cat-card--active' : ''}`}
                onClick={() => handleSelectMethod('bank_transfer')}
                style={{ '--cat-accent': '#8b5cf6' }}
              >
                <div className="payment-cat-card__icon">
                  <Building2 size={32} />
                </div>
                <div className="payment-cat-card__info">
                  <span className="payment-cat-card__title">2. Bank Transfer</span>
                  <span className="payment-cat-card__hint">BDO, BPI, UnionBank, etc.</span>
                </div>
                <div className="payment-cat-card__arrow">
                  <ArrowRight size={16} />
                </div>
              </button>

              {/* Category 3: E-Wallet (GCASH / MAYA) */}
              <button
                type="button"
                className={`payment-cat-card ${paymentCategory === 'ewallet' ? 'payment-cat-card--active' : ''}`}
                onClick={() => handleSelectMethod('ewallet')}
                style={{ '--cat-accent': '#007dfa' }}
              >
                <div className="payment-cat-card__icon">
                  <Smartphone size={32} />
                </div>
                <div className="payment-cat-card__info">
                  <span className="payment-cat-card__title">3. E-Wallet</span>
                  <span className="payment-cat-card__hint">GCash & Maya Payment</span>
                </div>
                <div className="payment-cat-card__arrow">
                  <ArrowRight size={16} />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* Step 2: Amount & Details Entry         */}
        {/* ═══════════════════════════════════════ */}
        {step === 'amount' && (
          <div className="payment-step animate-fade-in">
            <h2 className="payment-title">
              {paymentCategory === 'cash' && 'Cash Payment Settlement'}
              {paymentCategory === 'bank_transfer' && 'Bank Transfer Verification'}
              {paymentCategory === 'ewallet' && 'E-Wallet Payment (GCash / Maya)'}
            </h2>

            <div className="payment-amount-display">
              <div className="payment-amount-row">
                <span>Total Bill</span>
                <span>₱{total.toFixed(2)}</span>
              </div>

              {/* Cash Input */}
              {paymentCategory === 'cash' && (
                <>
                  <div className="payment-amount-input-wrapper">
                    <span className="payment-currency">₱</span>
                    <span className="payment-amount-value">{amountReceived || '0'}</span>
                  </div>

                  <div className={`payment-change ${change >= 0 ? 'payment-change--positive' : 'payment-change--negative'}`}>
                    <span>Change Due</span>
                    <span>₱{change >= 0 ? change.toFixed(2) : '0.00'}</span>
                  </div>
                </>
              )}

              {/* Bank Transfer Details */}
              {paymentCategory === 'bank_transfer' && (
                <div className="payment-bank-form">
                  <div className="payment-sub-selector">
                    <label>Select Receiving Bank:</label>
                    <div className="bank-pills">
                      {BANK_OPTIONS.map(bank => (
                        <button
                          key={bank}
                          type="button"
                          className={`bank-pill ${selectedBank === bank ? 'bank-pill--active' : ''}`}
                          onClick={() => setSelectedBank(bank)}
                        >
                          {bank}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="payment-ref-group">
                    <label>Bank Reference / Trace Number</label>
                    <input
                      type="text"
                      className="payment-ref-input"
                      placeholder="e.g. TR-9874521"
                      value={bankRefNumber}
                      onChange={e => setBankRefNumber(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* E-Wallet (GCash / Maya) Details */}
              {paymentCategory === 'ewallet' && (
                <div className="payment-ewallet-form">
                  <div className="payment-sub-selector">
                    <label>Select E-Wallet Provider:</label>
                    <div className="ewallet-pills">
                      {EWALLET_OPTIONS.map(provider => (
                        <button
                          key={provider.id}
                          type="button"
                          className={`ewallet-pill ${selectedEwallet === provider.id ? 'ewallet-pill--active' : ''}`}
                          style={{ '--provider-color': provider.color }}
                          onClick={() => setSelectedEwallet(provider.id)}
                        >
                          <Smartphone size={16} />
                          <span>{provider.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="payment-ref-group">
                    <label>{selectedEwallet === 'gcash' ? 'GCash' : 'Maya'} Reference Number</label>
                    <input
                      type="text"
                      className="payment-ref-input"
                      placeholder={selectedEwallet === 'gcash' ? 'e.g. 1002 987 654321' : 'e.g. MAYA-8765432'}
                      value={ewalletRefNumber}
                      onChange={e => setEwalletRefNumber(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Amounts & Numpad for Cash */}
            {paymentCategory === 'cash' && (
              <>
                <div className="payment-quick-amounts">
                  {quickAmounts.map(qa => (
                    <button
                      key={qa.label}
                      type="button"
                      className="payment-quick-btn"
                      onClick={() => setAmountReceived(String(qa.value))}
                    >
                      {qa.label}
                    </button>
                  ))}
                </div>

                <div className="payment-numpad">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map(key => (
                    <button
                      key={key}
                      type="button"
                      className="payment-numpad-btn"
                      onClick={() => handleNumpadInput(key)}
                    >
                      {key === 'backspace' ? '⌫' : key}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="payment-actions">
              <button
                type="button"
                className="payment-back-btn"
                onClick={() => setStep('method')}
              >
                Back to Methods
              </button>
              <button
                type="button"
                className="payment-confirm-btn"
                disabled={processing || (paymentCategory === 'cash' && parseFloat(amountReceived || 0) < total)}
                onClick={handleConfirmPayment}
              >
                {processing ? 'Processing...' : `Confirm ₱${total.toFixed(2)} Payment`}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* Step 3: Success & Auto-Direct to Dashboard */}
        {/* ═══════════════════════════════════════ */}
        {step === 'success' && orderData && (
          <div className="payment-step payment-success animate-scale-in">
            <div className="payment-success-icon">
              <Check size={44} />
            </div>
            <h2>Bar Bill Paid Successfully!</h2>
            <p className="payment-success-order">Receipt #{orderData.orderNumber}</p>

            {/* Auto-redirect countdown banner */}
            <div className="auto-redirect-banner">
              <div className="auto-redirect-info">
                <Clock size={16} />
                <span>
                  {!autoRedirectPaused
                    ? `Directing to Accounting Dashboard in ${countdown}s...`
                    : 'Auto-direct paused'}
                </span>
              </div>
              <button
                type="button"
                className="auto-redirect-pause-btn"
                onClick={() => setAutoRedirectPaused(!autoRedirectPaused)}
              >
                {!autoRedirectPaused ? 'Pause' : 'Resume'}
              </button>
            </div>

            <ReceiptPreview order={orderData} />

            <div className="payment-success-actions">
              <button
                type="button"
                className="payment-dashboard-btn"
                onClick={() => {
                  onComplete();
                  navigate('/dashboard');
                }}
              >
                <LayoutDashboard size={18} />
                <span>Accounting Dashboard</span>
              </button>
              <button
                type="button"
                className="payment-done-btn"
                onClick={onComplete}
              >
                Next Bar Sale (Done)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
