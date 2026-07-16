import { useState, useEffect } from 'react';
import { attendanceAPI, generalAPI } from '../../api/services';
import { CalendarCheck, Search, Users, ShieldCheck, Navigation } from 'lucide-react';
import { format } from 'date-fns';

export default function AttendanceMonitor() {
  const [records, setRecords] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    department_id: '',
    year: '',
  });

  useEffect(() => {
    generalAPI.getDepartments().then(({ data }) => setDepartments(data.data || []));
  }, []);

  useEffect(() => { fetchAttendance(); }, [filters]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const { data } = await attendanceAPI.getDepartment(filters);
      setRecords(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  const presentCount  = records.reduce((s, r) => s + (r.status === 'present' ? 1 : r.status === 'halfday' ? 0.5 : 0), 0);
  const absentCount   = records.reduce((s, r) => s + (r.status === 'absent'  ? 1 : r.status === 'halfday' ? 0.5 : 0), 0);
  const leaveCount    = records.filter(r => r.status === 'leave').length;
  const halfdayCount  = records.filter(r => r.status === 'halfday').length;
  const total         = records.length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Attendance Monitor</h1>
        <p className="page-subtitle">Real-time attendance tracking and monitoring</p>
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
      <div className="grid grid-cols-5 gap-4">
        <div className="stat-card text-center">
          <div className="text-xl font-bold text-surface-900">{total}</div>
          <div className="text-xs text-surface-500 mt-1">Total Students</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-xl font-bold text-green-600">{presentCount}</div>
          <div className="text-xs text-surface-500 mt-1">Present</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-xl font-bold text-cyan-500">{halfdayCount}</div>
          <div className="text-xs text-surface-500 mt-1">Half Day</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-xl font-bold text-red-500">{absentCount}</div>
          <div className="text-xs text-surface-500 mt-1">Absent</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-xl font-bold text-amber-500">{leaveCount}</div>
          <div className="text-xs text-surface-500 mt-1">On Leave</div>
        </div>
      </div>

      {/* Table */}
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
                  <th>Face Match</th>
                  <th>GPS</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div className="font-medium text-surface-900">{r.name}</div>
                      <div className="text-xs text-surface-500">{r.department}</div>
                      {r.branch && <div className="text-[10px] text-surface-400 font-medium mt-0.5">{r.branch}</div>}
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
                    <td className="text-surface-500 text-xs">
                      {r.marked_at ? format(new Date(r.marked_at), 'hh:mm a') : '—'}
                    </td>
                    <td>
                      {r.face_match_score ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <ShieldCheck size={12} /> {r.face_match_score}%
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      {r.verified_by_location ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <Navigation size={12} /> Verified
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-surface-400 py-8">
                      No records found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
