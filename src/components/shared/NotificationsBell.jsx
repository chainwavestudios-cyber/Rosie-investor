/**
 * NotificationsBell.jsx — the silent way in to the Notifications tab.
 * Floating badge, fixed bottom-left so it never covers the call popups.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { subscribeNotifications } from '@/lib/notifyCenter';
import { Bell } from 'lucide-react';

const HIDDEN = [
  '/notifications', '/optin', '/email-optin', '/privacy', '/terms', '/portal-login',
  '/admin-login', '/request-access', '/qualify', '/aboutdebt', '/reschedule',
  '/log', '/work-report', '/growth-plan', '/stories',
];

export default function NotificationsBell() {
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const n = await base44.entities.AppNotification.count({ read: false });
        if (alive) setUnread(n || 0);
      } catch { /* not signed in yet */ }
    };
    refresh();
    const unsubscribe = subscribeNotifications(refresh);
    const timer = setInterval(refresh, 60000);
    return () => { alive = false; unsubscribe(); clearInterval(timer); };
  }, [location.pathname]);

  if (HIDDEN.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))) return null;

  return (
    <Link
      to="/notifications"
      title="Notifications"
      style={{
        position: 'fixed', bottom: '14px', left: '14px', zIndex: 8900,
        display: 'flex', alignItems: 'center', gap: '6px',
        background: 'rgba(8,15,30,0.94)', border: '1px solid rgba(16,185,129,0.45)',
        color: '#e2e8f0', borderRadius: '999px', padding: '7px 12px 7px 10px',
        fontSize: '11px', fontWeight: 'bold', textDecoration: 'none',
        boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
      }}
    >
      <Bell size={14} color="#10b981" />
      Notifications
      {unread > 0 && (
        <span style={{
          background: '#ef4444', color: '#fff', borderRadius: '999px',
          padding: '1px 6px', fontSize: '10px', lineHeight: '14px',
        }}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}