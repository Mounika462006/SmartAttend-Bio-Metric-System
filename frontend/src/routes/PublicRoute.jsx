import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Redirects authenticated users away from public pages (like login/register) to their dashboard.
 */
export default function PublicRoute({ children }) {
  const { isAuthenticated, role, loading } = useAuth();

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

  if (isAuthenticated && role) {
    const dashboardMap = {
      student: '/student/dashboard',
      staff: '/staff/dashboard',
      admin: '/admin/dashboard',
    };
    return <Navigate to={dashboardMap[role]} replace />;
  }

  return children;
}
