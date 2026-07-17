import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const ACADEMIC_EMAIL_PATTERN = /\.(edu|edu\.in|edu\.com)$/i;

function getApiErrorMessage(err, fallback) {
  const data = err.response?.data;
  const firstFieldError = Array.isArray(data?.errors) ? data.errors[0]?.message : '';
  return firstFieldError || data?.message ||
    (!err.response || typeof data !== 'object' || err.code === 'ERR_NETWORK'
      ? 'Cannot connect to server. Please ensure the backend server is running.'
      : fallback);
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roleConfig = [
    { value: 'student', label: 'Student' },
    { value: 'staff', label: 'Faculty' },
    { value: 'admin', label: 'Admin' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if ((role === 'student' || role === 'staff') && !ACADEMIC_EMAIL_PATTERN.test(email.trim())) {
      setError('Student and faculty email must end with .edu, .edu.in, or .edu.com.');
      return;
    }

    setLoading(true);
    try {
      const user = await login(email, password, role);
      toast.success(`Welcome back, ${user.name}!`);
      const redirectMap = {
        student: '/student/dashboard',
        staff: '/staff/dashboard',
        admin: '/admin/dashboard',
      };
      navigate(redirectMap[role]);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Login failed. Please try again.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #03071e 0%, #0a0e27 50%, #162b85 100%)' }}>
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 text-white">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
            <ShieldCheck size={24} className="text-white" />
          </div>
          <div>
            <div className="text-xl font-bold">SmartAttend</div>
            <div className="text-sm text-white/50">Biometric Attendance ERP</div>
          </div>
        </div>

        <h1 className="text-4xl font-bold leading-tight mb-4">
          Smart Face<br />
          <span className="text-blue-400">Biometric</span><br />
          Attendance System
        </h1>
        <p className="text-white/60 text-lg mb-10 leading-relaxed">
          Enterprise-grade attendance management with facial recognition,
          GPS geo-fencing, and real-time analytics for modern institutions.
        </p>

        <div className="grid grid-cols-3 gap-6">
          {[
            { value: '99.9%', label: 'Face Accuracy' },
            { value: 'GPS', label: 'Geo-Fencing' },
            { value: 'Real-Time', label: 'Analytics' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-blue-400">{stat.value}</div>
              <div className="text-sm text-white/40 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {/* Mobile logo */}
            <div className="flex items-center gap-2 mb-6 lg:hidden">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <ShieldCheck size={16} className="text-white" />
              </div>
              <span className="font-bold text-surface-900">SmartAttend</span>
            </div>

            <h2 className="text-2xl font-bold text-surface-900 mb-1">Sign in</h2>
            <p className="text-surface-500 text-sm mb-6">Access your attendance portal</p>

            {/* Role Selector */}
            <div className="flex gap-1 p-1 bg-surface-100 rounded-lg mb-6">
              {roleConfig.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    role === r.value
                      ? 'bg-white text-surface-900 shadow-sm'
                      : 'text-surface-500 hover:text-surface-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="form-label">Email Address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="form-label">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input pr-10"
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5 mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    Sign In as {roleConfig.find(r => r.value === role)?.label}
                  </>
                )}
              </button>
            </form>

            {role === 'student' && (
              <p className="text-center text-sm text-surface-500 mt-5">
                Don't have an account?{' '}
                <Link to="/register" className="text-blue-600 font-medium hover:underline">
                  Register here
                </Link>
              </p>
            )}

            <div className="mt-6 pt-5 border-t border-surface-100">
              <p className="text-xs text-surface-400 text-center">
                Secured by JWT authentication and end-to-end encryption
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
