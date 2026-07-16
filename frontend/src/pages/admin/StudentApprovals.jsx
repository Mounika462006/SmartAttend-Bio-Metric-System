import { useState, useEffect } from 'react';
import { adminAPI, biometricAPI, generalAPI } from '../../api/services';
import {
  CheckCircle, XCircle, Clock, Search, ShieldCheck,
  AlertTriangle, Plus, Edit, Trash2, Loader
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const BRANCHES_BY_DEPT = {
  'CSE': [
    'Cyber Security',
    'Artificial Intelligence',
    'Data Science',
    'Internet of Things (IoT)'
  ],
  'IT': [
    'Cloud Computing',
    'Full Stack Development',
    'Networking',
    'Software Engineering'
  ],
  'ECE': [
    'VLSI Design',
    'Embedded Systems',
    'Communication Systems',
    'Robotics'
  ],
  'EEE': [
    'Power Systems',
    'Electrical Machines',
    'Renewable Energy',
    'Control Systems'
  ],
  'MECH': [
    'Automobile Engineering',
    'Robotics and Automation',
    'Manufacturing Engineering',
    'Thermal Engineering'
  ],
  'CIVIL': [
    'Structural Engineering',
    'Construction Engineering',
    'Environmental Engineering',
    'Transportation Engineering'
  ],
  'AIDS': [
    'Machine Learning',
    'Deep Learning',
    'Data Analytics',
    'Business Intelligence'
  ],
  'AI & DS': [
    'Machine Learning',
    'Deep Learning',
    'Data Analytics',
    'Business Intelligence'
  ],
  'BT': [
    'Genetic Engineering',
    'Bioinformatics',
    'Microbiology',
    'Bioprocess Engineering'
  ],
  'CHEM': [
    'Petroleum Engineering',
    'Process Engineering',
    'Polymer Technology',
    'Food Technology'
  ]
};

export default function StudentApprovals() {
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add form state
  const [addForm, setAddForm] = useState({
    name: '', student_id: '', email: '', mobile: '',
    department_id: '', branch: '', year: '', semester: '',
    password: '',
  });

  // Edit form state
  const [editStudent, setEditStudent] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '', student_id: '', email: '', mobile: '',
    department_id: '', branch: '', year: '', semester: '',
    status: '', is_active: true,
  });

  useEffect(() => {
    // Fetch departments once
    generalAPI.getDepartments()
      .then(({ data }) => setDepartments(data.data || []))
      .catch(() => toast.error('Failed to load departments.'));
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [filter, search]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = { status: filter, search, limit: 50 };
      const { data } = await adminAPI.getStudents(params);
      setStudents(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  const getBranchesForDeptId = (deptId) => {
    const dept = departments.find(d => String(d.id) === String(deptId));
    return BRANCHES_BY_DEPT[dept?.code] || [];
  };

  const handleAddFormChange = (key, value) => {
    setAddForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'department_id') {
        next.branch = ''; // Reset branch when department changes
      }
      return next;
    });
  };

  const handleEditFormChange = (key, value) => {
    setEditForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'department_id') {
        next.branch = ''; // Reset branch when department changes
      }
      return next;
    });
  };

  const handleAddStudentSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...addForm,
        department_id: parseInt(addForm.department_id),
        year: parseInt(addForm.year),
        semester: parseInt(addForm.semester),
      };
      await adminAPI.createStudent(payload);
      toast.success(`${addForm.name} created successfully.`);
      setShowAddForm(false);
      setAddForm({
        name: '', student_id: '', email: '', mobile: '',
        department_id: '', branch: '', year: '', semester: '',
        password: '',
      });
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add student.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditStudentClick = (student) => {
    setEditStudent(student);
    setEditForm({
      name: student.name,
      student_id: student.student_id,
      email: student.email,
      mobile: student.mobile || '',
      department_id: String(departments.find(d => d.name === student.department)?.id || ''),
      branch: student.branch || '',
      year: String(student.year),
      semester: String(student.semester),
      status: student.status,
      is_active: student.is_active === 1 || student.is_active === true,
    });
  };

  const handleEditStudentSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...editForm,
        department_id: parseInt(editForm.department_id),
        year: parseInt(editForm.year),
        semester: parseInt(editForm.semester),
      };
      await adminAPI.updateStudent(editStudent.id, payload);
      toast.success('Student details updated successfully.');
      setEditStudent(null);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update student details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStudent = async (id, name) => {
    if (window.confirm(`Are you sure you want to permanently delete student ${name}? This action cannot be undone.`)) {
      setProcessing(id);
      try {
        await adminAPI.deleteStudent(id);
        toast.success(`Student ${name} deleted successfully.`);
        fetchStudents();
      } catch {
        toast.error('Failed to delete student.');
      } finally {
        setProcessing(null);
      }
    }
  };

  const handleDeleteBiometric = async (id, name) => {
    if (!window.confirm(`Delete biometric data for ${name}? The student will need to register their face again.`)) {
      return;
    }

    setProcessing(id);
    try {
      await biometricAPI.deleteForStudent(id);
      toast.success(`Biometric data deleted for ${name}.`);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete biometric data.');
    } finally {
      setProcessing(null);
    }
  };

  const handleApprove = async (id, name) => {
    setProcessing(id);
    try {
      await adminAPI.updateStudentStatus(id, { status: 'approved' });
      toast.success(`${name} approved successfully.`);
      fetchStudents();
    } catch {
      toast.error('Failed to approve student.');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason.');
      return;
    }
    setProcessing(rejectModal.id);
    try {
      await adminAPI.updateStudentStatus(rejectModal.id, { status: 'rejected', reason: rejectReason });
      toast.success(`${rejectModal.name}'s registration rejected.`);
      setRejectModal(null);
      setRejectReason('');
      fetchStudents();
    } catch {
      toast.error('Failed to reject student.');
    } finally {
      setProcessing(null);
    }
  };

  const statusBadge = {
    pending: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Student Approvals & Management</h1>
          <p className="page-subtitle">Add students directly or review registration approvals</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary flex items-center gap-1.5">
          <Plus size={16} /> Add Student
        </button>
      </div>

      {/* Add Student Form */}
      {showAddForm && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Add New Student</span>
          </div>
          <form onSubmit={handleAddStudentSubmit} className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Full Name</label>
                <input type="text" required className="form-input"
                  value={addForm.name} onChange={e => handleAddFormChange('name', e.target.value)}
                  placeholder="Full Name" />
              </div>
              <div>
                <label className="form-label">Student ID / Roll No</label>
                <input type="text" required className="form-input"
                  value={addForm.student_id} onChange={e => handleAddFormChange('student_id', e.target.value.toUpperCase())}
                  placeholder="e.g. 23AI001" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Email Address</label>
                <input type="email" required className="form-input"
                  value={addForm.email} onChange={e => handleAddFormChange('email', e.target.value)}
                  placeholder="student@college.edu.in" />
              </div>
              <div>
                <label className="form-label">Mobile Number</label>
                <input type="tel" className="form-input"
                  value={addForm.mobile} onChange={e => handleAddFormChange('mobile', e.target.value)}
                  placeholder="10-digit mobile number" maxLength={10} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Department</label>
                <select required className="form-input"
                  value={addForm.department_id} onChange={e => handleAddFormChange('department_id', e.target.value)}>
                  <option value="">Select department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Branch / Specialization</label>
                <select required className="form-input"
                  value={addForm.branch} onChange={e => handleAddFormChange('branch', e.target.value)}
                  disabled={!addForm.department_id}>
                  <option value="">Select branch</option>
                  {getBranchesForDeptId(addForm.department_id).map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Year</label>
                <select required className="form-input"
                  value={addForm.year} onChange={e => handleAddFormChange('year', e.target.value)}>
                  <option value="">Select year</option>
                  {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y} Year</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Semester</label>
                <select required className="form-input"
                  value={addForm.semester} onChange={e => handleAddFormChange('semester', e.target.value)}>
                  <option value="">Select semester</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="form-label">Initial Password (Optional)</label>
              <input type="text" className="form-input"
                value={addForm.password} onChange={e => handleAddFormChange('password', e.target.value)}
                placeholder="Default: student@123" />
              <p className="text-xs text-surface-400 mt-1">Leave blank to use default password: student@123</p>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
                {submitting ? <Loader size={15} className="animate-spin" /> : 'Create Student'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input type="text" className="form-input pl-9"
            placeholder="Search by name, ID or email..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 p-1 bg-surface-100 rounded-lg self-end">
          {['pending', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                filter === s ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-14 rounded" />)}
          </div>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <Clock className="empty-state-icon" />
            <p className="empty-state-title">No {filter} students</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>ID</th>
                  <th>Department</th>
                  <th>Year/Sem</th>
                  <th>Biometric</th>
                  <th>Registered Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div>
                        <div className="font-medium text-surface-900">{s.name}</div>
                        <div className="text-xs text-surface-500">{s.email}</div>
                      </div>
                    </td>
                    <td className="font-mono text-sm">{s.student_id}</td>
                    <td>
                      <div className="text-surface-800 font-medium">{s.department}</div>
                      {s.branch && <div className="text-xs text-surface-400 font-medium mt-0.5">{s.branch}</div>}
                    </td>
                    <td className="text-surface-600">Y{s.year} S{s.semester}</td>
                    <td>
                      {s.biometric_registered ? (
                        <div className="flex items-center gap-2">
                          <span className="badge badge-success"><ShieldCheck size={10} className="mr-1" />Registered</span>
                          <button
                            onClick={() => handleDeleteBiometric(s.id, s.name)}
                            disabled={processing === s.id}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete Biometric Data"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="badge badge-neutral">Not Registered</span>
                      )}
                    </td>
                    <td className="text-surface-500 text-xs">
                      {s.created_at ? format(new Date(s.created_at), 'dd MMM yyyy') : '–'}
                    </td>
                    <td><span className={`badge ${statusBadge[s.status]}`}>{s.status}</span></td>
                    <td>
                      <div className="flex gap-2 items-center">
                        {filter === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(s.id, s.name)}
                              disabled={processing === s.id}
                              className="btn-success py-1 px-2 text-xs flex items-center gap-1.5"
                            >
                              <CheckCircle size={13} />
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectModal({ id: s.id, name: s.name })}
                              disabled={processing === s.id}
                              className="btn-danger py-1 px-2 text-xs flex items-center gap-1.5"
                            >
                              <XCircle size={13} />
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleEditStudentClick(s)}
                          disabled={processing === s.id}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit Student Details"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(s.id, s.name)}
                          disabled={processing === s.id}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete Student"
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

      {/* Edit Student Modal */}
      {editStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-surface-100 pb-3">
              <h3 className="font-semibold text-surface-900 text-lg">Edit Student Details</h3>
              <button onClick={() => setEditStudent(null)} className="text-surface-400 hover:text-surface-600">×</button>
            </div>
            <form onSubmit={handleEditStudentSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Full Name</label>
                  <input type="text" required className="form-input"
                    value={editForm.name} onChange={e => handleEditFormChange('name', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Student ID / Roll No</label>
                  <input type="text" required className="form-input"
                    value={editForm.student_id} onChange={e => handleEditFormChange('student_id', e.target.value.toUpperCase())} />
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
                  <label className="form-label">Branch / Specialization</label>
                  <select required className="form-input"
                    value={editForm.branch} onChange={e => handleEditFormChange('branch', e.target.value)}>
                    <option value="">Select branch</option>
                    {getBranchesForDeptId(editForm.department_id).map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Year</label>
                  <select required className="form-input"
                    value={editForm.year} onChange={e => handleEditFormChange('year', e.target.value)}>
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y} Year</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Semester</label>
                  <select required className="form-input"
                    value={editForm.semester} onChange={e => handleEditFormChange('semester', e.target.value)}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Approval Status</label>
                  <select required className="form-input"
                    value={editForm.status} onChange={e => handleEditFormChange('status', e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-surface-700">
                    <input type="checkbox" className="rounded border-surface-300 text-blue-600 focus:ring-blue-500"
                      checked={editForm.is_active} onChange={e => handleEditFormChange('is_active', e.target.checked)} />
                    Active Student Account
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setEditStudent(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
                  {submitting ? <Loader size={15} className="animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-surface-900">Reject Registration</h3>
                <p className="text-sm text-surface-500">{rejectModal.name}</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="form-label">Rejection Reason</label>
              <textarea
                className="form-input resize-none" rows={3}
                value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Provide reason for rejection (visible to student)..."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleReject} disabled={!!processing} className="btn-danger flex-1 justify-center">
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
