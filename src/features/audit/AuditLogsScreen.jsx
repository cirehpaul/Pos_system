import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Filter, Search, ChevronLeft, ChevronRight,
  AlertTriangle, Info, AlertCircle, Shield, Trash2, Download
} from 'lucide-react';
import { format } from 'date-fns';
import { getAuditLogs, clearAuditLogs } from '../../utils/auditLogger';
import useAuthStore from '../../stores/authStore';
import { useToast } from '../../components/Toast/Toast';
import './AuditLogsScreen.css';

const CATEGORY_LABELS = {
  all: 'All Categories',
  auth: 'Authentication',
  user_mgmt: 'User Management',
  financial: 'Financial',
  reservation: 'Reservations',
  system: 'System',
};

const SEVERITY_COLORS = {
  info: { bg: 'var(--color-info-bg, #e0f2fe)', color: 'var(--color-info-dark, #0369a1)', icon: Info },
  warning: { bg: 'var(--color-warning-bg, #fef3c7)', color: 'var(--color-warning-dark, #92400e)', icon: AlertTriangle },
  critical: { bg: 'var(--color-danger-bg, #fee2e2)', color: 'var(--color-danger-dark, #991b1b)', icon: AlertCircle },
};

const CATEGORY_ICONS = {
  auth: '🔐',
  user_mgmt: '👤',
  financial: '💰',
  reservation: '📋',
  system: '⚙️',
};

const ACTION_LABELS = {
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  LOGIN_FAILED: 'Login Failed',
  USER_CREATED: 'User Created',
  USER_UPDATED: 'User Updated',
  USER_DELETED: 'User Deleted',
  USER_DISABLED: 'User Disabled',
  USER_ENABLED: 'User Enabled',
  TRANSACTION_CREATED: 'Transaction Created',
  TRANSACTION_VOIDED: 'Transaction Voided',
  CASH_AUDIT_SAVED: 'Cash Audit Saved',
  CASH_AUDIT_DELETED: 'Cash Audit Deleted',
  FINANCIAL_RESET: 'Financial Reset',
  RESERVATION_CREATED: 'Reservation Created',
  RESERVATION_UPDATED: 'Reservation Updated',
  RESERVATION_CANCELLED: 'Reservation Cancelled',
  SETTING_CHANGED: 'Setting Changed',
  DATABASE_INITIALIZED: 'Database Init',
};

export default function AuditLogsScreen() {
  const toast = useToast();
  const { currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'owner';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: 'all',
    severity: 'all',
    search: '',
    dateFrom: '',
    dateTo: '',
  });
  const [page, setPage] = useState(1);
  const perPage = 20;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const data = await getAuditLogs(filters);
    setLogs(data);
    setPage(1);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleClearLogs = async () => {
    if (!isSuperAdmin) return;
    if (!window.confirm('⚠️ Are you sure you want to clear ALL audit logs? This action cannot be undone.')) return;
    if (!window.confirm('This is a destructive action. Type YES to confirm.')) return;
    await clearAuditLogs();
    toast.success('Audit logs cleared');
    await loadLogs();
  };

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Action', 'Category', 'Severity', 'User', 'Role', 'Description'].join(','),
      ...logs.map(l => [
        l.createdAt,
        l.action,
        l.category,
        l.severity,
        `"${(l.userName || '').replace(/"/g, '""')}"`,
        l.userRole || '',
        `"${(l.description || '').replace(/"/g, '""')}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Audit logs exported');
  };

  const totalPages = Math.ceil(logs.length / perPage);
  const paginatedLogs = logs.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="audit-logs-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1><FileText size={24} /> Audit Logs</h1>
          <p>Track all system activity and changes — {logs.length} total entries</p>
        </div>
        <div className="audit-header-actions">
          <button className="btn btn--ghost" onClick={handleExport} disabled={logs.length === 0}>
            <Download size={16} /> Export CSV
          </button>
          {isSuperAdmin && (
            <button className="btn btn--danger" onClick={handleClearLogs}>
              <Trash2 size={16} /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="audit-filters">
        <div className="audit-search">
          <Search size={16} className="audit-search__icon" />
          <input
            type="text"
            placeholder="Search logs…"
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>

        <div className="filter-select">
          <Filter size={16} className="filter-select__icon" />
          <select value={filters.category} onChange={e => setFilters(prev => ({ ...prev, category: e.target.value }))}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div className="filter-select">
          <Shield size={16} className="filter-select__icon" />
          <select value={filters.severity} onChange={e => setFilters(prev => ({ ...prev, severity: e.target.value }))}>
            <option value="all">All Severity</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className="date-custom">
          <input type="date" className="date-input" value={filters.dateFrom}
            onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))} />
          <span className="date-separator">to</span>
          <input type="date" className="date-input" value={filters.dateTo}
            onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))} />
        </div>
      </div>

      {/* ── Log Entries ── */}
      {loading ? (
        <div className="empty-state"><p>Loading audit logs…</p></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <h3>No audit logs yet</h3>
          <p>System activity will be recorded here automatically.</p>
        </div>
      ) : (
        <>
          <div className="audit-timeline">
            {paginatedLogs.map(log => {
              const sev = SEVERITY_COLORS[log.severity] || SEVERITY_COLORS.info;
              const SevIcon = sev.icon;
              const catIcon = CATEGORY_ICONS[log.category] || '📌';

              let parsedMeta = {};
              try { parsedMeta = JSON.parse(log.metadata || '{}'); } catch { /* noop */ }

              return (
                <div key={log.id} className="audit-entry">
                  <div className="audit-entry__timeline">
                    <div className="audit-entry__dot" style={{ background: sev.color }} />
                    <div className="audit-entry__line" />
                  </div>
                  <div className="audit-entry__card">
                    <div className="audit-entry__header">
                      <div className="audit-entry__action">
                        <span className="audit-entry__cat-icon">{catIcon}</span>
                        <span className="audit-entry__action-label">
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                        <span className="audit-entry__severity" style={{ background: sev.bg, color: sev.color }}>
                          <SevIcon size={12} />
                          {log.severity}
                        </span>
                      </div>
                      <span className="audit-entry__time">
                        {format(new Date(log.createdAt), 'MMM dd, yyyy · hh:mm a')}
                      </span>
                    </div>
                    <p className="audit-entry__desc">{log.description}</p>
                    <div className="audit-entry__footer">
                      {log.userName && (
                        <span className="audit-entry__user">
                          <span className="audit-entry__user-avatar">
                            {log.userName.charAt(0).toUpperCase()}
                          </span>
                          {log.userName}
                          {log.userRole && (
                            <span className={`role-badge role-badge--${log.userRole}`}>
                              {log.userRole === 'super_admin' || log.userRole === 'owner' ? 'Super Admin' : (log.userRole === 'admin' ? 'Admin' : 'Cashier')}
                            </span>
                          )}
                        </span>
                      )}
                      {parsedMeta.referenceNumber && (
                        <span className="audit-entry__meta">
                          Ref: {parsedMeta.referenceNumber}
                        </span>
                      )}
                      {parsedMeta.amount !== undefined && (
                        <span className="audit-entry__meta">
                          Amount: ₱{parseFloat(parsedMeta.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <span className="pagination__info">
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, logs.length)} of {logs.length}
              </span>
              <div className="pagination__controls">
                <button className="pagination__btn" disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft size={16} /> Prev
                </button>
                <span className="pagination__page">Page {page} of {totalPages}</span>
                <button className="pagination__btn" disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}>
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
