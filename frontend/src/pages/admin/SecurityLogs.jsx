import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/services';
import {
  Shield, Search, Filter, AlertTriangle,
  CheckCircle, XCircle, LogIn, LogOut
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const ACTION_CONFIG = {
  LOGIN_SUCCESS: { icon: LogIn, color: 'text-green-600', bg: 'bg-green-50', label: 'Login' },
  LOGIN_FAILED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Failed Login' },
  LOGOUT: { icon: LogOut, color: 'text-surface-500', bg: 'bg-surface-50', label: 'Logout' },
  ATTENDANCE_MARKED: { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Attendance' },
  FACE_REJECTED: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Face Rejected' },
  LOCATION_REJECTED: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Location Blocked' },
};

const ROLE_BADGE = {
  student: 'badge-primary',
  staff: 'badge-neutral',
  admin: 'badge-warning',
};

export default function SecurityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ role: '', status: '' });
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    adminAPI.getSecurityLogs({ page, limit: 50 })
      .then(({ data }) => setLogs(data.data || []))
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = logs.filter(l => {
    if (filter.role && l.user_role !== filter.role) return false;
    if (filter.status && l.status !== filter.status) return false;
    return true;
  });

  const failedCount = logs.filter(l => l.status === 'failure').length;
  const blockedCount = logs.filter(l => l.status === 'blocked').length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Security Logs</h1>
        <p className="page-subtitle">Authentication and access audit trail</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Shield size={16} className="text-blue-600" />
            </div>
            <span className="text-sm text-surface-500">Total Events</span>
          </div>
          <div className="text-2xl font-bold text-surface-900">{logs.length}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <XCircle size={16} className="text-red-600" />
            </div>
            <span className="text-sm text-surface-500">Failed Logins</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{failedCount}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <span className="text-sm text-surface-500">Blocked</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">{blockedCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          className="form-input w-auto"
          value={filter.role}
          onChange={e => setFilter(p => ({ ...p, role: e.target.value }))}
        >
          <option value="">All Roles</option>
          <option value="student">Student</option>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
        <select
          className="form-input w-auto"
          value={filter.status}
          onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}
        >
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="blocked">Blocked</option>
        </select>
        <span className="text-sm text-surface-400 self-center">
          Showing {filtered.length} events
        </span>
      </div>

      {/* Logs Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 animate-pulse space-y-2">
            {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-12 rounded" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Shield className="empty-state-icon" />
            <p className="empty-state-title">No security events</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>IP Address</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => {
                  const config = ACTION_CONFIG[log.action] || {
                    icon: Shield, color: 'text-surface-500', bg: 'bg-surface-50', label: log.action
                  };
                  const IconComp = config.icon;

                  return (
                    <tr key={log.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${config.bg}`}>
                            <IconComp size={13} className={config.color} />
                          </div>
                          <span className="text-sm font-medium text-surface-800">{config.label}</span>
                        </div>
                      </td>
                      <td>
                        <div className="text-sm text-surface-800">{log.user_name || 'Unknown'}</div>
                        <div className="text-xs text-surface-400">ID: {log.user_id}</div>
                      </td>
                      <td>
                        <span className={`badge ${ROLE_BADGE[log.user_role] || 'badge-neutral'}`}>
                          {log.user_role}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-surface-500">{log.ip_address}</td>
                      <td>
                        <span className={`badge ${
                          log.status === 'success' ? 'badge-success' :
                          log.status === 'failure' ? 'badge-danger' : 'badge-warning'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="text-xs text-surface-400" title={log.created_at}>
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="btn-secondary py-1.5 px-4 text-sm disabled:opacity-50"
        >
          Previous
        </button>
        <span className="flex items-center text-sm text-surface-500 px-3">Page {page}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={logs.length < 50}
          className="btn-secondary py-1.5 px-4 text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
