import { useState, useEffect } from 'react';
import { generalAPI } from '../../api/services';
import { Bell, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const TYPE_ICON = {
  success: { cls: 'bg-green-50 text-green-600', dot: 'bg-green-500' },
  danger: { cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  warning: { cls: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  info: { cls: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await generalAPI.getNotifications();
      setNotifications(data.data?.notifications || []);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await generalAPI.markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      toast.success('All notifications marked as read.');
    } catch {
      toast.error('Failed to mark notifications as read.');
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary text-sm">
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 animate-pulse space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <Bell className="empty-state-icon" />
            <p className="empty-state-title">No notifications</p>
            <p className="empty-state-desc">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {notifications.map(n => {
              const typeStyle = TYPE_ICON[n.type] || TYPE_ICON.info;
              return (
                <div key={n.id} className={`flex gap-3 px-4 py-4 ${!n.is_read ? 'bg-blue-50/30' : ''}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${!n.is_read ? typeStyle.dot : 'bg-transparent'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${!n.is_read ? 'text-surface-900' : 'text-surface-700'}`}>
                        {n.title}
                      </p>
                      <span className="text-xs text-surface-400 flex-shrink-0">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-surface-500 mt-0.5">{n.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
