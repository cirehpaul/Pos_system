import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, X, CreditCard } from 'lucide-react';
import db from '../../db/database';
import useCartStore from '../../stores/cartStore';
import PaymentModal from '../payment/PaymentModal';
import { useToast } from '../../components/Toast/Toast';
import './POSScreen.css';

export default function POSScreen() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const toast = useToast();

  const { items, addItem, updateQuantity, removeItem, clearCart, getSubtotal, getItemCount } = useCartStore();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const cats = await db.categories.orderBy('sortOrder').toArray();
    const prods = await db.products.toArray();
    setCategories(cats);
    setProducts(prods.filter(p => p.status !== 'deleted'));
  };

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (activeCategory !== 'all') {
      filtered = filtered.filter(p => p.categoryId === activeCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [products, activeCategory, searchQuery]);

  const handleAddToCart = (product) => {
    if (product.status === 'out_of_stock' || product.stock <= 0) {
      toast.warning('This item is out of stock');
      return;
    }
    const result = addItem(product);
    if (!result.success) {
      toast.warning(result.message);
    }
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      toast.warning('Cart is empty');
      return;
    }
    setShowPayment(true);
  };

  const handlePaymentComplete = () => {
    setShowPayment(false);
    loadData(); // Refresh products to get updated stock
  };

  const subtotal = getSubtotal();
  const itemCount = getItemCount();

  return (
    <div className="pos">
      {/* Left Panel - Products */}
      <div className="pos__products">
        {/* Categories */}
        <div className="pos__categories">
          <button
            className={`pos__category-btn ${activeCategory === 'all' ? 'pos__category-btn--active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`pos__category-btn ${activeCategory === cat.id ? 'pos__category-btn--active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
              style={activeCategory === cat.id ? { '--cat-color': cat.color } : {}}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="pos__search">
          <Search size={18} className="pos__search-icon" />
          <input
            type="search"
            placeholder="Search products..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pos__search-input"
          />
          {searchQuery && (
            <button className="pos__search-clear" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Product Grid */}
        <div className="pos__product-grid">
          {filteredProducts.length === 0 ? (
            <div className="pos__no-products">
              <Package size={48} />
              <p>No products found</p>
              {searchQuery && <span>Try a different search term</span>}
            </div>
          ) : (
            filteredProducts.map(product => {
              const inCart = items.find(i => i.productId === product.id);
              const isOutOfStock = product.status === 'out_of_stock' || product.stock <= 0;
              return (
                <button
                  key={product.id}
                  className={`pos__product-card ${isOutOfStock ? 'pos__product-card--disabled' : ''} ${inCart ? 'pos__product-card--in-cart' : ''}`}
                  onClick={() => handleAddToCart(product)}
                  disabled={isOutOfStock}
                >
                  <div className="pos__product-image">
                    {product.image ? (
                      <img src={product.image} alt={product.name} />
                    ) : (
                      <div className="pos__product-placeholder">
                        <ShoppingCart size={24} />
                      </div>
                    )}
                    {isOutOfStock && (
                      <div className="pos__product-badge pos__product-badge--out">
                        Out of Stock
                      </div>
                    )}
                    {!isOutOfStock && product.stock <= 10 && (
                      <div className="pos__product-badge pos__product-badge--low">
                        {product.stock} left
                      </div>
                    )}
                    {inCart && (
                      <div className="pos__product-qty-badge">
                        {inCart.quantity}
                      </div>
                    )}
                  </div>
                  <div className="pos__product-info">
                    <span className="pos__product-name">{product.name}</span>
                    <span className="pos__product-price">₱{product.price.toFixed(2)}</span>
                  </div>
                </button>
              );
            })
          )}
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

function Package({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
    </svg>
  );
}
