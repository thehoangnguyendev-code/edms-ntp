import React, { useState } from 'react';
import { DeliveryFailuresTable } from './DeliveryFailuresTable';
import { FormSection } from '@/components/ui/form/FormSection';

import { NotificationConfig, type ToastPosition } from '../types';
import { Select } from '@/components/ui/select/Select';
import { FormField, Input } from '@/components/ui/form/ResponsiveForm';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { Button } from '@/components/ui/button/Button';
import { useToast } from '@/components/ui/toast/Toast';
import { InlineLoading } from '@/components/ui/loading/Loading';
import { Eye, EyeOff, Bell } from 'lucide-react';
import gmailLogo from '@/assets/images/logo-app/gmail.svg';
import { settingsApi } from '@/services/api';
import type { SmtpConnectionTestPayload } from '@/services/api/settings';

const TOAST_POSITION_OPTIONS: Array<{ label: string; value: ToastPosition }> = [
  { label: 'Top Right', value: 'top-right' },
  { label: 'Top Left', value: 'top-left' },
  { label: 'Center', value: 'center' },
  { label: 'Bottom Right', value: 'bottom-right' },
  { label: 'Bottom Left', value: 'bottom-left' },
];

interface NotificationTabProps {
  config: NotificationConfig;
  onChange: (config: NotificationConfig) => void;
  /** Stored with the appearance settings (General), edited here with the other notification options. */
  toastPosition: ToastPosition;
  onToastPositionChange: (position: ToastPosition) => void;
  toastDurationSeconds?: number;
  onToastDurationChange: (seconds: number | undefined) => void;
}


export const NotificationTab: React.FC<NotificationTabProps> = ({ config, onChange, toastPosition, onToastPositionChange, toastDurationSeconds, onToastDurationChange }) => {
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const { showToast } = useToast();
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
      <FormSection title="Notification Channels" icon={<Bell className="h-4 w-4" />}>
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
          <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
            <div>
              <div>
                <Select
                  label="Toast Position"
                  value={toastPosition}
                  onChange={(value) => onToastPositionChange(value as ToastPosition)}
                  options={TOAST_POSITION_OPTIONS}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Where system messages pop up on screen. Applies to every signed-in user after Save Changes.</p>
            </div>
            <div>
              <div>
                <FormField
                  label="Toast Display Time (seconds)"
                  hint="How long a system message stays on screen before it goes away (2 to 60). Empty: 5 seconds. Applies to every signed-in user after Save Changes."
                  error={toastDurationSeconds !== undefined && !(Number.isInteger(toastDurationSeconds) && toastDurationSeconds >= 2 && toastDurationSeconds <= 60) ? 'Enter a whole number from 2 to 60, or leave it empty for 5 seconds.' : undefined}
                >
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="5"
                    aria-label="Toast display time in seconds"
                    value={toastDurationSeconds === undefined ? '' : String(toastDurationSeconds)}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      onToastDurationChange(digits === '' ? undefined : Number(digits));
                    }}
                  />
                </FormField>
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Delivery Failures" icon={<Bell className="h-4 w-4" />}>
        <DeliveryFailuresTable />
      </FormSection>

      {/* Email Configuration */}
      <FormSection title="Email Notifications (SMTP)" icon={<img src={gmailLogo} alt="Gmail" className="h-4 w-4 object-contain brightness-110" />}>
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
      </FormSection>

    </div>
  );
};
