import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, CalendarCheck, ClipboardList, FileText,
  Bell, LogOut, Menu, X, ChevronRight, User,
  ShieldCheck, UserCog, Building2, MapPin, Clock,
  CalendarDays, BarChart3, Users, Settings, FileSearch,
  CheckSquare, AlertTriangle
} from 'lucide-react';

const studentNav = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/student/dashboard' },
  { label: 'Mark Attendance', icon: CalendarCheck, to: '/student/attendance' },
  { label: 'Attendance History', icon: ClipboardList, to: '/student/history' },
  { label: 'Leave Application', icon: FileText, to: '/student/leave' },
  { label: 'Biometric Setup', icon: ShieldCheck, to: '/student/biometric' },
  { label: 'Notifications', icon: Bell, to: '/student/notifications' },
];

const staffNav = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/staff/dashboard' },
  { label: 'Attendance Monitor', icon: CalendarCheck, to: '/staff/attendance' },
  { label: 'Leave Approvals', icon: CheckSquare, to: '/staff/leaves' },
  { label: 'Reports', icon: BarChart3, to: '/staff/reports' },
  { label: 'Notifications', icon: Bell, to: '/staff/notifications' },
];

const adminNav = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/admin/dashboard' },
  { label: 'Student Approvals', icon: Users, to: '/admin/students' },
  { label: 'Staff Management', icon: UserCog, to: '/admin/staff' },
  { label: 'Attendance Monitor', icon: CalendarCheck, to: '/admin/attendance' },
  { label: 'Leave Management', icon: FileText, to: '/admin/leaves' },
  { label: 'Holiday Management', icon: CalendarDays, to: '/admin/holidays' },
  { label: 'Geo-Fencing', icon: MapPin, to: '/admin/geo-fencing' },
  { label: 'Attendance Settings', icon: Clock, to: '/admin/settings' },
  { label: 'Analytics', icon: BarChart3, to: '/admin/analytics' },
  { label: 'Security Logs', icon: FileSearch, to: '/admin/security-logs' },
];

const navMap = {
  student: studentNav,
  staff: staffNav,
  admin: adminNav,
};

const roleLabels = {
  student: 'Student Portal',
  staff: 'Faculty Portal',
  admin: 'Admin Panel',
};

export default function Sidebar({ collapsed, setCollapsed }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = navMap[role] || [];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-30 bg-navy-900 flex flex-col
          sidebar-transition
          ${collapsed ? '-translate-x-full lg:translate-x-0 lg:w-16' : 'translate-x-0 w-64'}
        `}
        style={{ backgroundColor: '#0a0e27' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 flex-shrink-0">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-white flex-shrink-0" />
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-white font-bold text-sm leading-tight truncate">SmartAttend</div>
              <div className="text-white/40 text-xs truncate">{roleLabels[role]}</div>
            </div>
          )}
        </div>

        {/* User Info */}
        {!collapsed && (
          <div className="px-4 py-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-white" />
              </div>
              <div className="overflow-hidden">
                <div className="text-white text-sm font-medium truncate">{user?.name}</div>
                <div className="text-white/40 text-xs truncate">{user?.email}</div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-colors text-sm
                ${isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon size={17} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-2 pb-4 pt-2 border-t border-white/10 flex-shrink-0">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-sm text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={17} className="flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
