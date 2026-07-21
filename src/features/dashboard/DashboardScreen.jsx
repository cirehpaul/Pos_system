import { useState, useEffect } from 'react';
import { DollarSign, ShoppingBag, TrendingUp, AlertTriangle, Package, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format } from 'date-fns';
import db from '../../db/database';
import './DashboardScreen.css';

export default function DashboardScreen() {
  const [stats, setStats] = useState({
    todaySales: 0,
    todayOrders: 0,
    bestSellers: [],
    lowStockItems: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Get today's orders
      const allOrders = await db.orders.toArray();
      const todayOrders = allOrders.filter(o => 
        o.createdAt && o.createdAt.startsWith(today) && o.status === 'completed'
      );
      
      const todaySales = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

      // Get best sellers from all orders
      const itemCounts = {};
      allOrders.filter(o => o.status === 'completed').forEach(order => {
        (order.items || []).forEach(item => {
          if (itemCounts[item.name]) {
            itemCounts[item.name].quantity += item.quantity;
            itemCounts[item.name].revenue += item.subtotal;
          } else {
            itemCounts[item.name] = {
              name: item.name,
              quantity: item.quantity,
              revenue: item.subtotal
            };
          }
        });
      });
      
      const bestSellers = Object.values(itemCounts)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      // Get low stock items
      const lowStockThreshold = 10;
      const products = await db.products.toArray();
      const lowStockItems = products
        .filter(p => p.stock <= lowStockThreshold && p.status !== 'deleted')
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 8);

      setStats({
        todaySales,
        todayOrders: todayOrders.length,
        bestSellers,
        lowStockItems
      });
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard__header">
          <h1>Dashboard</h1>
          <p className="dashboard__date">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="dashboard__cards stagger-children">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="stat-card skeleton" style={{ height: 140 }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard__header">
        <div>
          <h1>Dashboard</h1>
          <p className="dashboard__date">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="dashboard__cards stagger-children">
        <div className="stat-card stat-card--sales">
          <div className="stat-card__icon">
            <DollarSign size={24} />
          </div>
          <div className="stat-card__content">
            <p className="stat-card__label">Today's Sales</p>
            <h2 className="stat-card__value animate-count">₱{stats.todaySales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</h2>
          </div>
          <div className="stat-card__trend stat-card__trend--up">
            <ArrowUpRight size={16} />
          </div>
        </div>

        <div className="stat-card stat-card--orders">
          <div className="stat-card__icon">
            <ShoppingBag size={24} />
          </div>
          <div className="stat-card__content">
            <p className="stat-card__label">Total Orders</p>
            <h2 className="stat-card__value animate-count">{stats.todayOrders}</h2>
          </div>
        </div>

        <div className="stat-card stat-card--products">
          <div className="stat-card__icon">
            <Package size={24} />
          </div>
          <div className="stat-card__content">
            <p className="stat-card__label">Total Products</p>
            <h2 className="stat-card__value animate-count">{stats.lowStockItems.length > 0 ? stats.lowStockItems.length + ' low' : 'All good'}</h2>
          </div>
        </div>

        <div className="stat-card stat-card--trending">
          <div className="stat-card__icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-card__content">
            <p className="stat-card__label">Best Seller</p>
            <h2 className="stat-card__value animate-count" style={{ fontSize: 'var(--font-size-lg)' }}>
              {stats.bestSellers[0]?.name || 'No sales yet'}
            </h2>
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="dashboard__grid">
        {/* Best Selling Items */}
        <div className="dashboard__panel animate-fade-in-up">
          <div className="dashboard__panel-header">
            <h3><TrendingUp size={18} /> Best Selling Items</h3>
          </div>
          <div className="dashboard__panel-body">
            {stats.bestSellers.length === 0 ? (
              <div className="dashboard__empty">
                <p>No sales data yet. Start selling!</p>
              </div>
            ) : (
              <div className="bestseller-list">
                {stats.bestSellers.map((item, index) => (
                  <div key={item.name} className="bestseller-item">
                    <div className="bestseller-item__rank">#{index + 1}</div>
                    <div className="bestseller-item__info">
                      <span className="bestseller-item__name">{item.name}</span>
                      <span className="bestseller-item__qty">{item.quantity} sold</span>
                    </div>
                    <span className="bestseller-item__revenue">₱{item.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    <div className="bestseller-item__bar">
                      <div
                        className="bestseller-item__bar-fill"
                        style={{ width: `${(item.quantity / stats.bestSellers[0].quantity) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="dashboard__panel animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="dashboard__panel-header">
            <h3><AlertTriangle size={18} /> Low Stock Alert</h3>
          </div>
          <div className="dashboard__panel-body">
            {stats.lowStockItems.length === 0 ? (
              <div className="dashboard__empty dashboard__empty--success">
                <p>All items are well stocked! ✓</p>
              </div>
            ) : (
              <div className="lowstock-list">
                {stats.lowStockItems.map(item => (
                  <div key={item.id} className="lowstock-item">
                    <div className="lowstock-item__info">
                      <span className="lowstock-item__name">{item.name}</span>
                    </div>
                    <span className={`lowstock-item__stock ${item.stock === 0 ? 'lowstock-item__stock--out' : 'lowstock-item__stock--low'}`}>
                      {item.stock === 0 ? 'Out of Stock' : `${item.stock} left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
