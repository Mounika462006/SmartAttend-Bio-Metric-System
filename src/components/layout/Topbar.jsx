import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, ChevronDown, User, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { generalAPI } from '../../api/services';

export default function Topbar({ collapsed, setCollapsed }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    generalAPI.getNotifications()
      .then(({ data }) => setUnreadCount(data.data?.unread_count || 0))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleBadge = {
    student: { label: 'Student', cls: 'bg-blue-100 text-blue-700' },
    staff: { label: 'Faculty', cls: 'bg-violet-100 text-violet-700' },
    admin: { label: 'Admin', cls: 'bg-amber-100 text-amber-700' },
  }[role] || { label: role, cls: 'bg-gray-100 text-gray-700' };

  return (
    <header className="h-16 bg-white border-b border-surface-200 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 sticky top-0 z-10">
      {/* Left: Menu toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-2 rounded-lg hover:bg-surface-100 transition-colors text-surface-600"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          onClick={() => navigate(`/${role}/notifications`)}
          className="relative p-2 rounded-lg hover:bg-surface-100 transition-colors text-surface-600"
          aria-label="Notifications"
        >
          <Bell size={19} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-surface-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <User size={14} className="text-white" />
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-surface-800 leading-tight">{user?.name}</div>
              <div className="text-xs text-surface-500 leading-tight">{user?.student_id || user?.staff_id || 'Administrator'}</div>
            </div>
            <span className={`hidden sm:inline badge ${roleBadge.cls} ml-1`}>{roleBadge.label}</span>
            <ChevronDown size={14} className="text-surface-400" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-surface-200 rounded-lg shadow-lg z-20 py-1">
                <div className="px-3 py-2 border-b border-surface-100">
                  <div className="text-xs font-medium text-surface-500">Signed in as</div>
                  <div className="text-sm text-surface-800 truncate">{user?.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
