import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../../../context/AuthContext';
import {
  getAllNotifications,
  markAllAsRead,
  markOneAsRead,
} from '../../../services/notificationService';

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
};

const getNotifDestination = (notif) => {
  if (notif.candidate_id) return `/candidates/${notif.candidate_id}`;
  if (notif.job_id) return `/jobs/${notif.job_id}`;
  return '/dashboard';
};

const getNotifIcon = (type) => {
  const icons = {
    email_sent: {
      color: '#22C55E',
      path: 'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4.7-8 5.334L4 8.7V6.297l8 5.333 8-5.333V8.7Z'
    },
    candidate_passed: {
      color: '#22C55E',
      path: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1 14.414-3.707-3.707 1.414-1.414L11 13.586l5.293-5.293 1.414 1.414Z'
    },
    email_failed: {
      color: '#EF4444',
      path: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z'
    },
    candidate_failed: {
      color: '#6B7280',
      path: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z'
    },
    assessment_complete: {
      color: '#5B6DF6',
      path: 'M9 6V5a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v1h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3Zm2 0h2V5a1 1 0 0 0-2 0v1Zm-5 5h12V8H6v3Zm0 2v5h12v-5H6Z'
    },
    link_limit_reached: {
      color: '#F97316',
      path: 'M13 2h-2v9.586l-3.293-3.293-1.414 1.414L12 15.414l5.707-5.707-1.414-1.414L13 11.586V2Zm-8 16h14v2H5v-2Z'
    },
  };

  const fallback = {
    color: '#6B7280',
    path: 'M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.71V3a2 2 0 0 0-4 0v1.29A7 7 0 0 0 5 11v5l-1.3 1.3A1 1 0 0 0 4.4 19h15.2a1 1 0 0 0 .7-1.7L19 16Z'
  };

  const icon = icons[type] || fallback;

  return (
    <svg
      className="h-5 w-5 shrink-0 mt-0.5"
      viewBox="0 0 24 24"
      fill={icon.color}
      aria-hidden="true"
    >
      <path d={icon.path} />
    </svg>
  );
};

const NotificationsPage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAllNotifs = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error: notifError } = await getAllNotifications(user.id);
    if (notifError) {
      setError('Failed to load notifications.');
      setNotifications([]);
    } else {
      setNotifications(data || []);
      setError(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAllNotifs();
  }, [user?.id]);

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    const { error: markError } = await markAllAsRead(user.id);
    if (!markError) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      window.dispatchEvent(new CustomEvent('notifications-marked-read', { detail: { all: true } }));
    }
  };

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) {
      const { error: markError } = await markOneAsRead(notif.id);
      if (!markError) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        window.dispatchEvent(new CustomEvent('notifications-marked-read', { detail: { type: notif.type } }));
      }
    }
    navigate(getNotifDestination(notif));
  };

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-text-primary text-2xl font-semibold">Notifications</h1>
          <p className="text-text-secondary text-sm mt-1">Your recent activity and alerts.</p>
        </div>
        {!loading && !error && hasUnread && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            className="self-start sm:self-center text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        // 5 skeleton rows
        <div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse bg-tertiary rounded-xl h-20 w-full mb-2" />
          ))}
        </div>
      ) : error ? (
        // Error state
        <div className="flex flex-col items-center justify-center py-12 border border-border-default bg-secondary rounded-xl text-center px-4">
          <p className="text-text-secondary text-sm mb-4">{error}</p>
          <button
            type="button"
            onClick={fetchAllNotifs}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Retry
          </button>
        </div>
      ) : notifications.length === 0 ? (
        // Empty state
        <div className="flex flex-col items-center justify-center py-16 border border-border-default bg-secondary rounded-xl text-center px-4">
          <svg className="h-10 w-10 text-text-tertiary mb-3 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.71V3a2 2 0 0 0-4 0v1.29A7 7 0 0 0 5 11v5l-1.3 1.3A1 1 0 0 0 4.4 19h15.2a1 1 0 0 0 .7-1.7L19 16Z" />
          </svg>
          <h2 className="text-text-primary font-semibold text-base">You're all caught up</h2>
          <p className="text-text-secondary text-sm mt-1">
            New notifications will appear here when candidates complete assessments.
          </p>
        </div>
      ) : (
        // Notifications List
        <div>
          {notifications.map((notif) => {
            const isUnread = !notif.is_read;
            return (
              <div
                key={notif.id}
                onClick={() => handleNotifClick(notif)}
                className={`flex items-start gap-3 px-5 py-4 mb-2 rounded-xl border cursor-pointer hover:bg-tertiary transition-colors ${
                  isUnread
                    ? 'border-accent/30 bg-accent-soft'
                    : 'border-border-default bg-secondary'
                }`}
              >
                <div className="relative shrink-0">
                  {getNotifIcon(notif.type)}
                  {isUnread && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-text-primary text-sm font-medium">{notif.title}</h3>
                  <p className="text-text-secondary text-sm mt-0.5">{notif.message}</p>
                  <p className="text-text-tertiary text-xs mt-1">{timeAgo(notif.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
