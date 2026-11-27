import { tr as __ariaTr } from "@/i18n";
﻿import React, { useState } from 'react';
import { DeliveryFailuresTable } from './DeliveryFailuresTable';

import { NotificationConfig } from '../types';
import { FormField, Input } from '@/components/ui/form/ResponsiveForm';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { FieldHint } from '@/components/ui/form/FieldHint';
import { Button } from '@/components/ui/button/Button';
import { useToast } from '@/components/ui/toast/Toast';
import { InlineLoading } from '@/components/ui/loading/Loading';
import { Eye, EyeOff, Bell, Mail } from 'lucide-react';
import { settingsApi } from '@/services/api';
import type { SmtpConnectionTestPayload } from '@/services/api/settings';
import { ConfigTabs, HISTORY_TAB, changedTabs, revertFields } from './ConfigTabs';
import { ConfigHistory } from './ConfigHistory';
import type { NotificationTabId } from './pageTabs';
import { IconBellShare } from '@tabler/icons-react';
import { tr } from "@/i18n";

const TABS = [
  { id: 'channels-delivery', get label() { return tr('Channels & Delivery'); }, icon: IconBellShare },
  { id: 'email', get label() { return tr('Email (SMTP)'); }, icon: Mail },
  HISTORY_TAB,
] as const;

const FIELDS: Record<NotificationTabId, ReadonlyArray<string>> = {
  'channels-delivery': ['enableInAppNotifications', 'inAppRetentionDays'],
  email: ['enableEmailNotifications', 'publicAppUrl', 'emailConfig'],
  history: [],
};

interface NotificationTabProps {
  config: NotificationConfig;
  onChange: (config: NotificationConfig) => void;
  /** The tab that is open. When the page keeps it (in the address), it is given here with onTabChange; otherwise the tab keeps its own. */
  activeTab?: NotificationTabId;
  onTabChange?: (tab: NotificationTabId) => void;
  /** What was last saved, to mark the tabs that hold a change that is not saved yet. */
  savedConfig?: NotificationConfig | null;
}

