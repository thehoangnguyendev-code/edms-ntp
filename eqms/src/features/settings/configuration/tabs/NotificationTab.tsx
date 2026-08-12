import React, { useState } from 'react';
import { useEffect } from 'react';
import { NotificationConfig } from '../types';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { Button } from '@/components/ui/button/Button';
import { useToast } from '@/components/ui/toast/Toast';
import { InlineLoading } from '@/components/ui/loading/Loading';
import { Eye, EyeOff, Bell, RefreshCw, RotateCcw } from 'lucide-react';
import gmailLogo from '@/assets/images/logo-app/gmail.svg';
import { settingsApi } from '@/services/api';
import type { SmtpConnectionTestPayload } from '@/services/api/settings';
import { notificationApi, type NotificationDeliveryFailure } from '@/services/api/notifications';

interface NotificationTabProps {
  config: NotificationConfig;
  onChange: (config: NotificationConfig) => void;
}

const SettingsCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="flex items-center gap-2.5 px-4 md:px-5 py-4 border-b border-slate-100">
      <span className="text-emerald-600">{icon}</span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    </div>
    <div className="p-4 md:p-5">{children}</div>
  </div>
);

export const NotificationTab: React.FC<NotificationTabProps> = ({ config, onChange }) => {
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [deliveryFailures, setDeliveryFailures] = useState<NotificationDeliveryFailure[]>([]);
  const [isLoadingDeliveryFailures, setIsLoadingDeliveryFailures] = useState(true);
  const [retryingFailureId, setRetryingFailureId] = useState<string | null>(null);
  const { showToast } = useToast();

  const loadDeliveryFailures = async (showFailureToast = false) => {
    setIsLoadingDeliveryFailures(true);
    try {
      const response = await notificationApi.getDeliveryFailures(1, 5);
      setDeliveryFailures(response.data);
    } catch (error: any) {
      if (showFailureToast) {
        showToast({
          type: 'error',
          title: 'Unable to load delivery failures',
          message: error?.response?.data?.message || 'Notification delivery failures could not be loaded.',
        });
      }
    } finally {
      setIsLoadingDeliveryFailures(false);
    }
  };

  useEffect(() => {
    void loadDeliveryFailures();
    // Refresh only on demand or after a retry; configuration must not create a polling loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetryDeliveryFailure = async (failure: NotificationDeliveryFailure) => {
    setRetryingFailureId(failure.id);
    try {
      const updated = await notificationApi.retryDeliveryFailure(failure.id);
      setDeliveryFailures((current) => current.map((item) => item.id === updated.id ? updated : item));
      showToast({ type: 'success', title: 'Delivery retry queued', message: `Retry requested for ${failure.recipient}.` });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Delivery retry failed',
        message: error?.response?.data?.message || 'The notification could not be retried.',
      });
    } finally {
      setRetryingFailureId(null);
    }
  };

  const handleChange = (key: keyof NotificationConfig, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const handleEmailConfigChange = (key: keyof NotificationConfig['emailConfig'], value: any) => {
    onChange({
      ...config,
      emailConfig: {
        ...config.emailConfig,
        [key]: value,
      },
    });
  };

  const handleTestSmtp = async () => {
    const smtpHost = config.emailConfig.smtpHost.trim();
    const smtpPort = Number(config.emailConfig.smtpPort);
    const smtpUsername = config.emailConfig.smtpUsername.trim();
    const smtpPassword = config.emailConfig.smtpPassword;
    const senderEmail = config.emailConfig.senderEmail.trim();
    const senderName = config.emailConfig.senderName.trim();

    if (!smtpHost || !smtpPort || !smtpUsername || !smtpPassword || !senderEmail || !senderName) {
      showToast({
        type: 'error',
        title: 'Missing SMTP Details',
        message: 'Please fill in SMTP Host, Port, Username, Password, Sender Email, and Sender Name before testing.',
      });
      return;
    }

    const payload: SmtpConnectionTestPayload = {
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      senderEmail,
      senderName,
      useSSL: !!config.emailConfig.useSSL,
    };

    setTestingSmtp(true);
    try {
      const result = await settingsApi.testSmtpConnection(payload);
      if (result.success) {
        showToast({
          type: 'success',
          title: 'SMTP Connection Successful',
          message: result.message || `Test email sent to ${config.emailConfig.senderEmail}`,
        });
      } else {
        showToast({
          type: 'error',
          title: 'SMTP Connection Failed',
          message: result.message || 'Unable to connect to SMTP server',
        });
      }
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'SMTP Connection Failed',
        message: error.response?.data?.message || error.message || 'Unable to connect to SMTP server',
      });
    } finally {
      setTestingSmtp(false);
    }
  };

  return (
    <div className="p-4 md:p-5 space-y-4">
      {/* Notification Channels */}
      <SettingsCard title="Notification Channels" icon={<Bell className="h-4 w-4" />}>
        <div className="space-y-3">
          <div>
            <Checkbox
              id="enableInAppNotifications"
              label="Enable In-App Notifications"
              checked={config.enableInAppNotifications}
              onChange={(checked) => handleChange('enableInAppNotifications', checked)}
            />
            <p className="text-xs text-slate-500 ml-7">
              Display notifications within the application interface
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Delivery Failures" icon={<Bell className="h-4 w-4" />}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Recent failed deliveries are stored by the server. Retry reuses the saved, redacted event payload and the active template.</p>
          <Button size="sm" variant="outline-emerald" onClick={() => void loadDeliveryFailures(true)} disabled={isLoadingDeliveryFailures} className="shrink-0 gap-1.5">
            {isLoadingDeliveryFailures ? <InlineLoading size="xs" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
        {isLoadingDeliveryFailures ? (
          <div className="flex justify-center py-5"><InlineLoading size="sm" /></div>
        ) : deliveryFailures.length === 0 ? (
          <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">No failed notification deliveries.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2 text-left font-semibold">Recipient</th><th className="px-3 py-2 text-left font-semibold">Type</th><th className="px-3 py-2 text-left font-semibold">Attempts</th><th className="px-3 py-2 text-right font-semibold">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {deliveryFailures.map((failure) => <tr key={failure.id}>
                  <td className="max-w-48 truncate px-3 py-2 text-slate-700" title={failure.recipient}>{failure.recipient}</td>
                  <td className="px-3 py-2 text-slate-600">{failure.notificationType}</td>
                  <td className="px-3 py-2 text-slate-600">{failure.attempts}/5</td>
                  <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => void handleRetryDeliveryFailure(failure)} disabled={retryingFailureId === failure.id || failure.attempts >= 5} className="gap-1 text-emerald-700"><RotateCcw className="h-3.5 w-3.5" />Retry</Button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </SettingsCard>

      {/* Email Configuration */}
      <SettingsCard title="Email Notifications (SMTP)" icon={<img src={gmailLogo} alt="Gmail" className="h-4 w-4 object-contain brightness-110" />}>
        <div className="space-y-4">
          <Checkbox
            id="enableEmailNotifications"
            label="Enable Email Notifications"
            checked={config.enableEmailNotifications}
            onChange={(checked) => handleChange('enableEmailNotifications', checked)}
          />

          {config.enableEmailNotifications && (
            <div className="ml-7 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                  Public App URL
                </label>
                <input
                  type="url"
                  value={config.publicAppUrl || ''}
                  onChange={(e) => handleChange('publicAppUrl', e.target.value)}
                  className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="http://localhost:3000"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Public URL used in controlled copy preview emails and external links
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={config.emailConfig.smtpHost}
                    onChange={(e) => handleEmailConfigChange('smtpHost', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    value={config.emailConfig.smtpPort}
                    onChange={(e) => handleEmailConfigChange('smtpPort', parseInt(e.target.value))}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="587"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    SMTP Username
                  </label>
                  <input
                    type="text"
                    value={config.emailConfig.smtpUsername}
                    onChange={(e) => handleEmailConfigChange('smtpUsername', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="username@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    SMTP Password
                  </label>
                  <div className="relative">
                    <input
                      type={showSmtpPassword ? "text" : "password"}
                      value={config.emailConfig.smtpPassword}
                      onChange={(e) => handleEmailConfigChange('smtpPassword', e.target.value)}
                      className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Sender Email
                  </label>
                  <input
                    type="email"
                    value={config.emailConfig.senderEmail}
                    onChange={(e) => handleEmailConfigChange('senderEmail', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="noreply@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    value={config.emailConfig.senderName}
                    onChange={(e) => handleEmailConfigChange('senderName', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="EQMS Notification"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Checkbox
                  id="useSSL"
                  label="Use SSL/TLS Encryption"
                  checked={config.emailConfig.useSSL}
                  onChange={(checked) => handleEmailConfigChange('useSSL', checked)}
                />
                <Button
                  variant="outline-emerald"
                  size="sm"
                  onClick={handleTestSmtp}
                  disabled={
                    testingSmtp ||
                    !config.emailConfig.smtpHost.trim() ||
                    !String(config.emailConfig.smtpPort || '').trim() ||
                    !config.emailConfig.smtpUsername.trim() ||
                    !config.emailConfig.smtpPassword ||
                    !config.emailConfig.senderEmail.trim() ||
                    !config.emailConfig.senderName.trim()
                  }
                  className="gap-2 shadow-sm"
                >
                  {testingSmtp ? (
                    <>
                      <InlineLoading size="xs" />
                      <span className="ml-1">Testing...</span>
                    </>
                  ) : (
                    <>
                      <span className="ml-1">Send Test Email</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SettingsCard>

    </div>
  );
};
