import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, Building2, FileText, Mail, MonitorSmartphone, Settings, ShieldAlert } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { Button } from '@/components/ui/button/Button';
import { Switch } from '@/components/ui';
import { FormSection } from '@/components/ui/form/FormSection';
import { useAuth } from '@/contexts/AuthContext';
import { notificationApi } from '@/services/api/notifications';
import { useToast } from '@/components/ui/toast';

const MODULE_OPTIONS = [
  {
    key: 'document',
    label: 'Document',
    description: 'Document workflow events such as review, approval, publish and obsoleting updates.',
    icon: FileText,
  },
  {
    key: 'controlled-copies',
    label: 'Controlled Copies',
    description: 'Controlled copy request, distribution, recall, expiry and destruction notifications.',
    icon: Building2,
  },
  {
    key: 'training',
    label: 'Training',
    description: 'Training assignment, due and completion notifications.',
    icon: Bell,
  },
  {
    key: 'capa',
    label: 'CAPA',
    description: 'Corrective and preventive action notifications.',
    icon: ShieldAlert,
  },
  {
    key: 'deviation',
    label: 'Deviation',
    description: 'Deviation assignments and status changes.',
    icon: Settings,
  },
  {
    key: 'change-control',
    label: 'Change Control',
    description: 'Change-control workflow updates and approvals.',
    icon: MonitorSmartphone,
  },
  {
    key: 'system',
    label: 'System',
    description: 'System maintenance, security and operational notices.',
    icon: BellRing,
  },
] as const;

type ModulePreferenceKey = typeof MODULE_OPTIONS[number]['key'];

interface NotificationSettingsTabProps {
  onRegisterSaveHandler?: (handler: (() => Promise<void>) | null) => void;
}

const Chip: React.FC<{
  label: string;
  muted?: boolean;
}> = ({ label, muted }) => (
  <span
    className={cn(
      'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
      muted
        ? 'border-slate-200 bg-slate-50 text-slate-500'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
    )}
  >
    <span className="max-w-[220px] truncate">{label}</span>
  </span>
);

const readModulePreferences = (value: unknown): Record<ModulePreferenceKey, boolean> => {
  const defaults = MODULE_OPTIONS.reduce((acc, option) => {
    acc[option.key] = true;
    return acc;
  }, {} as Record<ModulePreferenceKey, boolean>);
  if (!value || typeof value !== 'object') {
    return defaults;
  }
  const modules = (value as { modules?: Record<string, boolean> }).modules;
  if (!modules || typeof modules !== 'object') {
    return defaults;
  }
  return MODULE_OPTIONS.reduce((acc, option) => {
    acc[option.key] = modules[option.key] !== false;
    return acc;
  }, defaults);
};

