import { useState, useEffect } from 'react';
import { Search, Printer, Calendar as CalendarIcon, Eye } from 'lucide-react';
import { format } from 'date-fns';
import db from '../../db/database';
import Modal from '../../components/Modal/Modal';
import ReceiptPreview from '../receipt/ReceiptPreview';
import './SalesScreen.css';

export default function SalesScreen() {
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    // Load all completed orders, sort by newest first
    const allOrders = await db.orders
      .where('status')
      .equals('completed')
      .reverse()
      .sortBy('createdAt');
    setOrders(allOrders);
  };

  const filteredOrders = orders.filter(order => {
    const query = searchQuery.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(query) ||
      (order.cashierName && order.cashierName.toLowerCase().includes(query)) ||
      (order.paymentMethod && order.paymentMethod.toLowerCase().includes(query))
    );
  });

  return (
    <div className="sales-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Sales History</h1>
          <p>View past transactions and reprint receipts</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sales-toolbar">
        <div className="search-bar sales-search">
          <Search size={18} className="search-bar__icon" />
          <input
            type="search"
            placeholder="Search receipt number, cashier, or payment method..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="sales-list">
        {filteredOrders.length === 0 ? (
          <div className="empty-state">
            <CalendarIcon size={48} />
            <h3>No sales found</h3>
            <p>Your transaction history is empty.</p>
          </div>
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
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => (
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
                    <td className="text-right font-semibold">
                      ₱{order.total?.toFixed(2)}
                    </td>
                    <td>
                      <div className="table-actions justify-center">
                        <button 
                          className="btn btn--ghost btn--small"
                          onClick={() => setSelectedOrder(order)}
                        >
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

      {/* View Order Modal */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title="Transaction Details"
        size="sm"
      >
        {selectedOrder && (
          <div className="order-details">
            <div className="receipt-container">
              <ReceiptPreview order={selectedOrder} />
            </div>
            <div className="form-actions mt-4">
              <button className="btn btn--ghost" onClick={() => setSelectedOrder(null)}>
                Close
              </button>
              <button className="btn btn--primary" onClick={() => window.print()}>
                <Printer size={18} /> Reprint Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
