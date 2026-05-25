import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Protects routes based on authentication and role
 * @param {string[]} roles - Allowed roles for this route
 */
export default function ProtectedRoute({ children, roles = [] }) {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-surface-500">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles.length > 0 && !roles.includes(role)) {
    // Redirect to role-specific dashboard
    const dashboardMap = {
      student: '/student/dashboard',
      staff: '/staff/dashboard',
      admin: '/admin/dashboard',
    };
    return <Navigate to={dashboardMap[role] || '/login'} replace />;
  }

  return children;
}
