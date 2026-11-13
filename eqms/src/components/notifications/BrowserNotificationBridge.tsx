import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import { notificationApi } from '@/services/api/notifications';
import { subscribeNotificationRealtime } from '@/features/notifications/notificationRealtime';
import { normalizeNotificationType, openNotificationActionUrl } from '@/features/notifications/adapters';
import { getNotificationTypeIcon, getNotificationTypeIconStyles } from '@/features/notifications/notificationMeta';

/**
 * Delivers a toast for every new notification while an authenticated EQMS page is open
 * (independent of the opt-in browser-push permission), and additionally fires a native OS
 * `Notification` popup for users who opted into that separate channel. The SSE stream only
 * carries a "something changed" ping, not the notification content, so this fetches the
 * single newest unread item per ping to know what to show.
 *
 * The toast and the list of the bell are one notification seen twice: the toast carries the icon and the colours chosen for the notification, a high or
 * critical priority is a warning, and clicking it opens what the notification is about and marks it read, as clicking it in the list does.
 */
export const BrowserNotificationBridge = () => {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
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
          const kind = normalizeNotificationType(latest.type);
          const styles = getNotificationTypeIconStyles(kind, latest.iconTone);
          const priority = (latest.priority ?? '').toLowerCase();
          const actionUrl = latest.actionUrl;
          showToast({
            type: priority === 'high' || priority === 'critical' ? 'warning' : 'info',
            title: latest.title,
            message: latest.description,
            icon: getNotificationTypeIcon(kind, latest.icon),
            iconClassName: `${styles.bg} ${styles.text}`,
            iconStyle: styles.tileStyle ? { ...styles.tileStyle, ...styles.iconStyle } : undefined,
            onOpen: actionUrl
              ? () => {
                  void notificationApi.markAsRead(latest.id).catch(() => undefined);
                  openNotificationActionUrl(actionUrl, navigate);
                }
              : undefined,
          });
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
  }, [isAuthenticated, navigate, showToast, user?.notificationPreferences?.channels?.push]);

  return null;
};
