import { useState, useEffect } from 'react';
import { attendanceAPI, generalAPI } from '../../api/services';
import {
  BarChart3, Download, Filter, TrendingDown, TrendingUp, Users
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import { format, subDays } from 'date-fns';

export default function StaffReports() {
  const [attendance, setAttendance] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    department_id: '',
    year: '',
  });
  const [view, setView] = useState('table'); // table | chart

  useEffect(() => {
    generalAPI.getDepartments().then(({ data }) => setDepartments(data.data || []));
  }, []);

  useEffect(() => { fetchAttendance(); }, [filters]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const { data } = await attendanceAPI.getDepartment(filters);
      setAttendance(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  const presentCount = attendance.reduce((sum, r) => sum + (r.status === 'present' ? 1 : r.status === 'halfday' ? 0.5 : 0), 0);
  const absentCount = attendance.reduce((sum, r) => sum + (r.status !== 'present' ? (r.status === 'halfday' ? 0.5 : 1) : 0), 0);
  const attendancePct = attendance.length > 0
    ? Math.round((presentCount / attendance.length) * 100)
    : 0;

  // Group by year for chart
  const yearGroups = [1, 2, 3, 4].map(year => {
    const yearStudents = attendance.filter(s => s.year === year);
    const present = yearStudents.reduce((sum, r) => sum + (r.status === 'present' ? 1 : r.status === 'halfday' ? 0.5 : 0), 0);
    return {
      year: `Year ${year}`,
      total: yearStudents.length,
      present,
      absent: yearStudents.length - present,
      pct: yearStudents.length > 0 ? Math.round((present / yearStudents.length) * 100) : 0,
    };
  }).filter(y => y.total > 0);

  const exportCSV = () => {
    const headers = ['Name', 'Student ID', 'Year', 'Semester', 'Status', 'Marked At', 'Face Match'];
    const rows = attendance.map(r => [
      r.name, r.student_id, r.year, r.semester, r.status,
      r.marked_at ? format(new Date(r.marked_at), 'hh:mm a') : '',
      r.face_match_score ? `${r.face_match_score}%` : '',
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${filters.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Attendance Reports</h1>
          <p className="page-subtitle">Department attendance analysis and export</p>
        </div>
        <button onClick={exportCSV} disabled={attendance.length === 0} className="btn-secondary">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card card-body flex flex-wrap gap-3">
        <div>
          <label className="form-label text-xs">Date</label>
          <input type="date" className="form-input"
            value={filters.date} onChange={e => setFilters(p => ({ ...p, date: e.target.value }))} />
        </div>
        <div>
          <label className="form-label text-xs">Department</label>
          <select className="form-input"
            value={filters.department_id}
            onChange={e => setFilters(p => ({ ...p, department_id: e.target.value }))}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label text-xs">Year</label>
          <select className="form-input"
            value={filters.year}
            onChange={e => setFilters(p => ({ ...p, year: e.target.value }))}>
            <option value="">All Years</option>
            {[1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card text-center">
          <div className="text-xl font-bold text-surface-900">{attendance.length}</div>
          <div className="text-xs text-surface-500 mt-1">Total Students</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-xl font-bold text-green-600">{presentCount}</div>
          <div className="text-xs text-surface-500 mt-1">Present</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-xl font-bold text-red-500">{absentCount}</div>
          <div className="text-xs text-surface-500 mt-1">Absent / Leave</div>
        </div>
        <div className="stat-card text-center">
          <div className={`text-xl font-bold ${attendancePct >= 75 ? 'text-green-600' : 'text-red-500'}`}>
            {attendancePct}%
          </div>
          <div className="text-xs text-surface-500 mt-1">Attendance Rate</div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-1 p-1 bg-surface-100 rounded-lg w-fit">
        {['table', 'chart'].map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
              view === v ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
            }`}>
            {v === 'chart' ? 'Year-wise Chart' : 'Student Table'}
          </button>
        ))}
      </div>

      {view === 'chart' ? (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Year-wise Attendance Breakdown</span>
          </div>
          <div className="p-6">
            {yearGroups.length === 0 ? (
              <div className="empty-state">
                <BarChart3 className="empty-state-icon" />
                <p className="empty-state-title">No data to display</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={yearGroups} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconSize={10} />
                  <Bar dataKey="present" name="Present" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="absent" name="Absent" fill="#fca5a5" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-6 animate-pulse space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>ID</th>
                    <th>Year/Sem</th>
                    <th>Status</th>
                    <th>Marked At</th>
                    <th>Face %</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-surface-500">{r.department}</div>
                      </td>
                      <td className="font-mono text-sm">{r.student_id}</td>
                      <td className="text-surface-600">Y{r.year} S{r.semester}</td>
                      <td>
                        <span className={`badge ${
                          r.status === 'present' ? 'badge-success' :
                          r.status === 'halfday' ? 'badge-primary' :
                          r.status === 'leave' ? 'badge-warning' : 'badge-danger'
                        }`}>{r.status === 'halfday' ? 'Half Day' : r.status}</span>
                      </td>
                      <td className="text-xs text-surface-500">
                        {r.marked_at ? format(new Date(r.marked_at), 'hh:mm a') : '—'}
                      </td>
                      <td className="text-sm">
                        {r.face_match_score ? (
                          <span className={r.face_match_score >= 75 ? 'text-green-600' : 'text-amber-600'}>
                            {r.face_match_score}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                  {attendance.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="text-center text-surface-400 py-8">
                        No records found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
