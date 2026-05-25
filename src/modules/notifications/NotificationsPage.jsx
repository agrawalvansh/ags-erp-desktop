import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Trash2, CheckCheck, ExternalLink, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await window.api.invoke('notifications:getAll');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Broadcast updated unread count to NavBar
  const broadcastCount = useCallback(async () => {
    try {
      const data = await window.api.invoke('notifications:getUnreadCount');
      // Dispatch a custom event so NavBar can pick it up without a full context provider
      window.dispatchEvent(new CustomEvent('notifications:localUpdate', { detail: data.count }));
    } catch (_) { /* silent */ }
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await window.api.invoke('notifications:markRead', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      broadcastCount();
    } catch (_) { toast.error('Failed to mark as read'); }
  };

  const handleMarkAllRead = async () => {
    try {
      await window.api.invoke('notifications:markAllRead');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      broadcastCount();
      toast.success('All notifications marked as read');
    } catch (_) { toast.error('Failed to mark all as read'); }
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    try {
      await window.api.invoke('notifications:delete', id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      broadcastCount();
    } catch (_) { toast.error('Failed to delete notification'); }
  };

  const handleDeleteAll = async () => {
    try {
      await window.api.invoke('notifications:deleteAll');
      setNotifications([]);
      broadcastCount();
      toast.success('All notifications deleted');
    } catch (_) { toast.error('Failed to delete all'); }
  };

  const handleOpenAccount = async (notif) => {
    // Mark as read on click
    if (!notif.is_read) {
      await window.api.invoke('notifications:markRead', notif.id);
      broadcastCount();
    }
    const basePath = notif.type === 'customer'
      ? '/accounts/customers'
      : '/accounts/suppliers';
    navigate(`${basePath}/${notif.account_id}`);
  };

  // Relative time helper
  const timeAgo = (isoStr) => {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(isoStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F9FB]">
      {/* Page Header */}
      <div className="px-4 md:px-8 pt-8 pb-2">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#191C1E] mb-1">Notifications</h1>
              <p className="text-[#434655] text-sm font-medium">
                Pending invoice payment reminders
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5">
                    {unreadCount} unread
                  </span>
                )}
              </p>
            </div>
            {notifications.length > 0 && (
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="cursor-pointer flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#E6E8EA] text-[#191C1E] font-semibold text-xs hover:bg-[#E0E3E5] transition-all active:scale-95"
                  >
                    <CheckCheck size={14} />
                    Mark All Read
                  </button>
                )}
                <button
                  onClick={handleDeleteAll}
                  className="cursor-pointer flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-50 text-red-600 font-semibold text-xs border border-red-200 hover:bg-red-100 transition-all active:scale-95"
                >
                  <Trash2 size={14} />
                  Delete All
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <main className="flex-1 px-4 md:px-8 pb-12">
        <div className="max-w-4xl mx-auto space-y-2">
          {isLoading ? (
            <div className="bg-white rounded-xl shadow-sm border border-[#C3C6D7]/10 px-8 py-16 text-center">
              <p className="text-sm text-[#64748B]">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-[#C3C6D7]/10 px-8 py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#F2F4F6] flex items-center justify-center mx-auto mb-4">
                <Bell size={28} className="text-[#94A3B8]" />
              </div>
              <h3 className="text-lg font-bold text-[#191C1E] mb-1">No notifications</h3>
              <p className="text-sm text-[#64748B] max-w-sm mx-auto">
                When invoices become overdue based on your reminder settings, they'll appear here.
              </p>
            </div>
          ) : (
            notifications.map(notif => (
              <div
                key={notif.id}
                onClick={() => handleOpenAccount(notif)}
                className={`group relative bg-white rounded-xl shadow-sm border transition-all duration-150 cursor-pointer hover:shadow-md hover:border-[#C3C6D7]/30 ${
                  notif.is_read
                    ? 'border-[#C3C6D7]/10'
                    : 'border-[#2563EB]/20 bg-[#FAFBFF]'
                }`}
              >
                <div className="flex items-start gap-4 px-6 py-5">
                  {/* Unread indicator */}
                  <div className="flex-shrink-0 pt-1.5">
                    {!notif.is_read ? (
                      <span className="block w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                    ) : (
                      <span className="block w-2.5 h-2.5 rounded-full bg-transparent" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {/* Invoice badge */}
                      {notif.invoice_no && (
                        <span className="bg-[#E6E8EA] px-2 py-0.5 rounded text-[10px] font-bold text-[#004AC6]">
                          {notif.invoice_no}
                        </span>
                      )}
                      {/* Type badge */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        notif.type === 'customer'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {notif.type === 'customer' ? 'Customer' : 'Supplier'}
                      </span>
                      {/* Date */}
                      {notif.invoice_date && (
                        <span className="text-[10px] text-[#94A3B8] font-medium">
                          Invoice: {new Date(notif.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>

                    {/* Account name */}
                    <p className="text-sm font-semibold text-[#0F172A] mb-0.5">
                      {notif.account_name}
                    </p>

                    {/* Message */}
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      {notif.message}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-[#94A3B8] font-medium">
                        {timeAgo(notif.created_at)}
                      </span>
                      <span className="text-sm font-black text-[#191C1E]">
                        ₹{Math.round(notif.pending_amount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenAccount(notif); }}
                      className="cursor-pointer p-2 rounded-full hover:bg-[#F2F4F6] text-[#434655] hover:text-[#004AC6] transition-all"
                      title="Open account"
                    >
                      <ExternalLink size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(notif.id, e)}
                      className="cursor-pointer p-2 rounded-full hover:bg-[#F2F4F6] text-[#434655] hover:text-[#DC2626] transition-all"
                      title="Delete"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default NotificationsPage;
