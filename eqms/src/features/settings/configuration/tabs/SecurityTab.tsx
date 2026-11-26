import { tr as __ariaTr } from "@/i18n";
﻿import React from 'react';
import { SecurityConfig } from '../types';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { trFormat, tr } from "@/i18n";
import { FieldHint } from '@/components/ui/form/FieldHint';
import { IconKey, IconNetwork, IconPasswordUser, IconShieldLock } from '@tabler/icons-react';
import { PasswordPolicyTester } from './PasswordPolicyTester';
import { ConfigTabs, HISTORY_TAB, changedTabs, revertFields } from './ConfigTabs';
import { ConfigHistory } from './ConfigHistory';
import type { SecurityTabId } from './securityTabs';

const ALL_TABS = [
  { id: 'password-rules', label: tr('Password Rules'), icon: IconPasswordUser },
  { id: 'sessions-accounts', label: tr('Sessions & Accounts'), icon: IconShieldLock },
  { id: 'network-access', label: tr('Network Access'), icon: IconNetwork },
  HISTORY_TAB,
] as const;

const FIELDS: Record<SecurityTabId, ReadonlyArray<string>> = {
  'password-rules': ['passwordMinLength', 'requireUppercase', 'requireLowercase', 'requireSpecialChars', 'requireNumbers', 'disallowWhitespace', 'disallowSequentialChars', 'disallowCommonPasswords', 'disallowUserInfo', 'minUniqueChars', 'maxRepeatedChars', 'enablePasswordExpiry', 'passwordExpiryDays', 'preventPasswordReuse', 'passwordHistoryCount', 'forcePasswordChangeOnFirstLogin'],
  'sessions-accounts': ['sessionTimeoutEnabled', 'sessionTimeoutMinutes', 'enable2FA', 'maxConcurrentSessions', 'enableAccountLockout', 'maxLoginAttempts', 'maxSignatureAttempts', 'inactiveAccountDays'],
  // the network policy is not part of the security configuration: the page tells whether it changed
  'network-access': [],
  history: [],
};

interface SecurityTabProps {
  config: SecurityConfig;
  onChange: (config: SecurityConfig) => void;
  /** The tab that is open. When the page keeps it (in the address), it is given here with onTabChange; otherwise the tab keeps its own. */
  activeTab?: SecurityTabId;
  onTabChange?: (tab: SecurityTabId) => void;
  /** What was last saved, to mark the tabs that hold a change that is not saved yet. */
  savedConfig?: SecurityConfig | null;
  /** The administrative network panel, saved on its own. Without it (no permission) the Network Access tab is left out. */
  networkPanel?: React.ReactNode;
  networkChanged?: boolean;
  /** Puts the network policy back to what was last saved (it is kept by the page, apart from the rest). */
  onNetworkReset?: () => void;
}

const inputClass = 'w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500';
const labelClass = 'block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize';
const groupClass = 'border-t border-slate-200 pt-6';
const headingClass = 'mb-3 text-sm font-semibold text-slate-900';

