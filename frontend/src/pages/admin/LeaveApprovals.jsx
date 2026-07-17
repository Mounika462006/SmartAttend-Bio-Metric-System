import { useState, useEffect } from 'react';
import { adminAPI, generalAPI } from '../../api/services';
import { leaveAPI } from '../../api/services';
import { generalAPI as gAPI } from '../../api/services';
import { attendanceAPI } from '../../api/services';
import { CheckCircle, XCircle, Search, Filter, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const LEAVE_TYPES = {
  medical: 'Medical', personal: 'Personal', family: 'Family Emergency',
  exam_duty: 'Exam Duty', other: 'Other',
};

export default function LeaveApprovals() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ status: 'pending', department_id: '' });
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    gAPI.getDepartments().then(({ data }) => setDepartments(data.data || []));
  }, []);

  useEffect(() => { fetchLeaves(); }, [filters]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const { data } = await leaveAPI.getAllLeaves(filters);
      setLeaves(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (status) => {
    setProcessing(reviewModal.id);
    try {
      await leaveAPI.review(reviewModal.id, { status, review_comment: reviewComment });
      toast.success(`Leave ${status} successfully.`);
      setReviewModal(null);
      setReviewComment('');
      fetchLeaves();
    } catch {
      toast.error('Failed to process leave request.');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Leave Approvals</h1>
        <p className="page-subtitle">Review and process student leave requests</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 p-1 bg-surface-100 rounded-lg">
          {['pending', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => setFilters(p => ({ ...p, status: s }))}
              className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                filters.status === s ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
              }`}>
              {s}
            </button>
          ))}
        </div>
        <select className="form-input w-auto"
          value={filters.department_id}
          onChange={e => setFilters(p => ({ ...p, department_id: e.target.value }))}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Leaves */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 animate-pulse space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded" />)}
          </div>
        ) : leaves.length === 0 ? (
          <div className="empty-state">
            <CheckCircle className="empty-state-icon" />
            <p className="empty-state-title">No {filters.status} leave requests</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {leaves.map(leave => (
              <div key={leave.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-surface-900">{leave.student_name}</span>
                      <span className="text-xs font-mono text-surface-500">{leave.student_id}</span>
                      <span className="text-xs text-surface-400">
                        {leave.department}
                        {leave.branch && <span className="text-surface-400 font-normal"> — {leave.branch}</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-surface-500 mb-1">
                      <span className="font-medium text-surface-700">{LEAVE_TYPES[leave.leave_type]}</span>
                      <span>{format(new Date(leave.from_date), 'dd MMM')} — {format(new Date(leave.to_date), 'dd MMM yyyy')}</span>
                    </div>
                    <p className="text-sm text-surface-600 line-clamp-2">{leave.reason}</p>
                    {leave.review_comment && (
                      <div className="text-xs text-surface-500 mt-1 bg-surface-50 px-2 py-1 rounded">
                        Comment: {leave.review_comment}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`badge ${
                      leave.status === 'approved' ? 'badge-success' :
                      leave.status === 'rejected' ? 'badge-danger' : 'badge-warning'
                    }`}>{leave.status}</span>
                    {leave.status === 'pending' && (
                      <button
                        onClick={() => setReviewModal(leave)}
                        className={isAdmin ? "btn-secondary py-1 px-3 text-xs" : "btn-primary py-1 px-3 text-xs"}
                      >
                        <MessageSquare size={12} /> {isAdmin ? 'Details' : 'Review'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-semibold text-surface-900 mb-1">Review Leave Request</h3>
            <p className="text-sm text-surface-500 mb-4">
              {reviewModal.student_name} — {LEAVE_TYPES[reviewModal.leave_type]}<br />
              {format(new Date(reviewModal.from_date), 'dd MMM')} to {format(new Date(reviewModal.to_date), 'dd MMM yyyy')}
            </p>
            <div className="bg-surface-50 rounded-lg p-3 text-sm text-surface-600 mb-4">
              {reviewModal.reason}
            </div>
            {!isAdmin && (
              <div className="mb-4">
                <label className="form-label">Comment (Optional)</label>
                <textarea className="form-input resize-none" rows={2}
                  value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                  placeholder="Add a comment for the student..." />
              </div>
            )}
            <div className="flex gap-3">
              {isAdmin ? (
                <button onClick={() => setReviewModal(null)} className="btn-secondary flex-1 justify-center">
                  Close
                </button>
              ) : (
                <>
                  <button onClick={() => { setReviewModal(null); setReviewComment(''); }} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button onClick={() => handleReview('rejected')} disabled={!!processing} className="btn-danger flex-1 justify-center">
                    <XCircle size={15} /> Reject
                  </button>
                  <button onClick={() => handleReview('approved')} disabled={!!processing} className="btn-success flex-1 justify-center">
                    <CheckCircle size={15} /> Approve
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
