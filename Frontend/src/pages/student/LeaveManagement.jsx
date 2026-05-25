import { useState, useEffect } from 'react';
import { leaveAPI } from '../../api/services';
import { FileText, Upload, CheckCircle, XCircle, Clock, Plus } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const LEAVE_TYPES = [
  { value: 'medical', label: 'Medical Leave' },
  { value: 'personal', label: 'Personal Leave' },
  { value: 'family', label: 'Family Emergency' },
  { value: 'exam_duty', label: 'Exam Duty' },
  { value: 'other', label: 'Other' },
];

const STATUS_BADGE = {
  pending: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-danger',
};

export default function LeaveManagement() {
  const [leaves, setLeaves] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    leave_type: '', from_date: '', to_date: '', reason: '', attachment: null,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      const { data } = await leaveAPI.getMyLeaves();
      setLeaves(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!form.leave_type) e.leave_type = 'Please select leave type.';
    if (!form.from_date) e.from_date = 'Start date is required.';
    if (!form.to_date) e.to_date = 'End date is required.';
    if (form.from_date && form.to_date && form.to_date < form.from_date)
      e.to_date = 'End date must be after start date.';
    if (!form.reason.trim() || form.reason.length < 10) e.reason = 'Please provide a reason (min 10 chars).';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('leave_type', form.leave_type);
      formData.append('from_date', form.from_date);
      formData.append('to_date', form.to_date);
      formData.append('reason', form.reason);
      if (form.attachment) formData.append('attachment', form.attachment);

      await leaveAPI.apply(formData);
      toast.success('Leave request submitted successfully.');
      setShowForm(false);
      setForm({ leave_type: '', from_date: '', to_date: '', reason: '', attachment: null });
      fetchLeaves();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const update = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: '' })); };

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p className="page-subtitle">Apply for leave and track your requests</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} />
          Apply Leave
        </button>
      </div>

      {/* Apply Leave Form */}
      {showForm && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">New Leave Request</span>
          </div>
          <form onSubmit={handleSubmit} className="card-body space-y-4">
            <div>
              <label className="form-label">Leave Type</label>
              <select className={`form-input ${errors.leave_type ? 'error' : ''}`}
                value={form.leave_type} onChange={e => update('leave_type', e.target.value)}>
                <option value="">Select leave type</option>
                {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {errors.leave_type && <p className="form-error">{errors.leave_type}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">From Date</label>
                <input type="date" className={`form-input ${errors.from_date ? 'error' : ''}`}
                  value={form.from_date} onChange={e => update('from_date', e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')} />
                {errors.from_date && <p className="form-error">{errors.from_date}</p>}
              </div>
              <div>
                <label className="form-label">To Date</label>
                <input type="date" className={`form-input ${errors.to_date ? 'error' : ''}`}
                  value={form.to_date} onChange={e => update('to_date', e.target.value)}
                  min={form.from_date || format(new Date(), 'yyyy-MM-dd')} />
                {errors.to_date && <p className="form-error">{errors.to_date}</p>}
              </div>
            </div>

            <div>
              <label className="form-label">Reason</label>
              <textarea className={`form-input resize-none ${errors.reason ? 'error' : ''}`}
                rows={3} value={form.reason} onChange={e => update('reason', e.target.value)}
                placeholder="Provide detailed reason for leave request..." />
              {errors.reason && <p className="form-error">{errors.reason}</p>}
            </div>

            <div>
              <label className="form-label">Supporting Document (Optional)</label>
              <div className="border border-dashed border-surface-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                <input type="file" id="attachment" className="hidden"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={e => update('attachment', e.target.files[0])} />
                <label htmlFor="attachment" className="cursor-pointer">
                  {form.attachment ? (
                    <div className="text-sm text-blue-600 font-medium">{form.attachment.name}</div>
                  ) : (
                    <>
                      <Upload size={20} className="text-surface-400 mx-auto mb-1" />
                      <div className="text-sm text-surface-500">Click to upload medical certificate or document</div>
                      <div className="text-xs text-surface-400 mt-0.5">JPEG, PNG, PDF up to 5MB</div>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
                {submitting ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Leave History */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <span className="card-title">Leave Requests</span>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded" />)}
          </div>
        ) : leaves.length === 0 ? (
          <div className="empty-state">
            <FileText className="empty-state-icon" />
            <p className="empty-state-title">No leave requests</p>
            <p className="empty-state-desc">You have not applied for any leave yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {leaves.map(leave => (
              <div key={leave.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-surface-900">
                        {LEAVE_TYPES.find(t => t.value === leave.leave_type)?.label || leave.leave_type}
                      </span>
                      <span className={`badge ${STATUS_BADGE[leave.status]}`}>{leave.status}</span>
                    </div>
                    <div className="text-xs text-surface-500">
                      {format(new Date(leave.from_date), 'dd MMM yyyy')} — {format(new Date(leave.to_date), 'dd MMM yyyy')}
                    </div>
                    <div className="text-xs text-surface-500 mt-1 line-clamp-2">{leave.reason}</div>
                    {leave.review_comment && (
                      <div className="text-xs text-surface-600 mt-1 bg-surface-50 px-2 py-1 rounded">
                        Comment: {leave.review_comment}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-surface-400 flex-shrink-0">
                    {format(new Date(leave.created_at), 'dd MMM')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
