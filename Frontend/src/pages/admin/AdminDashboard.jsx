import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/services';
import {
  Users, CalendarCheck, FileText, TrendingUp, BarChart3,
  AlertTriangle, Building2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="stat-card">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colorMap[color]}`}>
        <Icon size={20} />
      </div>
      <div className="text-2xl font-bold text-surface-900">{value}</div>
      <div className="text-sm text-surface-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-surface-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getDashboard()
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

  const deptChartData = (stats?.department_stats || []).map(d => ({
    name: d.department.split(' ').map(w => w[0]).join('').slice(0, 4),
    students: d.total_students,
    present: d.present_today || 0,
    fullName: d.department,
  }));

  return (
    <div className="space-y-6 fade-in">
      <div className="page-header">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">System overview and real-time analytics</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Students" value={stats?.students?.total ?? 0}
          sub={`${stats?.students?.approved ?? 0} approved`} color="blue" />
        <StatCard icon={AlertTriangle} label="Pending Approvals" value={stats?.students?.pending ?? 0}
          sub="Awaiting review" color="amber" />
        <StatCard icon={CalendarCheck} label="Today's Attendance" value={stats?.today_attendance ?? 0}
          sub="Students present" color="green" />
        <StatCard icon={FileText} label="Pending Leaves" value={stats?.pending_leaves ?? 0}
          sub="Awaiting approval" color="red" />
      </div>

      {/* Department chart */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Department-wise Today's Attendance</span>
          <span className="text-xs text-surface-400">{new Date().toLocaleDateString('en-IN')}</span>
        </div>
        <div className="p-6">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={deptChartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip
                formatter={(val, name) => [val, name === 'students' ? 'Total' : 'Present Today']}
                labelFormatter={(label) => deptChartData.find(d => d.name === label)?.fullName || label}
              />
              <Bar dataKey="students" fill="#dce8ff" radius={[4,4,0,0]} name="Total" />
              <Bar dataKey="present" fill="#2451c8" radius={[4,4,0,0]} name="Present" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <span className="card-title">Department Summary</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Total Students</th>
              <th>Present Today</th>
              <th>Absent Today</th>
              <th>Attendance %</th>
            </tr>
          </thead>
          <tbody>
            {(stats?.department_stats || []).map((d, i) => {
              const pct = d.total_students > 0 ? Math.round((d.present_today / d.total_students) * 100) : 0;
              return (
                <tr key={i}>
                  <td className="font-medium">{d.department}</td>
                  <td>{d.total_students}</td>
                  <td className="text-green-600 font-medium">{d.present_today || 0}</td>
                  <td className="text-red-500">{d.total_students - (d.present_today || 0)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-surface-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${pct >= 75 ? 'bg-green-500' : 'bg-red-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
