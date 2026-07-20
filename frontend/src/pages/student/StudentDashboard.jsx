import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { attendanceAPI, generalAPI } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import {
  CalendarCheck, Users, CalendarDays, Clock, TrendingUp,
  FileText, Bell, ShieldCheck, BarChart2, AlertTriangle
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#2451c8', '#ef4444', '#f59e0b', '#10b981'];

function StatCard({ icon: Icon, label, value, sub, color = 'blue', trend }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className="stat-card fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-surface-900">{value}</div>
      <div className="text-sm text-surface-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-surface-400 mt-1">{sub}</div>}
    </div>
  );
}

function AttendanceRing({ percentage }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 75 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} stroke="#e2e8f0" strokeWidth="10" fill="none" />
        <circle
          cx="70" cy="70" r={radius}
          stroke={color} strokeWidth="10" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a">{percentage}%</text>
        <text x="70" y="86" textAnchor="middle" fontSize="11" fill="#64748b">Attendance</text>
      </svg>
      <span className={`text-sm font-medium mt-1 ${percentage >= 75 ? 'text-green-600' : 'text-red-600'}`}>
        {percentage >= 75 ? 'Good Standing' : 'Below Required 75%'}
      </span>
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    Promise.all([
      attendanceAPI.getStats().catch(err => {
        console.error('[Dashboard Error] Failed to fetch stats:', err);
        return { data: { data: null } };
      }),
      attendanceAPI.getHistory({ month: now.getMonth() + 1, year: now.getFullYear() }).catch(err => {
        console.error('[Dashboard Error] Failed to fetch history:', err);
        return { data: { data: [] } };
      }),
      generalAPI.getNotifications().catch(err => {
        console.error('[Dashboard Error] Failed to fetch notifications:', err);
        return { data: { data: { notifications: [] } } };
      }),
    ]).then(([s, h, n]) => {
      setStats(s.data.data);
      setHistory(h.data.data || []);
      setNotifications((n.data.data?.notifications || []).slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  // Group history by date → best status per day (prevent multi-session inflation)
  const STATUS_WEIGHT_DASH = { present: 3, halfday: 2, leave: 1, holiday: 0, absent: -1 };
  const historyDailyMap = {};
  history.forEach(r => {
    const key = r.attendance_date?.split('T')[0] || r.attendance_date;
    const cur = historyDailyMap[key];
    if (!cur || (STATUS_WEIGHT_DASH[r.status] ?? -1) > (STATUS_WEIGHT_DASH[cur?.status] ?? -1)) {
      historyDailyMap[key] = r;
    }
  });

  // Build chart data from last 7 days
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });
    const record = historyDailyMap[dateStr];
    return {
      day: dayName,
      present: record?.status === 'present' ? 1 : record?.status === 'halfday' ? 0.5 : 0,
      leave:   record?.status === 'leave'   ? 1 : 0,
      absent:  !record ? 1 : record.status === 'absent' ? 1 : record.status === 'halfday' ? 0.5 : 0,
    };
  });

  const pieData = stats ? [
    { name: 'Present', value: stats.present },
    { name: 'Absent', value: stats.absent },
    { name: 'Leave', value: stats.leave_days },
    { name: 'Holidays', value: stats.holidays },
  ].filter(d => d.value > 0) : [];

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

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Welcome back, {user?.name}. Here's your attendance overview.
        </p>
      </div>

      {/* Biometric Warning */}
      {!user?.biometric_registered && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Biometric Registration Required</p>
            <p className="text-xs text-amber-600 mt-0.5">You must complete face registration to mark attendance.</p>
          </div>
          <Link to="/student/biometric" className="btn-primary text-xs py-1.5">
            Register Now
          </Link>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CalendarCheck} label="Present Days" value={stats?.present ?? '–'} color="green" />
        <StatCard icon={Users} label="Absent Days" value={stats?.absent ?? '–'} color="red" />
        <StatCard icon={FileText} label="Leave Days" value={stats?.leave_days ?? '–'} color="amber" />
        <StatCard icon={CalendarDays} label="Working Days" value={stats?.total_working_days ?? '–'} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Ring */}
        <div className="card flex flex-col items-center py-6">
          <div className="card-header border-b-0 pb-2 w-full">
            <span className="card-title">Attendance %</span>
          </div>
          <AttendanceRing percentage={stats?.attendance_percentage ?? 0} />
          <div className="mt-4 grid grid-cols-2 gap-3 w-full px-6 text-center text-sm">
            <div>
              <div className="font-semibold text-surface-900">{stats?.present ?? 0}</div>
              <div className="text-xs text-surface-500">Present</div>
            </div>
            <div>
              <div className="font-semibold text-surface-900">{stats?.total_working_days ?? 0}</div>
              <div className="text-xs text-surface-500">Total Days</div>
            </div>
          </div>
        </div>

        {/* Weekly chart */}
        <div className="card lg:col-span-2">
          <div className="card-header">
            <span className="card-title">Weekly Attendance</span>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis hide />
                <Tooltip />
                <Area type="monotone" dataKey="present" stroke="#10b981" fill="#d1fae5" name="Present" />
                <Area type="monotone" dataKey="absent" stroke="#ef4444" fill="#fee2e2" name="Absent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution Pie */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Attendance Distribution</span>
          </div>
          <div className="p-4 flex justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Notifications</span>
          </div>
          <div className="divide-y divide-surface-100">
            {notifications.length === 0 ? (
              <div className="empty-state">
                <Bell className="empty-state-icon" />
                <p className="empty-state-title">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`px-4 py-3 ${!n.is_read ? 'bg-blue-50/40' : ''}`}>
                  <div className="flex items-start gap-2">
                    {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-surface-800">{n.title}</p>
                      <p className="text-xs text-surface-500 mt-0.5">{n.message}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