export const NotificationTab: React.FC<NotificationTabProps> = ({ config, onChange, activeTab: activeTabProp, onTabChange, savedConfig }) => {
  const [ownTab, setOwnTab] = useState<NotificationTabId>('channels-delivery');
  const activeTab = activeTabProp ?? ownTab;
  const selectTab = (tab: NotificationTabId) => { setOwnTab(tab); onTabChange?.(tab); };
  const changed = React.useMemo(() => changedTabs<NotificationTabId>(config, savedConfig, FIELDS), [config, savedConfig]);
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
        title: tr('Missing SMTP Details'),
        message: tr('Please fill in SMTP Host, Port, Username, Password, Sender Email, and Sender Name before testing.'),
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
          title: tr('SMTP Connection Successful'),
          message: result.message || `Test email sent to ${config.emailConfig.senderEmail}`,
        });
      } else {
        showToast({
          type: 'error',
          title: tr('SMTP Connection Failed'),
          message: result.message || 'Unable to connect to SMTP server',
        });
      }
    } catch (error: any) {
      showToast({
        type: 'error',
        title: tr('SMTP Connection Failed'),
        message: error.response?.data?.message || error.message || 'Unable to connect to SMTP server',
      });
    } finally {
      setTestingSmtp(false);
    }
  };

  return (
    <ConfigTabs
      tabs={TABS}
      activeTab={activeTab}
      onChange={selectTab}
      changed={changed}
      onReset={savedConfig ? (tab) => onChange(revertFields(config, savedConfig, FIELDS[tab])) : undefined}
      ariaLabel={__ariaTr("Notification sections")}
      idPrefix="notifications"
    >
      {activeTab === 'channels-delivery' && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("In-App Notifications")}</h3>
            <Checkbox id="enableInAppNotifications" label={tr("Enable In-App Notifications")} checked={config.enableInAppNotifications} onChange={(checked) => handleChange('enableInAppNotifications', checked)} />
            <FieldHint indent>{tr("Show notifications inside the application.")}</FieldHint>
            <div className="mt-4">
              <FormField label={tr("Keep read notifications for (days)")} hint={tr("A notification that was read this many days ago is deleted every night. 0 keeps them for ever; otherwise 30 to 3650. Notifications that were never read are never deleted.")}>
                <Input
                  id="inAppRetentionDays"
                  inputMode="numeric"
                  value={config.inAppRetentionDays === undefined ? '' : String(config.inAppRetentionDays)}
                  placeholder="180"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                    handleChange('inAppRetentionDays', digits === '' ? undefined : Number(digits));
                  }}
                />
              </FormField>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Delivery Failures")}</h3>
            <DeliveryFailuresTable />
          </div>
        </div>
      )}

      {activeTab === 'email' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">{tr("Email Notifications (SMTP)")}</h3>
          <Checkbox id="enableEmailNotifications" label={tr("Enable Email Notifications")} checked={config.enableEmailNotifications} onChange={(checked) => handleChange('enableEmailNotifications', checked)} />

          {config.enableEmailNotifications && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("Public App URL")}</label>
                <input type="url" value={config.publicAppUrl || ''} onChange={(e) => handleChange('publicAppUrl', e.target.value)} className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" placeholder="http://localhost:3000" />
                <p className="mt-1.5 text-xs text-slate-500">{tr("Public URL used in controlled copy preview emails and external links")}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("SMTP Host")}</label>
                  <input type="text" value={config.emailConfig.smtpHost} onChange={(e) => handleEmailConfigChange('smtpHost', e.target.value)} className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" placeholder={tr("smtp.gmail.com")} />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("SMTP Port")}</label>
                  <input type="number" value={config.emailConfig.smtpPort} onChange={(e) => handleEmailConfigChange('smtpPort', parseInt(e.target.value))} className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" placeholder="587" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("SMTP Username")}</label>
                  <input type="text" value={config.emailConfig.smtpUsername} onChange={(e) => handleEmailConfigChange('smtpUsername', e.target.value)} className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" placeholder="username@example.com" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("SMTP Password")}</label>
                  <div className="relative">
                    <input type={showSmtpPassword ? 'text' : 'password'} value={config.emailConfig.smtpPassword} onChange={(e) => handleEmailConfigChange('smtpPassword', e.target.value)} className="w-full h-9 px-3 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" placeholder={tr("Enter password")} />
                    <button type="button" onClick={() => setShowSmtpPassword(!showSmtpPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                      {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("Sender Email")}</label>
                  <input type="email" value={config.emailConfig.senderEmail} onChange={(e) => handleEmailConfigChange('senderEmail', e.target.value)} className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" placeholder="noreply@example.com" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("Sender Name")}</label>
                  <input type="text" value={config.emailConfig.senderName} onChange={(e) => handleEmailConfigChange('senderName', e.target.value)} className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" placeholder={tr("EQMS Notification")} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Checkbox id="useSSL" label={tr("Use SSL/TLS Encryption")} checked={config.emailConfig.useSSL} onChange={(checked) => handleEmailConfigChange('useSSL', checked)} />
                <Button variant="outline-emerald" size="sm" onClick={handleTestSmtp} disabled={testingSmtp || !config.emailConfig.smtpHost.trim() || !String(config.emailConfig.smtpPort || '').trim() || !config.emailConfig.smtpUsername.trim() || !config.emailConfig.smtpPassword || !config.emailConfig.senderEmail.trim() || !config.emailConfig.senderName.trim()} className="gap-2 shadow-sm">
                  {testingSmtp ? (
                    <>
                      <InlineLoading size="xs" />
                      <span className="ml-1">{tr("Testing...")}</span>
                    </>
                  ) : (
                    <>
                      <span className="ml-1">{tr("Send Test Email")}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && <ConfigHistory page="notifications" />}
    </ConfigTabs>
  );
};
