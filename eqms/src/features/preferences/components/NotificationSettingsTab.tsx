import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, Mail, MonitorSmartphone } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { Switch } from '@/components/ui';
import { FormSection } from '@/components/ui/form/FormSection';
import { useAuth } from '@/contexts/AuthContext';
import { notificationApi } from '@/services/api/notifications';
import { useToast } from '@/components/ui/toast';

interface NotificationSettingsTabProps {
  onRegisterSaveHandler?: (handler: (() => Promise<void>) | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

type StoredPreferences = { channels?: Record<string, boolean>; modules?: Record<string, boolean> };

const Chip: React.FC<{ label: string; muted?: boolean }> = ({ label, muted }) => (
  <span
    className={cn(
      'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
      muted ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
    )}
  >
    <span className="max-w-[220px] truncate">{label}</span>
  </span>
);

/**
 * Every notification of the system is always delivered, in the application and by e-mail: a person cannot switch one off. The only choice
 * left is whether the browser also shows a pop-up while the application is open.
 */
export const NotificationSettingsTab: React.FC<NotificationSettingsTabProps> = ({ onRegisterSaveHandler, onDirtyChange }) => {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const primaryEmail = user?.email?.trim() || '';
  const stored = user?.notificationPreferences as StoredPreferences | undefined;
  const persistedPush = stored?.channels?.push === true;

  const [channelPush, setChannelPush] = useState(persistedPush);
  const [isSaving, setIsSaving] = useState(false);
  const browserPushSupported = typeof window !== 'undefined' && 'Notification' in window;

  useEffect(() => {
    setChannelPush(persistedPush);
  }, [persistedPush]);

  const pendingChanges = useMemo(() => channelPush !== persistedPush, [channelPush, persistedPush]);

  const toggleBrowserPush = async () => {
    if (!browserPushSupported) {
      showToast({ type: 'error', title: 'Browser notifications unavailable', message: 'This browser does not support notification permissions.' });
      return;
    }
    if (!channelPush) {
      const permission = await window.Notification.requestPermission();
      if (permission !== 'granted') {
        showToast({ type: 'error', title: 'Permission not granted', message: 'Allow browser notifications to enable this channel.' });
        return;
      }
    }
    setChannelPush((previous) => !previous);
  };

  const saveChanges = useCallback(async () => {
    if (!pendingChanges) return;
    setIsSaving(true);
    try {
      // the purpose-built /notifications/preferences endpoint; the other choices are sent as they are stored (they no longer change what is delivered)
      const response = await notificationApi.updatePreferences({
        channels: {
          email: user?.emailNotificationsEnabled !== false,
          inApp: stored?.channels?.inApp !== false,
          push: channelPush,
        },
        modules: stored?.modules ?? {},
      });
      if (user) {
        updateUser({ ...user, emailNotificationsEnabled: response.channels.email, notificationPreferences: response });
      }
    } finally {
      setIsSaving(false);
    }
  }, [channelPush, pendingChanges, stored, updateUser, user]);

  useEffect(() => {
    onRegisterSaveHandler?.(saveChanges);
    return () => {
      onRegisterSaveHandler?.(null);
    };
  }, [onRegisterSaveHandler, saveChanges]);

  useEffect(() => {
    onDirtyChange?.(pendingChanges);
    return () => onDirtyChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChanges, onDirtyChange]);

  return (
    <div className="p-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="space-y-4">
        <FormSection title="Notification Channels" icon={<BellRing className="h-4 w-4" />}>
          <div className="space-y-1">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-600">
              Every notification is always delivered to you in the application and by e-mail. It cannot be switched off.
            </div>

            <div className="flex items-start gap-3 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                <Mail className="h-4 w-4 text-slate-600" />
              </span>
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">Email</p>
                  <p className="text-xs text-slate-500">Sent to your account email:</p>
                </div>
                <Chip label={primaryEmail || 'No primary email'} muted />
              </div>
            </div>

            <div className="flex items-center gap-3 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                <Bell className="h-4 w-4 text-slate-600" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-900">In-App Notifications</p>
                <p className="text-xs text-slate-500">Shown in the bell and on the Notifications page.</p>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <MonitorSmartphone className="h-4 w-4 text-slate-600" />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-900">Browser Push Notifications</p>
                  <p className="text-xs text-slate-500">Also show a pop-up through your browser while EQMS is open.</p>
                </div>
              </div>
              <Switch checked={channelPush} onChange={() => void toggleBrowserPush()} disabled={isSaving || !browserPushSupported} />
            </div>
          </div>
        </FormSection>
      </div>
    </div>
  );
};