export const SecurityTab: React.FC<SecurityTabProps> = ({ config, onChange, activeTab: activeTabProp, onTabChange, savedConfig, networkPanel, networkChanged, onNetworkReset }) => {
  const [ownTab, setOwnTab] = React.useState<SecurityTabId>('password-rules');
  const tabs = React.useMemo(() => ALL_TABS.filter((tab) => tab.id !== 'network-access' || networkPanel), [networkPanel]);
  const requested = activeTabProp ?? ownTab;
  const activeTab = tabs.some((tab) => tab.id === requested) ? requested : tabs[0].id;
  const selectTab = (tab: SecurityTabId) => { setOwnTab(tab); onTabChange?.(tab); };
  const changed = React.useMemo(() => {
    const set = changedTabs<SecurityTabId>(config, savedConfig, FIELDS);
    if (networkChanged) set.add('network-access');
    return set;
  }, [config, savedConfig, networkChanged]);

  const handleChange = (key: keyof SecurityConfig, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const handleSessionTimeoutChange = (rawValue: string) => {
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) {
      handleChange('sessionTimeoutMinutes', 1);
      return;
    }
    const clamped = Math.min(1440, Math.max(1, parsed));
    handleChange('sessionTimeoutMinutes', clamped);
  };

  const handleIntegerChange = (key: keyof SecurityConfig, rawValue: string, min: number, max: number) => {
    const parsed = Number.parseInt(rawValue, 10);
    handleChange(key, Number.isNaN(parsed) ? min : Math.min(max, Math.max(min, parsed)));
  };

  return (
    <ConfigTabs
      tabs={tabs}
      activeTab={activeTab}
      onChange={selectTab}
      changed={changed}
      onReset={(tab) => (tab === 'network-access' ? onNetworkReset?.() : savedConfig && onChange(revertFields(config, savedConfig, FIELDS[tab])))}
      ariaLabel={__ariaTr("Security sections")}
      idPrefix="security"
    >
      {activeTab === 'password-rules' && (
        <div className="space-y-6">
          <div>
            <h3 className={headingClass}>{tr("Length")}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>{tr("Minimum Password Length")}</label>
                <input
                  type="number"
                  value={config.passwordMinLength}
                  onChange={(e) => handleIntegerChange('passwordMinLength', e.target.value, 8, 128)}
                  className={inputClass}
                  min={8}
                  max={128}
                />
                <p className="mt-1 text-xs text-slate-500">{tr("Minimum: 8 characters")}</p>
              </div>
            </div>
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>{tr("Required Characters")}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Checkbox id="requireUppercase" label={tr("Require Uppercase Letters (A-Z)")} checked={config.requireUppercase} onChange={(checked) => handleChange('requireUppercase', checked)} />
              <Checkbox id="requireLowercase" label={tr("Require Lowercase Letters (a-z)")} checked={config.requireLowercase} onChange={(checked) => handleChange('requireLowercase', checked)} />
              <Checkbox id="requireSpecialChars" label={tr("Require Special Characters (@, #, $, etc.)")} checked={config.requireSpecialChars} onChange={(checked) => handleChange('requireSpecialChars', checked)} />
              <Checkbox id="requireNumbers" label={tr("Require Numbers (0-9)")} checked={config.requireNumbers} onChange={(checked) => handleChange('requireNumbers', checked)} />
            </div>
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>{tr("Not Allowed")}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Checkbox id="disallowWhitespace" label={tr("Disallow Spaces")} checked={config.disallowWhitespace ?? false} onChange={(checked) => handleChange('disallowWhitespace', checked)} />
              <Checkbox id="disallowSequentialChars" label={tr("Disallow Sequences (abc, 123, cba)")} checked={config.disallowSequentialChars ?? false} onChange={(checked) => handleChange('disallowSequentialChars', checked)} />
              <Checkbox id="disallowCommonPasswords" label={tr("Disallow Commonly Used Passwords")} checked={config.disallowCommonPasswords ?? false} onChange={(checked) => handleChange('disallowCommonPasswords', checked)} />
              <Checkbox id="disallowUserInfo" label={tr("Disallow Username, E-mail or Name in Password")} checked={config.disallowUserInfo ?? false} onChange={(checked) => handleChange('disallowUserInfo', checked)} />
            </div>
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>{tr("Complexity Limits")}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>{tr("Minimum Unique Characters")}</label>
                <input
                  type="number"
                  value={config.minUniqueChars ?? 0}
                  onChange={(e) => handleIntegerChange('minUniqueChars', e.target.value, 0, 64)}
                  className={inputClass}
                  min={0}
                  max={64}
                />
                <p className="mt-1 text-xs text-slate-500">{tr("Number of different characters required. 0 = not enforced.")}</p>
              </div>
              <div>
                <label className={labelClass}>{tr("Maximum Repeated Characters in a Row")}</label>
                <input
                  type="number"
                  value={config.maxRepeatedChars ?? 0}
                  onChange={(e) => handleIntegerChange('maxRepeatedChars', e.target.value, 0, 10)}
                  className={inputClass}
                  min={0}
                  max={10}
                />
                <p className="mt-1 text-xs text-slate-500">{tr("E.g. 2 rejects \"aaa\". 0 = not enforced.")}</p>
              </div>
            </div>
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>{tr("Password Expiration")}</h3>
            <Checkbox id="enablePasswordExpiry" label={tr("Enable Password Expiration")} checked={config.enablePasswordExpiry} onChange={(checked) => handleChange('enablePasswordExpiry', checked)} />
            <FieldHint indent>{tr("Ask users to change their password regularly.")}</FieldHint>
            {config.enablePasswordExpiry && (
              <div className="ml-7 mt-3">
                <label className={labelClass}>{tr("Password Expiry Period (Days)")}</label>
                <input
                  type="number"
                  value={config.passwordExpiryDays}
                  onChange={(e) => handleIntegerChange('passwordExpiryDays', e.target.value, 30, 365)}
                  className={`${inputClass} md:w-1/2`}
                  min={30}
                  max={365}
                />
                <FieldHint className="mt-1">{trFormat("Users must change their password every {days} days.", { days: config.passwordExpiryDays })}</FieldHint>
              </div>
            )}
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>{tr("Password History")}</h3>
            <Checkbox id="preventPasswordReuse" label={tr("Prevent Password Reuse")} checked={config.preventPasswordReuse} onChange={(checked) => handleChange('preventPasswordReuse', checked)} />
            <FieldHint indent>{tr("Stop users from reusing recent passwords.")}</FieldHint>
            {config.preventPasswordReuse && (
              <div className="ml-7 mt-3">
                <label className={labelClass}>{tr("Password History Count")}</label>
                <input
                  type="number"
                  value={config.passwordHistoryCount}
                  onChange={(e) => handleIntegerChange('passwordHistoryCount', e.target.value, 3, 24)}
                  className={`${inputClass} md:w-1/2`}
                  min={3}
                  max={24}
                />
                <FieldHint className="mt-1">{trFormat("The last {count} passwords cannot be used again.", { count: config.passwordHistoryCount })}</FieldHint>
              </div>
            )}
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>{tr("First Sign-In")}</h3>
            <Checkbox
              id="forcePasswordChangeOnFirstLogin"
              label={tr("Require Password Change on First Sign-In")}
              checked={config.forcePasswordChangeOnFirstLogin ?? true}
              onChange={(checked) => handleChange('forcePasswordChangeOnFirstLogin', checked)}
            />
            <FieldHint indent>{tr("A new account must replace its temporary password at the first sign-in.")}</FieldHint>
          </div>

          <PasswordPolicyTester config={config} />
        </div>
      )}

      {activeTab === 'sessions-accounts' && (
        <div className="space-y-6">
          <div>
            <h3 className={headingClass}>{tr("Session Timeout")}</h3>
            <Checkbox id="sessionTimeoutEnabled" label={tr("Enable Session Timeout")} checked={config.sessionTimeoutEnabled ?? true} onChange={(checked) => handleChange('sessionTimeoutEnabled', checked)} />
            <FieldHint indent>{tr("Locks idle sessions. The user unlocks with their password, and a verification code if they use one. Wrong entries count toward Account Lockout.")}</FieldHint>
            {(config.sessionTimeoutEnabled ?? true) && (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>{tr("Session Timeout (Minutes)")}</label>
                  <input
                    type="number"
                    value={config.sessionTimeoutMinutes}
                    onChange={(e) => handleSessionTimeoutChange(e.target.value)}
                    className={inputClass}
                    min={1}
                    max={1440}
                    step={1}
                  />
                  <p className="mt-1 text-xs text-slate-500">{tr("Minimum: 1 minute. Maximum: 1440 minutes.")}</p>
                </div>
              </div>
            )}
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>{tr("Concurrent Sessions")}</h3>
            <label className={labelClass}>{tr("Maximum Concurrent Sessions")}</label>
            <input
              type="number"
              value={config.maxConcurrentSessions ?? 0}
              onChange={(e) => handleIntegerChange('maxConcurrentSessions', e.target.value, 0, 10)}
              className={`${inputClass} md:w-1/2`}
              min={0}
              max={10}
            />
            <FieldHint className="mt-1">{tr("How many devices one account can use at the same time. When it signs in on one more, the oldest session ends and shows a notice. 1 means one device only. 0 means no limit.")}</FieldHint>
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>{tr("Two-Factor Authentication")}</h3>
            <Checkbox id="enable2FA" label={tr("Enforce Two-Factor Authentication (2FA)")} checked={config.enable2FA} onChange={(checked) => handleChange('enable2FA', checked)} />
            <FieldHint indent>{tr("Every user must set up 2FA (authenticator app or e-mail). To start with some users only, use Require Multifactor Authentication on their Security &amp; Authorization tab in Users.")}</FieldHint>
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>{tr("Account Lockout")}</h3>
            <Checkbox id="enableAccountLockout" label={tr("Enable Account Lockout")} checked={config.enableAccountLockout} onChange={(checked) => handleChange('enableAccountLockout', checked)} />
            <FieldHint indent>{tr("Locks an account after repeated wrong passwords or codes. Sign-in and signing are counted separately, each with its own limit.")}</FieldHint>
            {config.enableAccountLockout && (
              <>
              <div className="ml-7 mt-3">
                <label className={labelClass}>{tr("Maximum Login Attempts")}</label>
                <input
                  type="number"
                  value={config.maxLoginAttempts}
                  onChange={(e) => handleIntegerChange('maxLoginAttempts', e.target.value, 3, 10)}
                  className={`${inputClass} md:w-1/2`}
                  min={3}
                  max={10}
                />
                <FieldHint className="mt-1">{trFormat("Locked after {count} wrong passwords or codes in a row at sign-in or when unlocking a session. A correct sign-in resets the count. An administrator or a password reset restores access.", { count: config.maxLoginAttempts })}</FieldHint>
              </div>
              <div className="ml-7 mt-3">
                <label className={labelClass}>{tr("Maximum Signature Attempts")}</label>
                <input
                  type="number"
                  value={config.maxSignatureAttempts ?? 5}
                  onChange={(e) => handleIntegerChange('maxSignatureAttempts', e.target.value, 3, 10)}
                  className={`${inputClass} md:w-1/2`}
                  min={3}
                  max={10}
                />
                <FieldHint className="mt-1">{trFormat("Counted apart from sign-in. Locked after {count} wrong passwords in a row when signing. A correct signature resets the count.", { count: config.maxSignatureAttempts ?? 5 })}</FieldHint>
              </div>
              </>
            )}
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>{tr("Inactive Accounts")}</h3>
            <label className={labelClass}>{tr("Flag accounts without a sign-in for (days)")}</label>
            <input
              type="number"
              value={config.inactiveAccountDays ?? 90}
              onChange={(e) => handleIntegerChange('inactiveAccountDays', e.target.value, 0, 3650)}
              className={`${inputClass} md:w-1/2`}
              min={0}
              max={3650}
            />
            <FieldHint className="mt-1">{tr("Accounts with no sign-in for this many days are marked Inactive in Access Review (a new account counts from its creation). Nothing is suspended automatically. 0 turns it off.")}</FieldHint>
          </div>
        </div>
      )}

      {activeTab === 'network-access' && networkPanel}

      {activeTab === 'history' && <ConfigHistory page="security" />}
    </ConfigTabs>
  );
};
