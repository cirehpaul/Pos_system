import { useState } from 'react';
import { Plus, Minus, Trash2, ShoppingCart, X, CreditCard } from 'lucide-react';
import useCartStore from '../../stores/cartStore';
import PaymentModal from '../payment/PaymentModal';
import EventFloorPlan from './EventFloorPlan';
import { useToast } from '../../components/Toast/Toast';
import './POSScreen.css';

export default function POSScreen() {
  const [showPayment, setShowPayment] = useState(false);
  const toast = useToast();

  const { items, updateQuantity, removeItem, clearCart, getSubtotal, getItemCount } = useCartStore();

  const handleCheckout = () => {
    if (items.length === 0) {
      toast.warning('Cart is empty');
      return;
    }
    setShowPayment(true);
  };

  const handlePaymentComplete = () => {
    setShowPayment(false);
  };

  const subtotal = getSubtotal();
  const itemCount = getItemCount();

  return (
    <div className="pos">
      {/* Main Panel - Event Floor Plan & Table Booking */}
      <div className="pos__products pos__products--floorplan-only">
        <div className="pos__floorplan-scroll">
          <EventFloorPlan />
        </div>
      </div>

      {/* Right Panel - Cart */}
      <div className="pos__cart">
        <div className="pos__cart-header">
          <div className="pos__cart-title">
            <ShoppingCart size={20} />
            <h3>Current Order</h3>
          </div>
          <span className="pos__cart-count">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Cart Items */}
        <div className="pos__cart-items">
          {items.length === 0 ? (
            <div className="pos__cart-empty">
              <ShoppingCart size={40} />
              <p>Cart is empty</p>
              <span>Tap products to add them</span>
            </div>
          ) : (
            items.map(item => (
              <div key={item.productId} className="pos__cart-item animate-cart-enter">
                <div className="pos__cart-item-info">
                  <span className="pos__cart-item-name">{item.name}</span>
                  <span className="pos__cart-item-price">₱{item.price.toFixed(2)} each</span>
                </div>
                <div className="pos__cart-item-controls">
                  <button
                    className="pos__qty-btn"
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="pos__qty-value">{item.quantity}</span>
                  <button
                    className="pos__qty-btn"
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    className="pos__remove-btn"
                    onClick={() => removeItem(item.productId)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="pos__cart-item-subtotal">
                  ₱{item.subtotal.toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Summary */}
        <div className="pos__cart-summary">
          <div className="pos__cart-row">
            <span>Subtotal</span>
            <span>₱{subtotal.toFixed(2)}</span>
          </div>
          <div className="pos__cart-row pos__cart-row--total">
            <span>Total</span>
            <span>₱{subtotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="pos__cart-actions">
          <button
            className="pos__action-btn pos__action-btn--clear"
            onClick={() => {
              if (items.length > 0) {
                clearCart();
                toast.info('Cart cleared');
              }
            }}
            disabled={items.length === 0}
          >
            <X size={18} />
            Clear
          </button>
          <button
            className="pos__action-btn pos__action-btn--checkout"
            onClick={handleCheckout}
            disabled={items.length === 0}
          >
            <CreditCard size={18} />
            Checkout — ₱{subtotal.toFixed(2)}
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          onClose={() => setShowPayment(false)}
          onComplete={handlePaymentComplete}
        />
      )}
    </div>
  );
}
