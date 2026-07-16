import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, ChevronRight, ChevronLeft, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { authAPI, generalAPI } from '../../api/services';
import toast from 'react-hot-toast';

const STEPS = ['Personal Info', 'Academic Info', 'Account Security'];
const ACADEMIC_EMAIL_PATTERN = /\.(edu|edu\.in|edu\.com)$/i;

function getApiErrorMessage(err, fallback) {
  const data = err.response?.data;
  const firstFieldError = Array.isArray(data?.errors) ? data.errors[0]?.message : '';
  return firstFieldError || data?.message ||
    (!err.response || typeof data !== 'object' || err.code === 'ERR_NETWORK'
      ? 'Cannot connect to server. Please ensure the backend server is running.'
      : fallback);
}

// All UG courses (ordered as specified)
const ALL_UG_COURSES = [
  'B.E Computer Science and Engineering',
  'B.Tech Information Technology',
  'B.E Electronics and Communication Engineering',
  'B.E Electrical and Electronics Engineering',
  'B.E Mechanical Engineering',
  'B.E Civil Engineering',
  'B.Tech Artificial Intelligence and Data Science',
  'B.Tech Artificial Intelligence and Machine Learning',
  'B.Tech Cyber Security',
  'B.Tech Biotechnology',
  'B.E Chemical Engineering',
  'B.Tech Food Technology',
  'B.Tech Automobile Engineering',
  'B.Tech Mechatronics Engineering',
  'B.Tech Robotics and Automation',
];

// All PG courses (ordered as specified)
const ALL_PG_COURSES = [
  'M.E Computer Science and Engineering',
  'M.Tech Information Technology',
  'M.E VLSI Design',
  'M.E Embedded Systems',
  'M.E Power Systems Engineering',
  'M.E Structural Engineering',
  'M.E Manufacturing Engineering',
  'M.Tech Artificial Intelligence',
  'M.Tech Data Science',
  'M.Tech Cyber Security',
  'M.Tech Biotechnology',
  'M.E Chemical Engineering',
  'MBA',
  'MCA',
];