export const NotificationSettingsTab: React.FC<NotificationSettingsTabProps> = ({ onRegisterSaveHandler }) => {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const primaryEmail = user?.email?.trim() || '';
  const persistedEmailNotificationsEnabled = user?.emailNotificationsEnabled !== false;

  const [channelEmail, setChannelEmail] = useState(persistedEmailNotificationsEnabled);
  const [channelInApp, setChannelInApp] = useState(() => {
    const channels = (user?.notificationPreferences as { channels?: Record<string, boolean> } | undefined)?.channels;
    return channels?.inApp !== false;
  });
  const [channelPush, setChannelPush] = useState(() => {
    const channels = (user?.notificationPreferences as { channels?: Record<string, boolean> } | undefined)?.channels;
    return channels?.push === true;
  });
  const [modulePreferences, setModulePreferences] = useState<Record<ModulePreferenceKey, boolean>>(() =>
    readModulePreferences(user?.notificationPreferences)
  );
  const [isSaving, setIsSaving] = useState(false);
  const browserPushSupported = typeof window !== 'undefined' && 'Notification' in window;

  useEffect(() => {
    setChannelEmail(user?.emailNotificationsEnabled !== false);
    const channels = (user?.notificationPreferences as { channels?: Record<string, boolean> } | undefined)?.channels;
    setChannelInApp(channels?.inApp !== false);
    setChannelPush(channels?.push === true);
    setModulePreferences(readModulePreferences(user?.notificationPreferences));
  }, [user?.emailNotificationsEnabled, user?.notificationPreferences]);

  const pendingChanges = useMemo(() => {
    const persistedChannels = (user?.notificationPreferences as { channels?: Record<string, boolean> } | undefined)?.channels;
    const persistedModules = readModulePreferences(user?.notificationPreferences);
    return (
      channelEmail !== persistedEmailNotificationsEnabled ||
      channelInApp !== (persistedChannels?.inApp !== false) ||
      channelPush !== (persistedChannels?.push === true) ||
      MODULE_OPTIONS.some((option) => modulePreferences[option.key] !== persistedModules[option.key])
    );
  }, [
    channelEmail,
    channelInApp,
    channelPush,
    modulePreferences,
    persistedEmailNotificationsEnabled,
    user?.notificationPreferences,
  ]);

  const toggleModule = useCallback((key: ModulePreferenceKey) => {
    setModulePreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

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
      // Single source of truth for save: the purpose-built /notifications/preferences
      // endpoint (previously unused from the FE — this screen used to write through
      // /auth/me/notification-settings instead, a second path to the same underlying
      // user fields). It returns preferences only, not a full user, so merge locally
      // to keep AuthContext's cached user in sync without a second round-trip.
      const response = await notificationApi.updatePreferences({
        channels: {
          email: channelEmail,
          inApp: channelInApp,
          push: channelPush,
        },
        modules: modulePreferences,
      });
      if (user) {
        updateUser({
          ...user,
          emailNotificationsEnabled: response.channels.email,
          notificationPreferences: response,
        });
      }
    } finally {
      setIsSaving(false);
    }
  }, [channelEmail, channelInApp, channelPush, modulePreferences, pendingChanges, updateUser, user]);

  useEffect(() => {
    onRegisterSaveHandler?.(saveChanges);
    return () => {
      onRegisterSaveHandler?.(null);
    };
  }, [onRegisterSaveHandler, saveChanges]);

  return (
    <div className="p-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="space-y-4">
        <FormSection title="Notification Channels" icon={<BellRing className="h-4 w-4" />}>
          <div className="space-y-1">
            <div className="py-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                    <Mail className="h-4 w-4 text-slate-600" />
                  </span>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Email</p>
                      <p className="text-xs text-slate-500">Send to your account email:</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip label={primaryEmail || 'No primary email'} muted />
                    </div>
                  </div>
                </div>
                <Switch checked={channelEmail} onChange={() => setChannelEmail((prev) => !prev)} disabled={isSaving || !primaryEmail} />
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <Bell className="h-4 w-4 text-slate-600" />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-900">In-App Notifications</p>
                  <p className="text-xs text-slate-500">Show alerts and badge count inside the application.</p>
                </div>
              </div>
              <Switch checked={channelInApp} onChange={() => setChannelInApp((prev) => !prev)} disabled={isSaving} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <MonitorSmartphone className="h-4 w-4 text-slate-600" />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-900">Browser Push Notifications</p>
                  <p className="text-xs text-slate-500">Uses your browser permission to show alerts while EQMS is open.</p>
                </div>
              </div>
              <Switch checked={channelPush} onChange={() => void toggleBrowserPush()} disabled={isSaving || !browserPushSupported} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Module Notifications" icon={<Settings className="h-4 w-4" />}>
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-600">
              Turn modules on or off to control which workflow events will reach you through the channels above.
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {MODULE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const enabled = modulePreferences[option.key];
                return (
                  <div
                    key={option.key}
                    className={cn(
                      'flex items-start justify-between gap-4 rounded-xl border px-4 py-3 transition-colors',
                      enabled ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg',
                        enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                      )}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-900">{option.label}</p>
                        <p className="text-xs leading-relaxed text-slate-500">{option.description}</p>
                      </div>
                    </div>
                    <Switch checked={enabled} onChange={() => toggleModule(option.key)} disabled={isSaving} />
                  </div>
                );
              })}
            </div>
          </div>
        </FormSection>
      </div>

    </div>
  );
};
