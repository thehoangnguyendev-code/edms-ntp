import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import { notificationApi } from '@/services/api/notifications';
import { subscribeNotificationRealtime } from '@/features/notifications/notificationRealtime';

/**
 * Delivers a toast for every new notification while an authenticated EQMS page is open
 * (independent of the opt-in browser-push permission), and additionally fires a native OS
 * `Notification` popup for users who opted into that separate channel. The SSE stream only
 * carries a "something changed" ping, not the notification content, so this fetches the
 * single newest unread item per ping to know what to show.
 */
export const BrowserNotificationBridge = () => {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const newestId = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      newestId.current = null;
      return;
    }

    let active = true;
    const check = async (showAlert: boolean) => {
      try {
        const result = await notificationApi.getNotifications({ page: 1, limit: 1, sortBy: 'createdAt', sortDirection: 'desc', status: 'unread' });
        const latest = result.data[0];
        if (!active || !latest) return;
        if (showAlert && newestId.current && newestId.current !== latest.id) {
          showToast({ type: 'info', title: latest.title, message: latest.description });
          const pushEnabled = user?.notificationPreferences?.channels?.push === true;
          if (pushEnabled && typeof window !== 'undefined' && window.Notification?.permission === 'granted') {
            new window.Notification(latest.title, { body: latest.description, tag: latest.id });
          }
        }
        newestId.current = latest.id;
      } catch {
        // In-app delivery via the bell/notifications page remains available if this
        // optional real-time bridge cannot refresh.
      }
    };
    void check(false);
    const unsubscribe = subscribeNotificationRealtime((event) => {
      if (event.type === 'notification-updated') void check(true);
    });
    return () => { active = false; unsubscribe(); };
  }, [isAuthenticated, showToast, user?.notificationPreferences?.channels?.push]);

  return null;
};
