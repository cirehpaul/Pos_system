import { useState, useEffect } from 'react';
import { Search, Filter, Archive, AlertTriangle, Plus } from 'lucide-react';
import db from '../../db/database';
import Modal from '../../components/Modal/Modal';
import { useToast } from '../../components/Toast/Toast';
import './InventoryScreen.css';

export default function InventoryScreen() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, low, out
  
  const [restockProduct, setRestockProduct] = useState(null);
  const [addQty, setAddQty] = useState('');
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const cats = await db.categories.toArray();
    const prods = await db.products.filter(p => p.status !== 'deleted').toArray();
    setCategories(cats);
    setProducts(prods);
  };

  const isProductLowStock = (p) => {
    const minThreshold = p.minStock !== undefined && p.minStock !== null ? p.minStock : 10;
    return p.stock > 0 && p.stock <= minThreshold;
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!addQty || parseInt(addQty, 10) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    try {
      const qty = parseInt(addQty, 10);
      const newStock = restockProduct.stock + qty;
      await db.products.update(restockProduct.id, {
        stock: newStock,
        status: 'available', // If it was out_of_stock, it's now available
        updatedAt: new Date().toISOString()
      });

      await db.inventoryTransactions.add({
        id: crypto.randomUUID(),
        productId: restockProduct.id,
        type: 'restock',
        quantity: qty,
        costPerUnit: restockProduct.cost || 0,
        previousStock: restockProduct.stock,
        newStock,
        reference: '',
        notes: 'Restocked from inventory management',
        createdAt: new Date().toISOString()
      });
      
      toast.success(`Added ${addQty} units to ${restockProduct.name}`);
      setRestockProduct(null);
      setAddQty('');
      loadData();
    } catch (err) {
      console.error('Failed to update stock:', err);
      toast.error('Failed to update stock');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'low') {
      matchesStatus = isProductLowStock(p);
    } else if (statusFilter === 'out') {
      matchesStatus = p.stock === 0 || p.status === 'out_of_stock';
    }
    
    return matchesSearch && matchesStatus;
  });

  // Calculate quick stats
  const outOfStockCount = products.filter(p => p.stock === 0 || p.status === 'out_of_stock').length;
  const lowStockCount = products.filter(isProductLowStock).length;
  const totalItems = products.reduce((sum, p) => sum + p.stock, 0);

  return (
    <div className="inventory-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Inventory Management</h1>
          <p>Track your stock levels and restock items</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="inventory-summary stagger-children">
        <div className="summary-card">
          <div className="summary-card__icon bg-primary-light text-primary">
            <Archive size={24} />
          </div>
          <div className="summary-card__info">
            <span className="summary-card__label">Total Items in Stock</span>
            <span className="summary-card__value">{totalItems}</span>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-card__icon bg-warning-light text-warning">
            <AlertTriangle size={24} />
          </div>
          <div className="summary-card__info">
            <span className="summary-card__label">Low Stock Items</span>
            <span className="summary-card__value">{lowStockCount}</span>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card__icon bg-danger-light text-danger">
            <AlertTriangle size={24} />
          </div>
          <div className="summary-card__info">
            <span className="summary-card__label">Out of Stock</span>
            <span className="summary-card__value">{outOfStockCount}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="products-filters">
        <div className="search-bar">
          <Search size={18} className="search-bar__icon" />
          <input
            type="search"
            placeholder="Search products..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-select">
          <Filter size={18} className="filter-select__icon" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="products-list">
        {filteredProducts.length === 0 ? (
          <div className="empty-state">
            <Archive size={48} />
            <h3>No products found</h3>
            <p>Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="text-center">Current Stock</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(prod => {
                  const category = categories.find(c => c.id === prod.categoryId);
                  const isLowStock = isProductLowStock(prod);
                  const isOutOfStock = prod.stock <= 0 || prod.status === 'out_of_stock';

                  return (
                    <tr key={prod.id}>
                      <td className="font-medium">{prod.name}</td>
                      <td>
                        <span className="category-badge" style={{ '--cat-color': category?.color || '#ccc' }}>
                          {category?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={`stock-number ${isOutOfStock ? 'text-danger' : isLowStock ? 'text-warning' : 'text-success'}`}>
                          {prod.stock}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge status-badge--${isOutOfStock ? 'danger' : isLowStock ? 'warning' : 'success'}`}>
                          {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button 
                            className="btn btn--primary btn--small"
                            onClick={() => setRestockProduct(prod)}
                          >
                            <Plus size={16} /> Add Stock
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restock Modal */}
      <Modal
        isOpen={!!restockProduct}
        onClose={() => { setRestockProduct(null); setAddQty(''); }}
        title="Restock Item"
        size="sm"
      >
        {restockProduct && (
          <form onSubmit={handleRestockSubmit} className="category-form">
            <div className="restock-info">
              <span className="text-tertiary">Product:</span>
              <span className="font-semibold">{restockProduct.name}</span>
            </div>
            <div className="restock-info mb-4">
              <span className="text-tertiary">Current Stock:</span>
              <span className="font-bold text-primary">{restockProduct.stock}</span>
            </div>

            <div className="form-group">
              <label>Quantity to Add</label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={addQty}
                onChange={e => setAddQty(e.target.value)}
                placeholder="e.g. 50"
                autoFocus
              />
            </div>
            
            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setRestockProduct(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary">
                Update Stock
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
