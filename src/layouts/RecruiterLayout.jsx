import { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import { supabase } from "../config/supabase";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import SkeletonCard from "../components/ui/SkeletonCard";
import { getRecentNotifications, markAllAsRead, markOneAsRead } from '../services/notificationService';

const navItems = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: (
      <path
        d="M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z"
        fill="currentColor"
      />
    ),
  },
  {
    label: "All Jobs",
    path: "/jobs",
    icon: (
      <path
        d="M9 6V5a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v1h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3Zm2 0h2V5a1 1 0 0 0-2 0v1Zm-5 5h12V8H6v3Zm0 2v5h12v-5H6Z"
        fill="currentColor"
      />
    ),
  },
  {
    label: "Analytics",
    path: "/analytics",
    icon: (
      <path
        d="M5 19V9h3v10H5Zm5 0V5h3v14h-3Zm5 0v-7h3v7h-3ZM4 21h16a1 1 0 1 0 0-2H4a1 1 0 1 0 0 2Z"
        fill="currentColor"
      />
    ),
  },
  {
    label: "Notifications",
    path: "/notifications",
    icon: (
      <path
        d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.71V3a2 2 0 0 0-4 0v1.29A7 7 0 0 0 5 11v5l-1.3 1.3A1 1 0 0 0 4.4 19h15.2a1 1 0 0 0 .7-1.7L19 16Zm-2 .59.41.41H6.59L7 16.59V11a5 5 0 0 1 10 0v5.59Z"
        fill="currentColor"
      />
    ),
  },
  {
    label: "Billing",
    path: "/billing",
    icon: (
      <path
        d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm2 2h12V6H6v2Zm0 3v7h12v-7H6Zm2 4h4a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2Z"
        fill="currentColor"
      />
    ),
  },
  {
    label: "Settings",
    path: "/settings",
    icon: (
      <path
        d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.3 7.3 0 0 0-1.69-.98L14.5 2.42A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.5.42L9.13 5.07c-.6.23-1.16.56-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.02.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.13.22.39.31.61.22l2.49-1c.52.4 1.09.73 1.69.98l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.6-.23 1.16-.56 1.69-.98l2.49 1c.23.08.48 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
        fill="currentColor"
      />
    ),
  },
];

const getInitials = (name = "") => {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return initials.toUpperCase() || "SG";
};

const getPageTitle = (pathname) => {
  const currentItem = navItems
    .slice()
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));

  return currentItem?.label || "Recruiter";
};

