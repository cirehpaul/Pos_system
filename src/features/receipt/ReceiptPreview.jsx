import { format } from 'date-fns';
import './ReceiptPreview.css';

export default function ReceiptPreview({ order }) {
  if (!order) return null;

  return (
    <div className="receipt">
      <div className="receipt__paper">
        {/* Header */}
        <div className="receipt__header">
          <h3 className="receipt__store-name">My Food Shop</h3>
          <p className="receipt__store-address">123 Main Street, City</p>
          <div className="receipt__divider">{'─'.repeat(32)}</div>
        </div>

        {/* Info */}
        <div className="receipt__info">
          <div className="receipt__info-row">
            <span>Receipt #:</span>
            <span>{order.orderNumber}</span>
          </div>
          <div className="receipt__info-row">
            <span>Date:</span>
            <span>{format(new Date(order.createdAt), 'MMM dd, yyyy')}</span>
          </div>
          <div className="receipt__info-row">
            <span>Time:</span>
            <span>{format(new Date(order.createdAt), 'hh:mm a')}</span>
          </div>
          <div className="receipt__info-row">
            <span>Cashier:</span>
            <span>{order.cashierName}</span>
          </div>
        </div>

        <div className="receipt__divider">{'─'.repeat(32)}</div>

        {/* Items */}
        <div className="receipt__items">
          <div className="receipt__items-header">
            <span>Item</span>
            <span>Qty</span>
            <span>Price</span>
          </div>
          {order.items.map((item, idx) => (
            <div key={idx} className="receipt__item">
              <span className="receipt__item-name">{item.name}</span>
              <span className="receipt__item-qty">{item.quantity}</span>
              <span className="receipt__item-price">₱{item.subtotal.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="receipt__divider">{'─'.repeat(32)}</div>

        {/* Totals */}
        <div className="receipt__totals">
          <div className="receipt__total-row">
            <span>Subtotal</span>
            <span>₱{order.subtotal.toFixed(2)}</span>
          </div>
          {order.tax > 0 && (
            <div className="receipt__total-row">
              <span>Tax</span>
              <span>₱{order.tax.toFixed(2)}</span>
            </div>
          )}
          <div className="receipt__total-row receipt__total-row--grand">
            <span>TOTAL</span>
            <span>₱{order.total.toFixed(2)}</span>
          </div>
          <div className="receipt__total-row">
            <span>Payment</span>
            <span>{order.paymentMethod === 'cash' ? 'Cash' : 'GCash'}</span>
          </div>
          {order.paymentMethod === 'cash' && (
            <>
              <div className="receipt__total-row">
                <span>Received</span>
                <span>₱{order.amountReceived.toFixed(2)}</span>
              </div>
              <div className="receipt__total-row">
                <span>Change</span>
                <span>₱{order.change.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        <div className="receipt__divider">{'─'.repeat(32)}</div>

        {/* Footer */}
        <div className="receipt__footer">
          <p>Thank you for your purchase!</p>
          <p className="receipt__footer-small">Please come again</p>
        </div>
      </div>
    </div>
  );
}
