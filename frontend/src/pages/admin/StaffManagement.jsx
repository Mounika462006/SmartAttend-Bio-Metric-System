import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/services';
import {
  UserCog, Plus, Search, CheckCircle, XCircle,
  Mail, Phone, Building2, Loader, Edit, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const DESIGNATIONS = [
  'Professor', 'Associate Professor', 'Assistant Professor',
  'Senior Lecturer', 'Lecturer', 'Lab Instructor', 'HOD',
];

export default function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', staff_id: '', email: '', mobile: '',
    department_id: '', designation: '', password: '',
  });
  const [errors, setErrors] = useState({});

  // Edit states
  const [editStaff, setEditStaff] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '', staff_id: '', email: '', mobile: '',
    department_id: '', designation: '', is_active: true,
  });

  useEffect(() => {
    Promise.all([
      adminAPI.getStaff(),
      import('../../api/services').then(m => m.generalAPI.getDepartments()),
    ]).then(([s, d]) => {
      setStaff(s.data.data || []);
      setDepartments(d.data.data || []);
    }).catch(() => {
      toast.error('Failed to load initial data.');
    }).finally(() => setLoading(false));
  }, []);

  const fetchStaff = () => {
    adminAPI.getStaff()
      .then(({ data }) => setStaff(data.data || []))
      .catch(() => toast.error('Failed to refresh staff list.'));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.staff_id.trim()) e.staff_id = 'Staff ID is required.';
    
    const emailLower = form.email.toLowerCase();
    const domainMatch = emailLower.endsWith('.edu') || emailLower.endsWith('.edu.in') || emailLower.endsWith('.edu.com');
    if (!form.email.includes('@') || !domainMatch) {
      e.email = 'Email must end with .edu, .edu.in or .edu.com';
    }
    
    if (!form.department_id) e.department_id = 'Department is required.';
    if (!form.designation) e.designation = 'Designation is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = { ...form, department_id: form.department_id };
      if (!payload.password) payload.password = 'staff@123';
      await adminAPI.createStaff(payload);
      toast.success(`${form.name} added as faculty successfully.`);
      setShowForm(false);
      setForm({ name: '', staff_id: '', email: '', mobile: '', department_id: '', designation: '', password: '' });
      fetchStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create staff.');
    } finally {
      setSubmitting(false);
    }
  };

  const update = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: '' }));
  };

  const handleEditStaffClick = (s) => {
    setEditStaff(s);
    const deptId = departments.find(d => d.name === s.department)?.id || '';
    setEditForm({
      name: s.name,
      staff_id: s.staff_id,
      email: s.email,
      mobile: s.mobile || '',
      department_id: String(deptId),
      designation: s.designation,
      is_active: s.is_active === 1 || s.is_active === true,
    });
  };

  const handleEditFormChange = (key, value) => {
    setEditForm(prev => ({ ...prev, [key]: value }));
  };

  const handleEditStaffSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...editForm,
        department_id: editForm.department_id,
      };
      await adminAPI.updateStaff(editStaff.id, payload);
      toast.success('Faculty details updated successfully.');
      setEditStaff(null);
      fetchStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update faculty details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStaff = async (id, name) => {
    if (window.confirm(`Are you sure you want to permanently delete faculty member ${name}? This action cannot be undone.`)) {
      try {
        await adminAPI.deleteStaff(id);
        toast.success(`Faculty member ${name} deleted successfully.`);
        fetchStaff();
      } catch {
        toast.error('Failed to delete faculty member.');
      }
    }
  };

  const filtered = staff.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.staff_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Staff Management</h1>
          <p className="page-subtitle">Manage faculty accounts and department assignments</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-1.5">
          <Plus size={16} /> Add Faculty
        </button>
      </div>

      {/* Add Staff Form */}
      {showForm && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Add New Faculty</span>
          </div>
          <form onSubmit={handleCreate} className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Full Name</label>
                <input type="text" className={`form-input ${errors.name ? 'error' : ''}`}
                  value={form.name} onChange={e => update('name', e.target.value)}
                  placeholder="Dr. / Mr. / Ms." />
                {errors.name && <p className="form-error">{errors.name}</p>}
              </div>
              <div>
                <label className="form-label">Staff ID</label>
                <input type="text" className={`form-input ${errors.staff_id ? 'error' : ''}`}
                  value={form.staff_id} onChange={e => update('staff_id', e.target.value.toUpperCase())}
                  placeholder="e.g. STF002" />
                {errors.staff_id && <p className="form-error">{errors.staff_id}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Email Address</label>
                <input type="email" className={`form-input ${errors.email ? 'error' : ''}`}
                  value={form.email} onChange={e => update('email', e.target.value)}
                  placeholder="faculty@college.edu" />
                {errors.email && <p className="form-error">{errors.email}</p>}
              </div>
              <div>
                <label className="form-label">Mobile Number</label>
                <input type="tel" className="form-input"
                  value={form.mobile} onChange={e => update('mobile', e.target.value)}
                  placeholder="10-digit mobile" maxLength={10} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Department</label>
                <select className={`form-input ${errors.department_id ? 'error' : ''}`}
                  value={form.department_id} onChange={e => update('department_id', e.target.value)}>
                  <option value="">Select department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {errors.department_id && <p className="form-error">{errors.department_id}</p>}
              </div>
              <div>
                <label className="form-label">Designation</label>
                <select className={`form-input ${errors.designation ? 'error' : ''}`}
                  value={form.designation} onChange={e => update('designation', e.target.value)}>
                  <option value="">Select designation</option>
                  {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {errors.designation && <p className="form-error">{errors.designation}</p>}
              </div>
            </div>

            <div>
              <label className="form-label">Initial Password (Optional)</label>
              <input type="text" className="form-input"
                value={form.password} onChange={e => update('password', e.target.value)}
                placeholder="Default: staff@123" />
              <p className="text-xs text-surface-400 mt-1">Leave blank to use default password: staff@123</p>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
                {submitting ? <Loader size={15} className="animate-spin" /> : 'Create Faculty Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input type="text" className="form-input pl-9" placeholder="Search by name, ID or email..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="text-sm text-surface-500 font-medium self-end">
          Total Faculty: {filtered.length}
        </div>
      </div>

      {/* Staff Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 animate-pulse space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <UserCog className="empty-state-icon" />
            <p className="empty-state-title">No faculty found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Faculty</th>
                  <th>Staff ID</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Contact</th>
                  <th>Last Login</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-surface-900">{s.name}</div>
                          <div className="text-xs text-surface-500">{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-sm">{s.staff_id}</td>
                    <td className="text-surface-600 text-sm">{s.department}</td>
                    <td className="text-surface-600 text-sm">{s.designation}</td>
                    <td>
                      {s.mobile && (
                        <div className="flex items-center gap-1 text-xs text-surface-500">
                          <Phone size={11} /> {s.mobile}
                        </div>
                      )}
                    </td>
                    <td className="text-surface-500 text-xs">
                      {s.last_login ? format(new Date(s.last_login), 'dd MMM, hh:mm a') : 'Never'}
                    </td>
                    <td>
                      <span className={`badge ${s.is_active ? 'badge-success' : 'badge-neutral'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => handleEditStaffClick(s)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit Faculty Details"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(s.id, s.name)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete Faculty"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Staff Modal */}
      {editStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto flex flex-col animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b border-surface-100 pb-3">
              <h3 className="font-semibold text-surface-900 text-lg">Edit Faculty Details</h3>
              <button onClick={() => setEditStaff(null)} className="text-surface-400 hover:text-surface-600 text-2xl font-semibold leading-none">&times;</button>
            </div>
            <form onSubmit={handleEditStaffSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Full Name</label>
                  <input type="text" required className="form-input"
                    value={editForm.name} onChange={e => handleEditFormChange('name', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Staff ID</label>
                  <input type="text" required className="form-input"
                    value={editForm.staff_id} onChange={e => handleEditFormChange('staff_id', e.target.value.toUpperCase())} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Email Address</label>
                  <input type="email" required className="form-input"
                    value={editForm.email} onChange={e => handleEditFormChange('email', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Mobile Number</label>
                  <input type="tel" className="form-input"
                    value={editForm.mobile} onChange={e => handleEditFormChange('mobile', e.target.value)} maxLength={10} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Department</label>
                  <select required className="form-input"
                    value={editForm.department_id} onChange={e => handleEditFormChange('department_id', e.target.value)}>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Designation</label>
                  <select required className="form-input"
                    value={editForm.designation} onChange={e => handleEditFormChange('designation', e.target.value)}>
                    {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center py-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-surface-700">
                  <input type="checkbox" className="rounded border-surface-300 text-blue-600 focus:ring-blue-500"
                    checked={editForm.is_active} onChange={e => handleEditFormChange('is_active', e.target.checked)} />
                  Active Faculty Account
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setEditStaff(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
                  {submitting ? <Loader size={15} className="animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
