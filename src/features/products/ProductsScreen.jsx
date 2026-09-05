import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Package, Search } from 'lucide-react';
import db from '../../db/database';
import Modal from '../../components/Modal/Modal';
import { useToast } from '../../components/Toast/Toast';
import './ProductsScreen.css';

export default function ProductsScreen() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    sku: '',
    price: '',
    cost: '',
    stock: '',
    minStock: '10',
    description: '',
    status: 'available',
    image: ''
  });
  
  const toast = useToast();

  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const cats = await db.categories.orderBy('sortOrder').toArray();
    const prods = await db.products.toArray();
    setCategories(cats);
    setProducts(prods.filter(p => p.status !== 'deleted'));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, image: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAddModal = (categoryId) => {
    setEditingProduct(null);
    setFormData({
      name: '',
      categoryId: categoryId,
      sku: '',
      price: '',
      cost: '',
      stock: '',
      minStock: '10',
      description: '',
      status: 'available',
      image: ''
    });
    setShowModal(true);
  };

  const handleEdit = (prod) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name,
      categoryId: prod.categoryId,
      sku: prod.sku || '',
      price: prod.price,
      cost: prod.cost || '',
      stock: prod.stock,
      minStock: prod.minStock !== undefined && prod.minStock !== null ? prod.minStock : 10,
      description: prod.description || '',
      status: prod.status,
      image: prod.image || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.categoryId || formData.price === '' || formData.stock === '') {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const productData = {
        name: formData.name.trim(),
        categoryId: formData.categoryId,
        sku: (formData.sku || '').trim(),
        price: parseFloat(formData.price),
        cost: formData.cost ? parseFloat(formData.cost) : 0,
        stock: parseInt(formData.stock, 10),
        minStock: formData.minStock !== '' ? parseInt(formData.minStock, 10) : 10,
        description: formData.description.trim(),
        status: parseInt(formData.stock, 10) > 0 ? formData.status : 'out_of_stock',
        image: formData.image,
        updatedAt: new Date().toISOString()
      };

      if (editingProduct) {
        await db.products.update(editingProduct.id, productData);
        toast.success('Menu item updated');
      } else {
        await db.products.add({
          ...productData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString()
        });
        toast.success('Menu item added');
      }
      
      closeModal();
      loadData();
    } catch (err) {
      console.error('Failed to save menu item:', err);
      toast.error('Failed to save menu item');
    }
  };

  const handleDelete = async (prod) => {
    try {
      await db.products.update(prod.id, { status: 'deleted' });
      toast.success('Menu item deleted');
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete menu item:', err);
      toast.error('Failed to delete menu item');
    }
  };

  const handleDeleteCategory = async (category) => {
    try {
      await db.categories.delete(category.id);
      toast.success('Category deleted');
      setDeleteCategoryConfirm(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete category:', err);
      toast.error('Failed to delete category');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  const getFilteredProducts = (categoryId) => {
    return products.filter(p => {
      const isInCategory = p.categoryId === categoryId;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return isInCategory && matchesSearch;
    });
  };

  return (
    <div className="menu-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Menu Management</h1>
          <p>Organize your foods, drinks, and snacks by category</p>
        </div>
        <div className="search-bar menu-search">
          <Search size={18} className="search-bar__icon" />
          <input
            type="search"
            placeholder="Search menu items..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="menu-sections">
        {categories.length === 0 ? (
          <div className="empty-state">
            <Package size={48} />
            <h3>No Categories Found</h3>
            <p>Please create a category first before adding menu items.</p>
          </div>
        ) : (
          categories.map(category => {
            const categoryProducts = getFilteredProducts(category.id);
            // Don't show empty categories if searching (unless we want to let them add to it)
            if (searchQuery && categoryProducts.length === 0) return null;

            return (
              <div key={category.id} className="menu-section">
                <div className="menu-section__header">
                  <div className="menu-section__title" style={{ '--cat-color': category.color }}>
                    <span className="menu-section__dot"></span>
                    <h2>{category.name}</h2>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button 
                      className="icon-btn icon-btn--danger"
                      onClick={() => setDeleteCategoryConfirm(category)}
                      title="Delete Category"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button 
                      className="btn btn--primary btn--small"
                      onClick={() => handleOpenAddModal(category.id)}
                    >
                      <Plus size={16} /> Add Menu Item
                    </button>
                  </div>
                </div>

                <div className="menu-grid">
                  {categoryProducts.map(prod => {
                    const isOutOfStock = prod.stock <= 0 || prod.status === 'out_of_stock';
                    return (
                      <div key={prod.id} className={`menu-card ${isOutOfStock ? 'menu-card--disabled' : ''}`}>
                        <div className="menu-card__image">
                          {prod.image ? (
                            <img src={prod.image} alt={prod.name} />
                          ) : (
                            <div className="menu-card__placeholder">
                              <Package size={24} />
                            </div>
                          )}
                          {isOutOfStock && (
                            <div className="menu-card__badge bg-danger">Out of Stock</div>
                          )}
                          {!isOutOfStock && prod.stock <= 10 && (
                            <div className="menu-card__badge bg-warning">{prod.stock} Left</div>
                          )}
                        </div>
                        <div className="menu-card__content">
                          <h3 className="menu-card__name">{prod.name}</h3>
                          <div className="menu-card__details">
                            <span className="menu-card__price">₱{prod.price.toFixed(2)}</span>
                            {prod.description && <span className="menu-card__desc">{prod.description}</span>}
                          </div>
                          <div className="menu-card__actions">
                            <button className="icon-btn" onClick={() => handleEdit(prod)} title="Edit">
                              <Edit3 size={16} />
                            </button>
                            <button className="icon-btn icon-btn--danger" onClick={() => setDeleteConfirm(prod)} title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {categoryProducts.length === 0 && !searchQuery && (
                    <div className="menu-card menu-card--add" onClick={() => handleOpenAddModal(category.id)}>
                      <Plus size={32} />
                      <span>Add to {category.name}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingProduct ? 'Edit Menu Item' : 'Add Menu Item'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="product-form">
          <div className="form-row">
            {/* Left: Image Upload */}
            <div className="form-group flex-1 image-upload-group">
              <label>Item Image (Optional)</label>
              <div className="image-upload-area">
                {formData.image ? (
                  <div className="image-preview">
                    <img src={formData.image} alt="Preview" />
                    <button type="button" className="image-remove-btn" onClick={() => setFormData(prev => ({ ...prev, image: '' }))}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="image-upload-label">
                    <Package size={32} />
                    <span>Upload Image</span>
                    <input type="file" accept="image/jpeg, image/png, image/webp" onChange={handleImageUpload} hidden />
                  </label>
                )}
              </div>
            </div>

            {/* Right: Basic Info */}
            <div className="flex-2 flex-col gap-3">
              <div className="form-group mb-0">
                <label>Menu Name <span className="text-danger">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Mocha Frappe"
                />
              </div>
              
              <div className="form-row mt-3">
                <div className="form-group flex-1 mb-0">
                  <label>Selling Price (₱) <span className="text-danger">*</span></label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group flex-1 mb-0">
                  <label>Cost (Optional ₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cost}
                    onChange={e => setFormData({ ...formData, cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="form-row mt-3">
            <div className="form-group flex-1">
              <label>Initial Stock <span className="text-danger">*</span></label>
              <input
                type="number"
                required
                min="0"
                step="1"
                value={formData.stock}
                onChange={e => setFormData({ ...formData, stock: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="form-group flex-1">
              <label>Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="available">Available</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </div>

          <div className="form-row mt-3">
            <div className="form-group flex-1">
              <label>SKU / Barcode (Optional)</label>
              <input
                type="text"
                value={formData.sku}
                onChange={e => setFormData({ ...formData, sku: e.target.value })}
                placeholder="e.g. BEV-001"
              />
            </div>
            <div className="form-group flex-1">
              <label>Low Stock Alert Threshold</label>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.minStock}
                onChange={e => setFormData({ ...formData, minStock: e.target.value })}
                placeholder="10"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the item..."
              rows="2"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn btn--primary">
              {editingProduct ? 'Update Menu Item' : 'Save Menu Item'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Menu Item Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Menu Item"
        size="sm"
      >
        <div className="delete-confirm">
          <p>Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?</p>
          <p className="text-sm text-tertiary">This will instantly remove it from the POS ordering screen.</p>
          <div className="form-actions">
            <button className="btn btn--ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn--danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
          </div>
        </div>
      </Modal>

      {/* Delete Category Confirmation */}
      <Modal
        isOpen={!!deleteCategoryConfirm}
        onClose={() => setDeleteCategoryConfirm(null)}
        title="Delete Category"
        size="sm"
      >
        <div className="delete-confirm">
          <p>Are you sure you want to delete the <strong>{deleteCategoryConfirm?.name}</strong> category?</p>
          <p className="text-sm text-tertiary text-warning font-semibold">Note: This will not delete the products inside it, but they won't show up until they are reassigned.</p>
          <div className="form-actions">
            <button className="btn btn--ghost" onClick={() => setDeleteCategoryConfirm(null)}>Cancel</button>
            <button className="btn btn--danger" onClick={() => handleDeleteCategory(deleteCategoryConfirm)}>Delete Category</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