// Return the appropriate course list based on course type
// MBA/MCA departments only offer PG
function getCourses(deptCode, courseType) {
  if (!deptCode || !courseType) return [];
  return courseType === 'UG' ? ALL_UG_COURSES : ALL_PG_COURSES;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: '', student_id: '', email: '', mobile: '',
    department_id: '', course_type: '', branch: '',
    year: '', semester: '',
    password: '', confirm_password: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    generalAPI.getDepartments()
      .then(({ data }) => setDepartments(data.data || []))
      .catch(() => {});
  }, []);

  const selectedDept     = departments.find(d => String(d.id) === String(form.department_id));
  const selectedDeptCode = selectedDept ? selectedDept.code : '';
  const availableCourses = getCourses(selectedDeptCode, form.course_type);

  // Semester options: UG → 1–8, PG → 1–4
  const semesterOptions = form.course_type === 'PG'
    ? [1, 2, 3, 4]
    : [1, 2, 3, 4, 5, 6, 7, 8];

  // Year options: UG → 1–4, PG → 1–2
  const yearOptions = form.course_type === 'PG'
    ? [1, 2]
    : [1, 2, 3, 4];

  const update = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'department_id') {
        next.course_type = '';
        next.branch      = '';
        next.year        = '';
        next.semester    = '';
      }
      if (field === 'course_type') {
        next.branch   = '';
        next.year     = '';
        next.semester = '';
      }
      return next;
    });
    setFieldErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateStep = () => {
    const errors = {};
    if (step === 0) {
      if (!form.name.trim()) errors.name = 'Full name is required.';
      if (!form.email.includes('@')) errors.email = 'Valid email is required.';
      else if (!ACADEMIC_EMAIL_PATTERN.test(form.email.trim())) {
        errors.email = 'Email must end with .edu, .edu.in, or .edu.com.';
      }
      if (!/^[6-9]\d{9}$/.test(form.mobile)) errors.mobile = 'Valid 10-digit Indian mobile number required.';
    }
    if (step === 1) {
      if (!form.student_id.trim()) errors.student_id = 'Student ID is required.';
      if (!form.department_id)   errors.department_id = 'Please select a department.';
      if (!form.course_type)     errors.course_type   = 'Please select a course type (UG / PG).';
      if (!form.branch)          errors.branch        = 'Please select your course.';
      if (!form.year)            errors.year          = 'Please select your year.';
      if (!form.semester)        errors.semester      = 'Please select your semester.';
    }
    if (step === 2) {
      if (form.password.length < 8)        errors.password = 'Password must be at least 8 characters.';
      if (!/[A-Z]/.test(form.password))    errors.password = 'Password must include an uppercase letter.';
      if (!/\d/.test(form.password))       errors.password = 'Password must include a number.';
      if (form.password !== form.confirm_password) errors.confirm_password = 'Passwords do not match.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    if (validateStep()) setStep(s => Math.min(s + 1, 2));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep()) return;
    setLoading(true);
    setError('');
    try {
      const payload = { ...form };
      delete payload.confirm_password;
      delete payload.course_type; // not a DB field — branch already captures the course name
      payload.department_id = parseInt(payload.department_id);
      payload.year          = parseInt(payload.year);
      payload.semester      = parseInt(payload.semester);
      await authAPI.register(payload);
      setSuccess(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #03071e 0%, #0a0e27 50%, #162b85 100%)' }}>
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-surface-900 mb-2">Registration Submitted</h2>
          <p className="text-surface-500 mb-6">
            Your registration is pending admin approval. You will be notified once your account is verified.
            Please complete face biometric registration after approval.
          </p>
          <Link to="/login" className="btn-primary justify-center">Back to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #03071e 0%, #0a0e27 50%, #162b85 100%)' }}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
              <ShieldCheck size={20} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Student Registration</h1>
          <p className="text-white/50 text-sm mt-1">Create your attendance system account</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 transition-colors
                ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-500 text-white' : 'bg-white/20 text-white/40'}`}>
                {i < step ? <CheckCircle size={14} /> : i + 1}
              </div>
              <div className={`flex-1 text-xs ml-2 font-medium hidden sm:block
                ${i === step ? 'text-white' : 'text-white/40'}`}>
                {label}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 mx-2 ${i < step ? 'bg-green-500' : 'bg-white/20'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }}>

            {/* ── Step 0: Personal Info ── */}
            {step === 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-surface-900 mb-4">Personal Information</h3>
                <div>
                  <label className="form-label">Full Name</label>
                  <input type="text" className={`form-input ${fieldErrors.name ? 'error' : ''}`}
                    value={form.name} onChange={e => update('name', e.target.value)}
                    placeholder="Enter your full name" />
                  {fieldErrors.name && <p className="form-error">{fieldErrors.name}</p>}
                </div>
                <div>
                  <label className="form-label">Email Address</label>
                  <input type="email" className={`form-input ${fieldErrors.email ? 'error' : ''}`}
                    value={form.email} onChange={e => update('email', e.target.value)}
                    placeholder="your@email.com" />
                  {fieldErrors.email && <p className="form-error">{fieldErrors.email}</p>}
                </div>
                <div>
                  <label className="form-label">Mobile Number</label>
                  <input type="tel" className={`form-input ${fieldErrors.mobile ? 'error' : ''}`}
                    value={form.mobile} onChange={e => update('mobile', e.target.value)}
                    placeholder="10-digit mobile number" maxLength={10} />
                  {fieldErrors.mobile && <p className="form-error">{fieldErrors.mobile}</p>}
                </div>
              </div>
            )}

            {/* ── Step 1: Academic Info ── */}
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-surface-900 mb-4">Academic Information</h3>

                {/* Student ID */}
                <div>
                  <label className="form-label">Student ID (SID)</label>
                  <input type="text" className={`form-input ${fieldErrors.student_id ? 'error' : ''}`}
                    value={form.student_id} onChange={e => update('student_id', e.target.value.toUpperCase())}
                    placeholder="e.g. 22CSE001" />
                  {fieldErrors.student_id && <p className="form-error">{fieldErrors.student_id}</p>}
                </div>

                {/* Department */}
                <div>
                  <label className="form-label">Department</label>
                  <select className={`form-input ${fieldErrors.department_id ? 'error' : ''}`}
                    value={form.department_id} onChange={e => update('department_id', e.target.value)}>
                    <option value="">— Select Department —</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                  {fieldErrors.department_id && <p className="form-error">{fieldErrors.department_id}</p>}
                </div>

                {/* Course Type */}
                {form.department_id && (
                  <div>
                    <label className="form-label">Course Type</label>
                    <select className={`form-input ${fieldErrors.course_type ? 'error' : ''}`}
                      value={form.course_type} onChange={e => update('course_type', e.target.value)}>
                      <option value="">— Select Course Type —</option>
                      {/* MBA dept only has PG, MCA only has PG */}
                      {!['MBA', 'MCA'].includes(selectedDeptCode) && <option value="UG">UG (Under Graduate)</option>}
                      <option value="PG">PG (Post Graduate)</option>
                    </select>
                    {fieldErrors.course_type && <p className="form-error">{fieldErrors.course_type}</p>}
                  </div>
                )}

                {/* Course / Branch */}
                {form.course_type && (
                  <div>
                    <label className="form-label">
                      {form.course_type === 'UG' ? 'UG Course' : 'PG Course'}
                    </label>
                    <select className={`form-input ${fieldErrors.branch ? 'error' : ''}`}
                      value={form.branch} onChange={e => update('branch', e.target.value)}>
                      <option value="">— Select Course —</option>
                      {availableCourses.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    {fieldErrors.branch && <p className="form-error">{fieldErrors.branch}</p>}
                  </div>
                )}

                {/* Year & Semester */}
                {form.branch && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Year</label>
                      <select className={`form-input ${fieldErrors.year ? 'error' : ''}`}
                        value={form.year} onChange={e => update('year', e.target.value)}>
                        <option value="">Select year</option>
                        {yearOptions.map(y => <option key={y} value={y}>Year {y}</option>)}
                      </select>
                      {fieldErrors.year && <p className="form-error">{fieldErrors.year}</p>}
                    </div>
                    <div>
                      <label className="form-label">Semester</label>
                      <select className={`form-input ${fieldErrors.semester ? 'error' : ''}`}
                        value={form.semester} onChange={e => update('semester', e.target.value)}>
                        <option value="">Select semester</option>
                        {semesterOptions.map(s => <option key={s} value={s}>Semester {s}</option>)}
                      </select>
                      {fieldErrors.semester && <p className="form-error">{fieldErrors.semester}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Password ── */}
            {step === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-surface-900 mb-4">Account Security</h3>
                <div>
                  <label className="form-label">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'}
                      className={`form-input pr-10 ${fieldErrors.password ? 'error' : ''}`}
                      value={form.password} onChange={e => update('password', e.target.value)}
                      placeholder="Minimum 8 characters" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password && <p className="form-error">{fieldErrors.password}</p>}
                  <p className="text-xs text-surface-400 mt-1">Must include uppercase, lowercase, and number</p>
                </div>
                <div>
                  <label className="form-label">Confirm Password</label>
                  <input type="password"
                    className={`form-input ${fieldErrors.confirm_password ? 'error' : ''}`}
                    value={form.confirm_password} onChange={e => update('confirm_password', e.target.value)}
                    placeholder="Re-enter password" />
                  {fieldErrors.confirm_password && <p className="form-error">{fieldErrors.confirm_password}</p>}
                </div>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-xs text-blue-700">
                    After registration, your account will be reviewed by the administrator.
                    You will be notified upon approval. Biometric face registration is required after account approval.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              {step > 0 ? (
                <button type="button" onClick={() => setStep(s => s - 1)} className="btn-secondary">
                  <ChevronLeft size={16} /> Back
                </button>
              ) : (
                <Link to="/login" className="btn-secondary">Back to Login</Link>
              )}

              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : step < 2 ? (
                  <> Continue <ChevronRight size={16} /> </>
                ) : (
                  'Submit Registration'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-white/40 text-xs mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
