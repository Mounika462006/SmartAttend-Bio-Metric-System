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

const DEGREE_PROGRAMS = [
  'B.E. (Bachelor of Engineering)',
  'B.Tech. (Bachelor of Technology)',
  'B.Sc. (Bachelor of Science)',
  'B.Com. (Bachelor of Commerce)',
  'B.B.A. (Bachelor of Business Administration)',
  'B.C.A. (Bachelor of Computer Applications)',
  'M.E. (Master of Engineering)',
  'M.Tech. (Master of Technology)',
  'M.Sc. (Master of Science)',
  'M.Com. (Master of Commerce)',
  'M.B.A. (Master of Business Administration)',
  'M.C.A. (Master of Computer Applications)',
  'Diploma',
  'Ph.D.'
];

const DEPT_CATEGORIES = {
  'engineering': 'Engineering & Technology',
  'science': 'Science',
  'arts': 'Arts & Humanities',
  'commerce': 'Commerce & Management',
  'medical': 'Medical & Health Sciences',
  'law': 'Law',
  'education': 'Education',
  'agriculture': 'Agriculture',
  'computer_applications': 'Computer Applications',
  'architecture': 'Architecture & Design',
  'vocational': 'Vocational Studies',
};

const DEPT_CODE_TO_CATEGORY_FALLBACK = {
  'CSE': 'engineering',
  'ECE': 'engineering',
  'MECH': 'engineering',
  'CIVIL': 'engineering',
  'EEE': 'engineering',
  'IT': 'engineering',
  'AIDS': 'engineering',
  'BT': 'engineering',
  'CHEM': 'engineering',
  'MBA': 'commerce',
  'MCA': 'computer_applications',
  'AI-DS': 'engineering',
  'CSE-AI': 'engineering',
  'CSE-CS': 'engineering',
  'ME': 'engineering',
  'CE': 'engineering',
  'BIOTECH-ENG': 'engineering',
  'BME': 'engineering',
  'MCT': 'engineering',
  'ROBOTICS': 'engineering',
  'AERO': 'engineering',
  'AUTO': 'engineering',
  'AGRI-ENG': 'engineering',
  'FOOD-TECH': 'engineering',
  'TEXTILE': 'engineering',
  'PROD': 'engineering',
  'IND-ENG': 'engineering',
  'PETRO': 'engineering',
  'MARINE': 'engineering',
  'MINING': 'engineering',
  'PHY': 'science',
  'CHEMISTRY': 'science',
  'MATH': 'science',
  'STATS': 'science',
  'CS': 'science',
  'DS': 'science',
  'BIOTECH-SCI': 'science',
  'MICRO': 'science',
  'EVS': 'science',
  'ZOOL': 'science',
  'BOTANY': 'science',
  'ENG': 'arts',
  'TAMIL': 'arts',
  'HIST': 'arts',
  'ECON': 'arts',
  'POL-SCI': 'arts',
  'SOC': 'arts',
  'PSYCH': 'arts',
  'PHIL': 'arts',
  'JMC': 'arts',
  'FA': 'arts',
  'BCOM': 'commerce',
  'BCOM-CA': 'commerce',
  'ACCT-FIN': 'commerce',
  'BANK-INS': 'commerce',
  'BBA': 'commerce',
  'BIZ-ANALYTICS': 'commerce',
  'HRM': 'commerce',
  'MKTG': 'commerce',
  'FINANCE': 'commerce',
  'MBBS': 'medical',
  'BDS': 'medical',
  'NURSING': 'medical',
  'BPHARM': 'medical',
  'PHARMD': 'medical',
  'BPT': 'medical',
  'BOT-MED': 'medical',
  'MPH': 'medical',
  'MLT': 'medical',
  'LLB': 'law',
  'INT-LAW': 'law',
  'LLM': 'law',
  'BED': 'education',
  'MED': 'education',
  'AGRICULTURE': 'agriculture',
  'HORTI': 'agriculture',
  'FORESTRY': 'agriculture',
  'AGRI-BIOTECH': 'agriculture',
  'AGRI-ENG-AG': 'agriculture',
  'BCA': 'computer_applications',
  'BARCH': 'architecture',
  'ID-ARCH': 'architecture',
  'FD-ARCH': 'architecture',
  'GD-ARCH': 'architecture',
  'IND-DES': 'architecture',
  'HM': 'vocational',
  'CATERING': 'vocational',
  'TOURISM': 'vocational',
  'AVIATION': 'vocational',
  'EVENT': 'vocational'
};

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
    dept_category: '', department_id: '', branch: '',
    year: '', semester: '',
    password: '', confirm_password: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptError, setDeptError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const fetchDepts = async (attemptsLeft = 3, delay = 1000) => {
      if (!active) return;
      setDeptLoading(true);
      setDeptError(null);
      try {
        const { data } = await generalAPI.getDepartments({ signal: controller.signal });
        if (active) {
          setDepartments(data.data || []);
          setDeptLoading(false);
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') {
          return;
        }
        console.error(`Failed to load departments (attempts left: ${attemptsLeft}):`, err);
        if (attemptsLeft > 0 && active) {
          setTimeout(() => {
            fetchDepts(attemptsLeft - 1, delay * 2);
          }, delay);
        } else if (active) {
          setDeptError('Failed to load departments. Please check server connection.');
          setDeptLoading(false);
        }
      }
    };

    fetchDepts();

    return () => {
      active = false;
      controller.abort();
    };
  }, [retryCount]);

  const selectedDept     = departments.find(d => String(d.id) === String(form.department_id));
  const selectedDeptCode = selectedDept ? selectedDept.code : '';
  const filteredDepts    = form.dept_category
    ? departments.filter(d => (d.category || DEPT_CODE_TO_CATEGORY_FALLBACK[d.code]) === form.dept_category)
    : [];

  const isPG = form.branch && (form.branch.startsWith('M.') || form.branch.startsWith('Ph.D.'));

  // Semester options: UG/PG
  const semesterOptions = isPG
    ? [1, 2, 3, 4]
    : [1, 2, 3, 4, 5, 6, 7, 8];

  // Year options: UG/PG
  const yearOptions = isPG
    ? [1, 2]
    : [1, 2, 3, 4];

  const update = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'dept_category') {
        next.department_id = '';
        next.branch        = '';
        next.year          = '';
        next.semester      = '';
      }
      if (field === 'department_id') {
        next.branch      = '';
        next.year        = '';
        next.semester    = '';
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
      if (!form.dept_category)     errors.dept_category = 'Please select a department category.';
      if (!form.department_id)   errors.department_id = 'Please select a department.';
      if (!form.branch)          errors.branch        = 'Please select Degree Program.';
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
      delete payload.dept_category;
      delete payload.course_type; // not a DB field — branch already captures the course name
      // department_id is a UUID string — do NOT parseInt it
      payload.year          = parseInt(payload.year) || undefined;
      payload.semester      = parseInt(payload.semester);
      // Map mobile -> phone_number for new Supabase schema compatibility
      payload.phone_number  = payload.mobile || '';
      // Provide defaults for new schema required fields
      payload.register_number  = payload.student_id; // Use student_id as register_number if not separately entered
      payload.gender           = payload.gender || 'other';
      payload.academic_year    = payload.academic_year || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
      payload.section          = payload.section || 'A';
      payload.batch            = payload.batch || String(new Date().getFullYear());
      payload.admission_year   = parseInt(payload.admission_year) || new Date().getFullYear();
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

                {/* Department Category & Department loading/error gates */}
                {deptLoading && (
                  <div className="flex items-center space-x-2 py-3 text-gray-400 text-sm">
                    <svg className="animate-spin h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Loading departments...</span>
                  </div>
                )}

                {deptError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400 space-y-2">
                    <p>{deptError}</p>
                    <button type="button" onClick={() => setRetryCount(prev => prev + 1)} className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs transition duration-200">
                      Retry Loading
                    </button>
                  </div>
                )}

                {!deptLoading && !deptError && (
                  <>
                    {/* Department Category */}
                    <div>
                      <label className="form-label">Department Category</label>
                      <select className={`form-input ${fieldErrors.dept_category ? 'error' : ''}`}
                        value={form.dept_category} onChange={e => update('dept_category', e.target.value)}>
                        <option value="">— Select Category —</option>
                        {Object.entries(DEPT_CATEGORIES).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                      {fieldErrors.dept_category && <p className="form-error">{fieldErrors.dept_category}</p>}
                    </div>

                    {/* Department */}
                    {form.dept_category && (
                      <div>
                        <label className="form-label">Department</label>
                        <select className={`form-input ${fieldErrors.department_id ? 'error' : ''}`}
                          value={form.department_id} onChange={e => update('department_id', e.target.value)}>
                          <option value="">— Select Department —</option>
                          {filteredDepts.map(dept => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                          ))}
                        </select>
                        {fieldErrors.department_id && <p className="form-error">{fieldErrors.department_id}</p>}
                      </div>
                    )}
                  </>
                )}

                {/* Degree Program */}
                {form.department_id && (
                  <div>
                    <label className="form-label">Degree Program</label>
                    <select className={`form-input ${fieldErrors.branch ? 'error' : ''}`}
                      value={form.branch} onChange={e => update('branch', e.target.value)}>
                      <option value="">Select Degree Program</option>
                      {DEGREE_PROGRAMS.map(prog => (
                        <option key={prog} value={prog}>{prog}</option>
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