const RecruiterAvatar = ({ name, className = "" }) => (
  <div
    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent ${className}`.trim()}
    aria-hidden="true"
  >
    {getInitials(name)}
  </div>
);

const NavIcon = ({ children }) => (
  <svg
    className="h-5 w-5 shrink-0"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const Sidebar = ({
  companyName,
  fullName,
  location,
  navigate,
  onNavigate,
  unreadCount,
}) => (
  <aside className="flex h-full w-60 flex-col border-r border-border-default bg-secondary">
    <div className="px-5 pb-4 pt-5">
      <button
        type="button"
        onClick={() => {
          navigate("/dashboard");
          onNavigate?.();
        }}
        className="font-sans text-xl font-semibold text-text-primary"
      >
        SkillGate
      </button>

      <button
        type="button"
        onClick={() => {
          navigate("/jobs/create");
          onNavigate?.();
        }}
        className="mt-6 w-full rounded bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        Post a Job
      </button>
    </div>

    <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Recruiter navigation">
      {navItems.map((item) => {
        const isActive =
          location.pathname === item.path ||
          location.pathname.startsWith(`${item.path}/`);

        return (
          <button
            key={item.path}
            type="button"
            onClick={() => {
              navigate(item.path);
              onNavigate?.();
            }}
            className={`flex w-full items-center gap-3 rounded-r px-3 py-2.5 text-left text-sm font-medium transition-colors ${
              isActive
                ? "border-l-[3px] border-accent bg-accent-soft pl-2.25 text-text-primary"
                : "border-l-[3px] border-transparent text-text-secondary hover:text-text-primary"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <NavIcon>{item.icon}</NavIcon>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.label === "Notifications" && unreadCount > 0 && (
              <span className="min-w-5 rounded-full bg-error px-1.5 py-0.5 text-center text-xs font-semibold leading-none text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>

    <div className="border-t border-border-default p-4">
      <div className="flex min-w-0 items-center gap-3">
        <RecruiterAvatar name={fullName} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{fullName}</p>
          <p className="truncate text-xs text-text-secondary">{companyName}</p>
        </div>
      </div>
    </div>
  </aside>
);

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

const RecruiterLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useContext(AuthContext);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [quotaUsage, setQuotaUsage] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [dismissedQuotaKeys, setDismissedQuotaKeys] = useState(() => new Set());
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const fullName =
    profile?.full_name || user?.user_metadata?.name || user?.email || "Recruiter";
  const companyName = profile?.company_name || "SkillGate";
  const pageTitle = getPageTitle(location.pathname);
  const quotaStorageKey = user?.id
    ? `skillgate-quota-warning-dismissed:${user.id}`
    : "skillgate-quota-warning-dismissed";

  useEffect(() => {
    const closeTimer = window.setTimeout(() => setSidebarOpen(false), 0);

    return () => window.clearTimeout(closeTimer);
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    let isMounted = true;

    const fetchLayoutData = async () => {
      setQuotaLoading(true);

      const [quotaResult, notificationResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("assessments_used, assessments_limit")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("recruiter_id", user.id)
          .eq("is_read", false),
      ]);

      if (!isMounted) return;

      if (quotaResult.error) {
        console.error("Quota fetch error:", quotaResult.error);
        setQuotaUsage(null);
      } else {
        setQuotaUsage(quotaResult.data || null);
      }

      if (notificationResult.error) {
        console.error("Unread notification fetch error:", notificationResult.error);
        setUnreadCount(0);
      } else {
        setUnreadCount(notificationResult.count || 0);
      }

      setQuotaLoading(false);
    };

    fetchLayoutData();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const quotaPercent = useMemo(() => {
    const usage = user?.id ? quotaUsage : null;
    const used = Number(usage?.assessments_used || 0);
    const limit = Number(usage?.assessments_limit || 0);

    if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) {
      return 0;
    }

    return Math.round((used / limit) * 100);
  }, [quotaUsage, user?.id]);

  const quotaDismissed =
    dismissedQuotaKeys.has(quotaStorageKey) ||
    sessionStorage.getItem(quotaStorageKey) === "true";
  const effectiveUnreadCount = user?.id ? unreadCount : 0;
  const showQuotaBanner = quotaPercent >= 80 && !quotaDismissed;

  const dismissQuotaBanner = () => {
    sessionStorage.setItem(quotaStorageKey, "true");
    setDismissedQuotaKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);
      nextKeys.add(quotaStorageKey);
      return nextKeys;
    });
  };

  const fetchNotifications = async () => {
    if (!user?.id) return;
    setNotifLoading(true);
    const { data } = await getRecentNotifications(user.id);
    setNotifications(data || []);
    setNotifLoading(false);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) {
      await markOneAsRead(notif.id);
      setNotifications(prev =>
        prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setNotificationOpen(false);
    navigate(getNotifDestination(notif));
  };

  useEffect(() => {
    if (!notificationOpen) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-notification-panel]')) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notificationOpen]);

  const sidebarProps = {
    companyName,
    fullName,
    location,
    navigate,
    unreadCount: effectiveUnreadCount,
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary text-text-primary">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary text-text-primary">
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">
        <Sidebar {...sidebarProps} />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-primary/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          />
          <div className="relative h-full w-60">
            <Sidebar {...sidebarProps} onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-screen flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border-default bg-secondary px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded text-text-secondary transition-colors hover:bg-accent-soft hover:text-text-primary lg:hidden"
              aria-label="Open navigation"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>
            </button>

            <h1 className="truncate text-base font-semibold text-text-primary">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" data-notification-panel>
              <button
                type="button"
                onClick={() => {
                  const next = !notificationOpen;
                  setNotificationOpen(next);
                  if (next) fetchNotifications();
                }}
                className="relative flex h-10 w-10 items-center justify-center rounded text-text-secondary transition-colors hover:bg-accent-soft hover:text-text-primary"
                aria-label="Toggle notifications"
                aria-expanded={notificationOpen}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.71V3a2 2 0 0 0-4 0v1.29A7 7 0 0 0 5 11v5l-1.3 1.3A1 1 0 0 0 4.4 19h15.2a1 1 0 0 0 .7-1.7L19 16Zm-2 .59.41.41H6.59L7 16.59V11a5 5 0 0 1 10 0v5.59Z"
                    fill="currentColor"
                  />
                </svg>
                {effectiveUnreadCount > 0 && (
                  <span className="absolute right-1 top-1 min-w-5 rounded-full bg-error px-1.5 py-0.5 text-center text-xs font-semibold leading-none text-white">
                    {effectiveUnreadCount > 99 ? "99+" : effectiveUnreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {notificationOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-border-default bg-secondary shadow-2xl">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
                    <span className="text-sm font-semibold text-text-primary">Notifications</span>
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-accent hover:text-accent-hover transition-colors"
                    >
                      Mark all as read
                    </button>
                  </div>

                  {/* Body */}
                  <div className="max-h-96 overflow-y-auto">
                    {notifLoading ? (
                      <div className="space-y-1 p-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="animate-pulse rounded-lg bg-tertiary h-16 w-full" />
                        ))}
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                        <svg className="h-8 w-8 text-text-tertiary mb-2" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.71V3a2 2 0 0 0-4 0v1.29A7 7 0 0 0 5 11v5l-1.3 1.3A1 1 0 0 0 4.4 19h15.2a1 1 0 0 0 .7-1.7L19 16Z"/>
                        </svg>
                        <p className="text-text-tertiary text-sm">You're all caught up</p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-border-default">
                        {notifications.map(notif => (
                          <li key={notif.id}>
                            <button
                              type="button"
                              onClick={() => handleNotifClick(notif)}
                              className={`w-full text-left px-4 py-3 hover:bg-tertiary transition-colors ${
                                !notif.is_read ? 'bg-accent-soft' : ''
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                  !notif.is_read ? 'bg-accent' : 'bg-transparent'
                                }`} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-text-primary truncate">
                                    {notif.title}
                                  </p>
                                  <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                                    {notif.message}
                                  </p>
                                  <p className="text-xs text-text-tertiary mt-1">
                                    {timeAgo(notif.created_at)}
                                  </p>
                                </div>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-border-default px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setNotificationOpen(false);
                        navigate('/notifications');
                      }}
                      className="text-xs text-accent hover:text-accent-hover transition-colors"
                    >
                      View all notifications →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <RecruiterAvatar name={fullName} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-primary">
          {quotaLoading && (
            <div className="px-4 pt-4 lg:px-6">
              <SkeletonCard rows={1} className="rounded border-border-default p-4" />
            </div>
          )}

          {!quotaLoading && showQuotaBanner && (
            <div className="bg-warning px-4 py-3 text-primary lg:px-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium">
                  You've used {quotaPercent}% of your assessment quota.{" "}
                  <button
                    type="button"
                    onClick={() => navigate("billing/plans")}
                    className="font-semibold underline underline-offset-2"
                  >
                    Upgrade Now
                  </button>{" "}
                  to avoid interruptions.
                </p>
                <button
                  type="button"
                  onClick={dismissQuotaBanner}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-lg leading-none transition-colors hover:bg-primary/10"
                  aria-label="Dismiss quota warning"
                >
                  &times;
                </button>
              </div>
            </div>
          )}

          <div className="min-h-full">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default RecruiterLayout;
