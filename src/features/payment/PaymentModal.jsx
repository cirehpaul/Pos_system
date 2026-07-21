import { useState } from 'react';
import { X, Banknote, Smartphone, Check, Printer } from 'lucide-react';
import db from '../../db/database';
import useCartStore from '../../stores/cartStore';
import useAuthStore from '../../stores/authStore';
import { useToast } from '../../components/Toast/Toast';
import ReceiptPreview from '../receipt/ReceiptPreview';
import './PaymentModal.css';

export default function PaymentModal({ onClose, onComplete }) {
  const [step, setStep] = useState('method'); // method, amount, success
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [amountReceived, setAmountReceived] = useState('');
  const [orderData, setOrderData] = useState(null);
  const [processing, setProcessing] = useState(false);

  const { items, getSubtotal, clearCart } = useCartStore();
  const { currentUser } = useAuthStore();
  const toast = useToast();

  const total = getSubtotal();
  const change = parseFloat(amountReceived || 0) - total;

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
        // Limit to 2 decimal places
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

  const handleConfirmPayment = async () => {
    if (paymentMethod === 'cash' && parseFloat(amountReceived || 0) < total) {
      toast.error('Insufficient amount');
      return;
    }

    setProcessing(true);

    try {
      // Generate order number
      const orderCount = await db.orders.count();
      const orderNumber = `ORD-${String(orderCount + 1).padStart(6, '0')}`;

      const order = {
        id: crypto.randomUUID(),
        orderNumber,
        items: items.map(item => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.subtotal
        })),
        subtotal: total,
        tax: 0,
        total: total,
        paymentMethod,
        amountReceived: paymentMethod === 'cash' ? parseFloat(amountReceived) : total,
        change: paymentMethod === 'cash' ? change : 0,
        cashierName: currentUser?.name || 'Unknown',
        status: 'completed',
        createdAt: new Date().toISOString()
      };

      // Save order
      await db.orders.add(order);

      // Deduct stock
      for (const item of items) {
        const product = await db.products.get(item.productId);
        if (product) {
          const newStock = Math.max(0, product.stock - item.quantity);
          await db.products.update(item.productId, {
            stock: newStock,
            status: newStock === 0 ? 'out_of_stock' : 'available',
            updatedAt: new Date().toISOString()
          });
        }
      }

      setOrderData(order);
      setStep('success');
      clearCart();
      toast.success('Payment successful!');
    } catch (err) {
      console.error('Payment error:', err);
      toast.error('Payment failed. Please try again.');
    }

    setProcessing(false);
  };

  return (
    <div className="payment-overlay" onClick={onClose}>
      <div className="payment-modal" onClick={e => e.stopPropagation()}>
        {/* Close */}
        {step !== 'success' && (
          <button className="payment-close" onClick={onClose}>
            <X size={24} />
          </button>
        )}

        {/* Step 1: Select Payment Method */}
        {step === 'method' && (
          <div className="payment-step animate-fade-in">
            <h2 className="payment-title">Select Payment Method</h2>
            <div className="payment-total-display">
              <span>Total Amount</span>
              <h1>₱{total.toFixed(2)}</h1>
            </div>
            <div className="payment-methods">
              <button
                className={`payment-method-btn ${paymentMethod === 'cash' ? 'payment-method-btn--active' : ''}`}
                onClick={() => setPaymentMethod('cash')}
              >
                <Banknote size={32} />
                <span>Cash</span>
              </button>
              <button
                className={`payment-method-btn ${paymentMethod === 'gcash' ? 'payment-method-btn--active' : ''}`}
                onClick={() => setPaymentMethod('gcash')}
              >
                <Smartphone size={32} />
                <span>GCash</span>
              </button>
            </div>
            <button
              className="payment-next-btn"
              disabled={!paymentMethod}
              onClick={() => {
                if (paymentMethod === 'gcash') {
                  setAmountReceived(String(total));
                  setStep('amount');
                } else {
                  setStep('amount');
                }
              }}
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Enter Amount */}
        {step === 'amount' && (
          <div className="payment-step animate-fade-in">
            <h2 className="payment-title">
              {paymentMethod === 'cash' ? 'Enter Cash Received' : 'GCash Payment'}
            </h2>

            <div className="payment-amount-display">
              <div className="payment-amount-row">
                <span>Total</span>
                <span>₱{total.toFixed(2)}</span>
              </div>
              <div className="payment-amount-input-wrapper">
                <span className="payment-currency">₱</span>
                <span className="payment-amount-value">
                  {amountReceived || '0'}
                </span>
              </div>
              {paymentMethod === 'cash' && (
                <div className={`payment-change ${change >= 0 ? 'payment-change--positive' : 'payment-change--negative'}`}>
                  <span>Change</span>
                  <span>₱{change >= 0 ? change.toFixed(2) : '0.00'}</span>
                </div>
              )}
            </div>

            {/* Quick Amounts */}
            {paymentMethod === 'cash' && (
              <div className="payment-quick-amounts">
                {quickAmounts.map(qa => (
                  <button
                    key={qa.label}
                    className="payment-quick-btn"
                    onClick={() => setAmountReceived(String(qa.value))}
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            )}

            {/* Number Pad */}
            {paymentMethod === 'cash' && (
              <div className="payment-numpad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map(key => (
                  <button
                    key={key}
                    className="payment-numpad-btn"
                    onClick={() => handleNumpadInput(key)}
                  >
                    {key === 'backspace' ? '⌫' : key}
                  </button>
                ))}
              </div>
            )}

            <div className="payment-actions">
              <button className="payment-back-btn" onClick={() => setStep('method')}>
                Back
              </button>
              <button
                className="payment-confirm-btn"
                disabled={processing || (paymentMethod === 'cash' && parseFloat(amountReceived || 0) < total)}
                onClick={handleConfirmPayment}
              >
                {processing ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && orderData && (
          <div className="payment-step payment-success animate-scale-in">
            <div className="payment-success-icon">
              <Check size={48} />
            </div>
            <h2>Payment Successful!</h2>
            <p className="payment-success-order">Order #{orderData.orderNumber}</p>

            <ReceiptPreview order={orderData} />

            <div className="payment-success-actions">
              <button className="payment-done-btn" onClick={onComplete}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
