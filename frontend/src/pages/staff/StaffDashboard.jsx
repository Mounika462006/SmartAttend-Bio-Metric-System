import { useState, useEffect } from 'react';
import { generalAPI } from '../../api/services';
import {
  Users, CalendarCheck, FileText, AlertTriangle, TrendingDown
} from 'lucide-react';

export default function StaffDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generalAPI.getStaffDashboard()
      .then(({ data }) => setStats(data.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const attendancePct = stats?.total_students > 0
    ? Math.round((stats.today_present / stats.total_students) * 100)
    : 0;

  return (
    <div className="space-y-6 fade-in">
      <div className="page-header">
        <h1 className="page-title">Faculty Dashboard</h1>
        <p className="page-subtitle">Department attendance overview and insights</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <Users size={20} />
          </div>
          <div className="text-2xl font-bold text-surface-900">{stats?.total_students ?? 0}</div>
          <div className="text-sm text-surface-500">Department Students</div>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center mb-3">
            <CalendarCheck size={20} />
          </div>
          <div className="text-2xl font-bold text-green-600">{stats?.today_present ?? 0}</div>
          <div className="text-sm text-surface-500">Present Today</div>
          <div className="text-xs text-surface-400 mt-1">{attendancePct}% attendance</div>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-3">
            <AlertTriangle size={20} />
          </div>
          <div className="text-2xl font-bold text-red-500">{stats?.today_absent ?? 0}</div>
          <div className="text-sm text-surface-500">Absent Today</div>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
            <FileText size={20} />
          </div>
          <div className="text-2xl font-bold text-surface-900">{stats?.pending_leaves ?? 0}</div>
          <div className="text-sm text-surface-500">Pending Leaves</div>
        </div>
      </div>

      {/* Low Attendance Alert */}
      {stats?.low_attendance_students?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <TrendingDown size={18} className="text-red-500" />
              <span className="card-title text-red-600">Low Attendance Alert</span>
            </div>
            <span className="text-xs text-surface-400">Students below 75%</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>ID</th>
                  <th>Attendance %</th>
                  <th>Alert Level</th>
                </tr>
              </thead>
              <tbody>
                {stats.low_attendance_students.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.name}</td>
                    <td className="font-mono text-sm">{s.student_id}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-surface-200 rounded-full h-1.5 max-w-20">
                          <div
                            className="h-1.5 rounded-full bg-red-500"
                            style={{ width: `${s.percentage || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-red-600">{s.percentage ?? 0}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${(s.percentage || 0) < 50 ? 'badge-danger' : 'badge-warning'}`}>
                        {(s.percentage || 0) < 50 ? 'Critical' : 'Warning'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
