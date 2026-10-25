import db from '../db/database';

/**
 * Action categories for audit logs
 */
export const AUDIT_ACTIONS = {
  // Auth
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',

  // User management
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_DISABLED: 'USER_DISABLED',
  USER_ENABLED: 'USER_ENABLED',

  // Financial
  TRANSACTION_CREATED: 'TRANSACTION_CREATED',
  TRANSACTION_VOIDED: 'TRANSACTION_VOIDED',
  CASH_AUDIT_SAVED: 'CASH_AUDIT_SAVED',
  CASH_AUDIT_DELETED: 'CASH_AUDIT_DELETED',
  FINANCIAL_RESET: 'FINANCIAL_RESET',

  // Reservations
  RESERVATION_CREATED: 'RESERVATION_CREATED',
  RESERVATION_UPDATED: 'RESERVATION_UPDATED',
  RESERVATION_CANCELLED: 'RESERVATION_CANCELLED',

  // Settings
  SETTING_CHANGED: 'SETTING_CHANGED',

  // System
  DATABASE_INITIALIZED: 'DATABASE_INITIALIZED',
};

/**
 * Category mapping for action grouping / filtering
 */
const ACTION_CATEGORY = {
  LOGIN: 'auth',
  LOGOUT: 'auth',
  LOGIN_FAILED: 'auth',
  USER_CREATED: 'user_mgmt',
  USER_UPDATED: 'user_mgmt',
  USER_DELETED: 'user_mgmt',
  USER_DISABLED: 'user_mgmt',
  USER_ENABLED: 'user_mgmt',
  TRANSACTION_CREATED: 'financial',
  TRANSACTION_VOIDED: 'financial',
  CASH_AUDIT_SAVED: 'financial',
  CASH_AUDIT_DELETED: 'financial',
  FINANCIAL_RESET: 'financial',
  RESERVATION_CREATED: 'reservation',
  RESERVATION_UPDATED: 'reservation',
  RESERVATION_CANCELLED: 'reservation',
  SETTING_CHANGED: 'system',
  DATABASE_INITIALIZED: 'system',
};

/**
 * Severity mapping
 */
const ACTION_SEVERITY = {
  LOGIN: 'info',
  LOGOUT: 'info',
  LOGIN_FAILED: 'warning',
  USER_CREATED: 'info',
  USER_UPDATED: 'info',
  USER_DELETED: 'warning',
  USER_DISABLED: 'warning',
  USER_ENABLED: 'info',
  TRANSACTION_CREATED: 'info',
  TRANSACTION_VOIDED: 'warning',
  CASH_AUDIT_SAVED: 'info',
  CASH_AUDIT_DELETED: 'warning',
  FINANCIAL_RESET: 'critical',
  RESERVATION_CREATED: 'info',
  RESERVATION_UPDATED: 'info',
  RESERVATION_CANCELLED: 'warning',
  SETTING_CHANGED: 'info',
  DATABASE_INITIALIZED: 'info',
};

/**
 * Record an audit log entry.
 *
 * @param {Object} opts
 * @param {string} opts.action       - One of AUDIT_ACTIONS
 * @param {string} opts.description  - Human-readable description of what happened
 * @param {string} [opts.userId]     - ID of the user who performed the action
 * @param {string} [opts.userName]   - Display name of the user
 * @param {string} [opts.userRole]   - Role of the user (owner/cashier)
 * @param {Object} [opts.metadata]   - Additional structured data (e.g. affected record IDs)
 */
export async function logAudit({
  action,
  description,
  userId = null,
  userName = null,
  userRole = null,
  metadata = {},
}) {
  try {
    await db.auditLogs.add({
      id: crypto.randomUUID(),
      action,
      category: ACTION_CATEGORY[action] || 'system',
      severity: ACTION_SEVERITY[action] || 'info',
      description,
      userId,
      userName,
      userRole,
      metadata: JSON.stringify(metadata),
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Silently fail — audit logging should never break the main flow
    console.warn('[AuditLog] Failed to write audit log:', err);
  }
}

/**
 * Load audit logs with optional filters.
 */
export async function getAuditLogs(filters = {}) {
  try {
    let logs = await db.auditLogs.toArray();

    // Sort newest first
    logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (filters.category && filters.category !== 'all') {
      logs = logs.filter(l => l.category === filters.category);
    }
    if (filters.severity && filters.severity !== 'all') {
      logs = logs.filter(l => l.severity === filters.severity);
    }
    if (filters.userId && filters.userId !== 'all') {
      logs = logs.filter(l => l.userId === filters.userId);
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      logs = logs.filter(l => new Date(l.createdAt) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      logs = logs.filter(l => new Date(l.createdAt) <= to);
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      logs = logs.filter(l =>
        (l.description || '').toLowerCase().includes(s) ||
        (l.userName || '').toLowerCase().includes(s) ||
        (l.action || '').toLowerCase().includes(s)
      );
    }

    return logs;
  } catch (err) {
    console.warn('[AuditLog] Failed to load audit logs:', err);
    return [];
  }
}

/**
 * Clear all audit logs (owner only — for maintenance).
 */
export async function clearAuditLogs() {
  await db.auditLogs.clear();
}
