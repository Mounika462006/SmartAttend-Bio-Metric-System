import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import PublicRoute from './routes/PublicRoute';
import DashboardLayout from './layouts/DashboardLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import MarkAttendance from './pages/student/MarkAttendance';
import AttendanceHistory from './pages/student/AttendanceHistory';
import LeaveManagement from './pages/student/LeaveManagement';
import BiometricRegister from './pages/student/BiometricRegister';
import Notifications from './pages/student/Notifications';

// Staff Pages
import StaffDashboard from './pages/staff/StaffDashboard';
import StaffReports from './pages/staff/StaffReports';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentApprovals from './pages/admin/StudentApprovals';
import StaffManagement from './pages/admin/StaffManagement';
import GeoFencingSettings from './pages/admin/GeoFencingSettings';
import HolidayManagement from './pages/admin/HolidayManagement';
import LeaveApprovals from './pages/admin/LeaveApprovals';
import AttendanceMonitor from './pages/admin/AttendanceMonitor';
import AttendanceSettings from './pages/admin/AttendanceSettings';
import SecurityLogs from './pages/admin/SecurityLogs';
import AdminAnalytics from './pages/admin/AdminAnalytics';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* ─── Student routes ─── */}
        <Route
          path="/student"
          element={
            <ProtectedRoute roles={['student']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="attendance" element={<MarkAttendance />} />
          <Route path="history" element={<AttendanceHistory />} />
          <Route path="leave" element={<LeaveManagement />} />
          <Route path="biometric" element={<BiometricRegister />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        {/* ─── Staff routes ─── */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute roles={['staff']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<StaffDashboard />} />
          <Route path="attendance" element={<AttendanceMonitor />} />
          <Route path="leaves" element={<LeaveApprovals />} />
          <Route path="reports" element={<StaffReports />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        {/* ─── Admin routes ─── */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="students" element={<StudentApprovals />} />
          <Route path="staff" element={<StaffManagement />} />
          <Route path="attendance" element={<AttendanceMonitor />} />
          <Route path="leaves" element={<LeaveApprovals />} />
          <Route path="holidays" element={<HolidayManagement />} />
          <Route path="geo-fencing" element={<GeoFencingSettings />} />
          <Route path="settings" element={<AttendanceSettings />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="security-logs" element={<SecurityLogs />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
