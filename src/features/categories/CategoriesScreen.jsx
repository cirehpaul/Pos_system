import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, FolderOpen } from 'lucide-react';
import db from '../../db/database';
import Modal from '../../components/Modal/Modal';
import { useToast } from '../../components/Toast/Toast';
import './CategoriesScreen.css';

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'];

export default function CategoriesScreen() {
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', color: '#6366f1' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const toast = useToast();

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    const cats = await db.categories.orderBy('sortOrder').toArray();
    // Count products per category
    const products = await db.products.toArray();
    const catsWithCount = cats.map(cat => ({
      ...cat,
      productCount: products.filter(p => p.categoryId === cat.id && p.status !== 'deleted').length
    }));
    setCategories(catsWithCount);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    try {
      if (editingCategory) {
        await db.categories.update(editingCategory.id, {
          name: formData.name.trim(),
          color: formData.color
        });
        toast.success('Category updated');
      } else {
        await db.categories.add({
          id: crypto.randomUUID(),
          name: formData.name.trim(),
          icon: 'folder',
          color: formData.color,
          sortOrder: categories.length,
          createdAt: new Date().toISOString()
        });
        toast.success('Category added');
      }
      setShowModal(false);
      setEditingCategory(null);
      setFormData({ name: '', color: '#6366f1' });
      loadCategories();
    } catch (err) {
      console.error('Failed to save category:', err);
      toast.error('Failed to save category');
    }
  };

  const handleEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({ name: cat.name, color: cat.color });
    setShowModal(true);
  };

  const handleDelete = async (cat) => {
    try {
      await db.categories.delete(cat.id);
      toast.success('Category deleted');
      setDeleteConfirm(null);
      loadCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
      toast.error('Failed to delete category');
    }
  };

  return (
    <div className="categories-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Categories</h1>
          <p>Manage your product categories</p>
        </div>
        <button className="btn btn--primary" onClick={() => {
          setEditingCategory(null);
          setFormData({ name: '', color: '#6366f1' });
          setShowModal(true);
        }}>
          <Plus size={18} />
          Add Category
        </button>
      </div>

      <div className="categories-grid stagger-children">
        {categories.map(cat => (
          <div key={cat.id} className="category-card" style={{ '--cat-accent': cat.color }}>
            <div className="category-card__color" style={{ background: cat.color }}></div>
            <div className="category-card__content">
              <h3 className="category-card__name">{cat.name}</h3>
              <p className="category-card__count">{cat.productCount} product{cat.productCount !== 1 ? 's' : ''}</p>
            </div>
            <div className="category-card__actions">
              <button className="icon-btn" onClick={() => handleEdit(cat)} title="Edit">
                <Edit3 size={16} />
              </button>
              <button className="icon-btn icon-btn--danger" onClick={() => setDeleteConfirm(cat)} title="Delete">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {categories.length === 0 && (
          <div className="empty-state">
            <FolderOpen size={48} />
            <h3>No categories yet</h3>
            <p>Add your first category to get started</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingCategory(null); }}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="category-form">
          <div className="form-group">
            <label>Category Name</label>
            <input
              type="text"
              placeholder="e.g. Desserts, Beverages..."
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Color</label>
            <div className="color-picker">
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch ${formData.color === color ? 'color-swatch--active' : ''}`}
                  style={{ background: color }}
                  onClick={() => setFormData({ ...formData, color })}
                />
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary">
              {editingCategory ? 'Update' : 'Add'} Category
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Category"
        size="sm"
      >
        <div className="delete-confirm">
          <p>Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?</p>
          {deleteConfirm?.productCount > 0 && (
            <p className="delete-warning">This category has {deleteConfirm.productCount} product(s).</p>
          )}
          <div className="form-actions">
            <button className="btn btn--ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn--danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
