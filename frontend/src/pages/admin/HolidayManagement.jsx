import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/services';
import { CalendarDays, Plus, Trash2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const HOLIDAY_TYPES = [
  { value: 'public', label: 'Public Holiday' },
  { value: 'festival', label: 'Festival' },
  { value: 'college', label: 'College Holiday' },
  { value: 'emergency', label: 'Emergency Holiday' },
  { value: 'exam', label: 'Exam Period' },
];

const TYPE_BADGE = {
  public: 'badge-primary',
  festival: 'badge-warning',
  college: 'badge-success',
  emergency: 'badge-danger',
  exam: 'badge-neutral',
};

export default function HolidayManagement() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', from_date: '', to_date: '', type: 'public', description: '', academic_year: '2024-25',
  });

  useEffect(() => { fetchHolidays(); }, []);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getHolidays({ academic_year: '2024-25' });
      setHolidays(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await adminAPI.createHoliday(form);
      toast.success('Holiday added successfully.');
      setShowForm(false);
      setForm({ name: '', from_date: '', to_date: '', type: 'public', description: '', academic_year: '2024-25' });
      fetchHolidays();
    } catch {
      toast.error('Failed to add holiday.');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete holiday "${name}"?`)) return;
    try {
      await adminAPI.deleteHoliday(id);
      toast.success('Holiday deleted.');
      fetchHolidays();
    } catch {
      toast.error('Failed to delete holiday.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Holiday Management</h1>
          <p className="page-subtitle">Manage academic year holidays and special days</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} /> Add Holiday
        </button>
      </div>

      {/* Add Holiday Form */}
      {showForm && (
        <div className="card">
          <div className="card-header"><span className="card-title">Add New Holiday</span></div>
          <form onSubmit={handleCreate} className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Holiday Name</label>
                <input type="text" className="form-input" required
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Pongal" />
              </div>
              <div>
                <label className="form-label">From Date</label>
                <input type="date" className="form-input" required
                  value={form.from_date} onChange={e => {
                    const val = e.target.value;
                    setForm(p => ({ ...p, from_date: val, to_date: p.to_date || val }));
                  }} />
              </div>
              <div>
                <label className="form-label">To Date</label>
                <input type="date" className="form-input" required
                  value={form.to_date} onChange={e => setForm(p => ({ ...p, to_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Holiday Type</label>
                <select className="form-input"
                  value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  {HOLIDAY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Academic Year</label>
                <input type="text" className="form-input"
                  value={form.academic_year} onChange={e => setForm(p => ({ ...p, academic_year: e.target.value }))}
                  placeholder="2024-25" />
              </div>
            </div>
            <div>
              <label className="form-label">Description (Optional)</label>
              <input type="text" className="form-input"
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1">Add Holiday</button>
            </div>
          </form>
        </div>
      )}

      {/* Holidays Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 animate-pulse space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-12 rounded" />)}
          </div>
        ) : holidays.length === 0 ? (
          <div className="empty-state">
            <CalendarDays className="empty-state-icon" />
            <p className="empty-state-title">No holidays added</p>
            <p className="empty-state-desc">Add holidays to exclude them from attendance calculations.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Holiday Name</th>
                  <th>Holiday Dates</th>
                  <th>Duration / Day</th>
                  <th>Type</th>
                  <th>Academic Year</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {holidays.map(h => (
                  <tr key={h.id}>
                    <td className="font-medium">{h.name}</td>
                    <td>
                      {h.from_date === h.to_date || !h.to_date
                        ? format(new Date(h.from_date), 'dd MMM yyyy')
                        : `${format(new Date(h.from_date), 'dd MMM')} — ${format(new Date(h.to_date), 'dd MMM yyyy')}`}
                    </td>
                    <td className="text-surface-500">
                      {h.from_date === h.to_date || !h.to_date
                        ? format(new Date(h.from_date), 'EEEE')
                        : `Duration: ${Math.round((new Date(h.to_date) - new Date(h.from_date)) / (1000 * 60 * 60 * 24)) + 1} days`}
                    </td>
                    <td><span className={`badge ${TYPE_BADGE[h.type]}`}>{h.type}</span></td>
                    <td className="text-surface-500">{h.academic_year}</td>
                    <td>
                      <button onClick={() => handleDelete(h.id, h.name)}
                        className="p-1.5 text-surface-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
