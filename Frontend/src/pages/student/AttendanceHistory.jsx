import { useState, useEffect } from 'react';
import { attendanceAPI } from '../../api/services';
import { CalendarCheck, CheckCircle, XCircle, FileText, TrendingUp, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getDay } from 'date-fns';

const STATUS_MAP = {
  present: { label: 'Present', cls: 'badge-success' },
  halfday: { label: 'Half Day', cls: 'badge-info' },
  absent: { label: 'Absent', cls: 'badge-danger' },
  leave: { label: 'Leave', cls: 'badge-warning' },
  holiday: { label: 'Holiday', cls: 'badge-neutral' },
};

function CalendarView({ records, currentDate }) {
  const start = startOfMonth(currentDate);
  const end = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start, end });
  const startDay = getDay(start); // 0=Sun

  // Build date → best status map (present wins over halfday, etc.)
  const STATUS_WEIGHT = { present: 3, halfday: 2, leave: 1, holiday: 0, absent: -1 };
  const recordMap = {};
  records.forEach(r => {
    const key = r.attendance_date?.split('T')[0] || r.attendance_date;
    const cur = recordMap[key];
    if (!cur || (STATUS_WEIGHT[r.status] ?? -1) > (STATUS_WEIGHT[cur] ?? -1)) {
      recordMap[key] = r.status;
    }
  });

  return (
    <div className="card card-body">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-surface-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array(startDay).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const status = recordMap[dateStr];
          const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
          const colorMap = {
            present: 'bg-green-100 text-green-700',
            halfday: 'bg-cyan-100 text-cyan-700',
            absent: 'bg-red-100 text-red-700',
            leave: 'bg-amber-100 text-amber-700',
            holiday: 'bg-surface-200 text-surface-500',
          };
          return (
            <div key={dateStr}
              className={`rounded-lg p-1.5 text-center text-xs transition-colors
                ${status ? colorMap[status] : 'bg-surface-50 text-surface-500'}
                ${isToday ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
              {format(day, 'd')}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-4 text-xs">
        {Object.entries({ present: 'bg-green-200', halfday: 'bg-cyan-200', absent: 'bg-red-200', leave: 'bg-amber-200', holiday: 'bg-surface-200' }).map(([k, c]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${c}`} />
            <span className="text-surface-500 capitalize">{k === 'halfday' ? 'Half Day' : k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AttendanceHistory() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('calendar'); // calendar | table

  useEffect(() => {
    setLoading(true);
    Promise.all([
      attendanceAPI.getHistory({ month, year }),
      attendanceAPI.getStats(),
    ]).then(([h, s]) => {
      setRecords(h.data.data || []);
      setStats(s.data.data);
    }).finally(() => setLoading(false));
  }, [month, year]);

  const currentDate = new Date(year, month - 1, 1);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Group by date → pick the effective status for that day (present > halfday > leave > absent)
  const STATUS_WEIGHT = { present: 3, halfday: 2, leave: 1, holiday: 0, absent: -1 };
  const dailyMap = {};
  records.forEach(r => {
    const key = r.attendance_date?.split('T')[0] || r.attendance_date;
    const existing = dailyMap[key];
    if (!existing || (STATUS_WEIGHT[r.status] ?? -1) > (STATUS_WEIGHT[existing.status] ?? -1)) {
      dailyMap[key] = r;
    }
  });
  const dailyRecords = Object.values(dailyMap);

  const presentCount = dailyRecords.reduce((s, r) => s + (r.status === 'present' ? 1 : r.status === 'halfday' ? 0.5 : 0), 0);
  const absentCount  = dailyRecords.reduce((s, r) => s + (r.status === 'absent'  ? 1 : r.status === 'halfday' ? 0.5 : 0), 0);

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Attendance History</h1>
          <p className="page-subtitle">Monthly attendance records and calendar view</p>
        </div>
        <button className="btn-secondary text-sm">
          <Download size={15} /> Export
        </button>
      </div>

      {/* Month Selector */}
      <div className="card card-body flex items-center justify-between">
        <button onClick={prevMonth} className="btn-secondary py-1.5 px-3">&#8249;</button>
        <h3 className="font-semibold text-surface-800">
          {format(currentDate, 'MMMM yyyy')}
        </h3>
        <button onClick={nextMonth} className="btn-secondary py-1.5 px-3">&#8250;</button>
      </div>

      {/* Quick stats for this month */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-green-600">{presentCount}</div>
          <div className="text-xs text-surface-500 mt-1">Present</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-red-500">{absentCount}</div>
          <div className="text-xs text-surface-500 mt-1">Absent</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-blue-600">{stats?.attendance_percentage ?? 0}%</div>
          <div className="text-xs text-surface-500 mt-1">Overall %</div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-1 p-1 bg-surface-100 rounded-lg w-fit">
        {['calendar', 'table'].map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
              view === v ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
            }`}>
            {v}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton h-64 rounded-lg" />
      ) : view === 'calendar' ? (
        <CalendarView records={records} currentDate={currentDate} />
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Session</th>
                <th>Status</th>
                <th>Verified At</th>
                <th>Match Score</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-surface-400 py-8">
                    No attendance records for this month.
                  </td>
                </tr>
              ) : records.map((r, i) => {
                const date = new Date(r.attendance_date);
                return (
                  <tr key={i}>
                    <td className="font-medium">{format(date, 'dd MMM yyyy')}</td>
                    <td className="text-surface-500">{format(date, 'EEEE')}</td>
                    <td className="text-surface-500">{r.session || 'Morning'}</td>
                    <td>
                      <span className={`badge ${STATUS_MAP[r.status]?.cls || 'badge-neutral'}`}>
                        {STATUS_MAP[r.status]?.label || r.status}
                      </span>
                    </td>
                    <td className="text-surface-500 text-xs">
                      {r.marked_at ? format(new Date(r.marked_at), 'hh:mm a') : '—'}
                    </td>
                    <td className="text-surface-600">
                      {r.face_match_score ? `${r.face_match_score}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
