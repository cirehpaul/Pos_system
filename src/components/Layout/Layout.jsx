import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, 
  ClipboardList, BarChart3, Archive, Settings, LogOut,
  Menu, Users, ChevronLeft, Clock, ArrowLeftRight
} from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import './Layout.css';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard & Accounting', roles: ['owner', 'cashier'] },
  { path: '/pos', icon: ShoppingCart, label: 'POS / Bar Billing', roles: ['owner', 'cashier'] },
  { path: '/transactions', icon: ArrowLeftRight, label: 'Money Transactions', roles: ['owner', 'cashier'] },
  { path: '/sales', icon: ClipboardList, label: 'Sales History', roles: ['owner', 'cashier'] },
  { path: '/inventory', icon: Archive, label: 'Inventory', roles: ['owner'] },
  { path: '/reports', icon: BarChart3, label: 'Reports', roles: ['owner'] },
  { path: '/users', icon: Users, label: 'User Management', roles: ['owner'] },
  { path: '/login-history', icon: Clock, label: 'Login History', roles: ['owner'] },
  { path: '/settings', icon: Settings, label: 'Settings', roles: ['owner'] },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { currentUser, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const isPOS = location.pathname === '/pos';

  const displayName = currentUser?.displayName || currentUser?.name || 'User';
  const roleLabel = currentUser?.role === 'owner' ? 'Owner / Admin' : 'Cashier';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // In POS mode, hide sidebar by default for maximum screen space
  if (isPOS) {
    return (
      <div className="layout layout--pos">
        <div className="pos-header">
          <div className="pos-header-left">
            <NavLink
              to="/dashboard"
              className="pos-back-btn"
              title="Go to Dashboard & Accounting"
            >
              <ChevronLeft size={20} />
              <span>Dashboard</span>
            </NavLink>
            <div className="pos-nav-shortcuts">
              <NavLink to="/dashboard" className="pos-nav-shortcut" title="View Live Accounting Dashboard">
                <LayoutDashboard size={15} />
                <span>Accounting</span>
              </NavLink>
              <NavLink to="/transactions" className="pos-nav-shortcut" title="Cater Client Money Transactions">
                <ArrowLeftRight size={15} />
                <span>Transactions</span>
              </NavLink>
              <NavLink to="/sales" className="pos-nav-shortcut" title="View Sales History">
                <ClipboardList size={15} />
                <span>Sales</span>
              </NavLink>
            </div>
          </div>
          <div className="pos-header-info">
            <span className="pos-cashier">{displayName} — {roleLabel}</span>
            <button className="pos-logout-btn" onClick={handleLogout} title="Logout">
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
        <main className="layout__content layout__content--pos">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className={`layout ${sidebarOpen ? 'layout--sidebar-open' : 'layout--sidebar-closed'}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : 'sidebar--closed'}`}>
        <div className="sidebar__header">
          {sidebarOpen && (
            <div className="sidebar__brand">
              <div className="sidebar__logo">
                <img
                  src="/LUCID.png"
                  alt="Lucid Logo"
                  className="sidebar__logo-img"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const icon = document.getElementById('sidebar-logo-fallback');
                    if (icon) icon.style.display = 'flex';
                  }}
                />
                <span id="sidebar-logo-fallback" style={{ display: 'none' }}>
                  <ShoppingCart size={22} />
                </span>
              </div>
              <span className="sidebar__title">Lucid</span>
            </div>
          )}
          <button
            className="sidebar__toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="sidebar__nav">
          {navItems
            .filter(item => item.roles.includes(currentUser?.role))
            .map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                }
                title={item.label}
              >
                <item.icon size={20} className="sidebar__link-icon" />
                {sidebarOpen && <span className="sidebar__link-label">{item.label}</span>}
              </NavLink>
            ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar">
              {displayName.charAt(0).toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="sidebar__user-info">
                <span className="sidebar__user-name">{displayName}</span>
                <span className="sidebar__user-role">{roleLabel}</span>
              </div>
            )}
          </div>
          <button className="sidebar__logout" onClick={handleLogout} title="Logout">
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="layout__content">
        {children}
      </main>
    </div>
  );
}
