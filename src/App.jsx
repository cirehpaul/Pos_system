import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import LoginScreen from './features/auth/LoginScreen';
import DashboardScreen from './features/dashboard/DashboardScreen';
import CategoriesScreen from './features/categories/CategoriesScreen';
import POSScreen from './features/pos/POSScreen';
import useAuthStore from './stores/authStore';

import ProductsScreen from './features/products/ProductsScreen';
import SalesScreen from './features/sales/SalesScreen';
import InventoryScreen from './features/inventory/InventoryScreen';
import ReportsScreen from './features/reports/ReportsScreen';
import SettingsScreen from './features/settings/SettingsScreen';
import TransactionsScreen from './features/transactions/TransactionsScreen';
import GuestPassScreen from './features/guest/GuestPassScreen';
import AuditLogsScreen from './features/audit/AuditLogsScreen';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, currentUser } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(currentUser?.role)) {
    return <Navigate to="/pos" replace />; // Default fallback for unauthorized
  }
  
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Guest Pass (accessible without login — guests scan QR code) */}
        <Route path="/guest-pass" element={<GuestPassScreen />} />

        <Route path="/login" element={<LoginScreen />} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['super_admin', 'owner', 'admin', 'cashier']}>
            <DashboardScreen />
          </ProtectedRoute>
        } />
        
        <Route path="/pos" element={
          <ProtectedRoute allowedRoles={['super_admin', 'owner', 'admin', 'cashier']}>
            <POSScreen />
          </ProtectedRoute>
        } />
        
        <Route path="/categories" element={
          <ProtectedRoute allowedRoles={['super_admin', 'owner', 'admin']}>
            <CategoriesScreen />
          </ProtectedRoute>
        } />
        
        <Route path="/products" element={
          <ProtectedRoute allowedRoles={['super_admin', 'owner', 'admin']}>
            <ProductsScreen />
          </ProtectedRoute>
        } />
        
        <Route path="/sales" element={
          <ProtectedRoute allowedRoles={['super_admin', 'owner', 'admin', 'cashier']}>
            <SalesScreen />
          </ProtectedRoute>
        } />
        
        <Route path="/transactions" element={
          <ProtectedRoute allowedRoles={['super_admin', 'owner', 'admin', 'cashier']}>
            <TransactionsScreen />
          </ProtectedRoute>
        } />
        
        <Route path="/inventory" element={
          <ProtectedRoute allowedRoles={['super_admin', 'owner', 'admin']}>
            <InventoryScreen />
          </ProtectedRoute>
        } />
        
        <Route path="/reports" element={
          <ProtectedRoute allowedRoles={['super_admin', 'owner', 'admin']}>
            <ReportsScreen />
          </ProtectedRoute>
        } />
        
        <Route path="/users" element={
          <ProtectedRoute allowedRoles={['super_admin', 'owner', 'admin']}>
            <SettingsScreen defaultTab="accounts" />
          </ProtectedRoute>
        } />
        
        <Route path="/login-history" element={
          <ProtectedRoute allowedRoles={['super_admin', 'owner', 'admin']}>
            <SettingsScreen defaultTab="loginHistory" />
          </ProtectedRoute>
        } />
        
        <Route path="/settings" element={
          <ProtectedRoute allowedRoles={['super_admin', 'owner', 'admin']}>
            <SettingsScreen defaultTab="store" />
          </ProtectedRoute>
        } />

        <Route path="/audit-logs" element={
          <ProtectedRoute allowedRoles={['super_admin', 'owner', 'admin']}>
            <AuditLogsScreen />
          </ProtectedRoute>
        } />

        {/* Default Route */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
