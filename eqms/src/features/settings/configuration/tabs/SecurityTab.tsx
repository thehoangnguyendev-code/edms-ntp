import React from 'react';
import { SecurityConfig } from '../types';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { IconKey, IconNetwork, IconShieldLock } from '@tabler/icons-react';
import { PasswordPolicyTester } from './PasswordPolicyTester';
import { ConfigTabs, HISTORY_TAB, changedTabs, revertFields } from './ConfigTabs';
import { ConfigHistory } from './ConfigHistory';
import type { SecurityTabId } from './securityTabs';

const ALL_TABS = [
  { id: 'password-rules', label: 'Password Rules', icon: IconKey },
  { id: 'sessions-accounts', label: 'Sessions & Accounts', icon: IconShieldLock },
  { id: 'network-access', label: 'Network Access', icon: IconNetwork },
  HISTORY_TAB,
] as const;

const FIELDS: Record<SecurityTabId, ReadonlyArray<string>> = {
  'password-rules': ['passwordMinLength', 'requireUppercase', 'requireLowercase', 'requireSpecialChars', 'requireNumbers', 'disallowWhitespace', 'disallowSequentialChars', 'disallowCommonPasswords', 'disallowUserInfo', 'minUniqueChars', 'maxRepeatedChars', 'enablePasswordExpiry', 'passwordExpiryDays', 'preventPasswordReuse', 'passwordHistoryCount', 'forcePasswordChangeOnFirstLogin'],
  'sessions-accounts': ['sessionTimeoutEnabled', 'sessionTimeoutMinutes', 'enable2FA', 'enableAccountLockout', 'maxLoginAttempts', 'inactiveAccountDays'],
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
      ariaLabel="Security sections"
      idPrefix="security"
    >
      {activeTab === 'password-rules' && (
        <div className="space-y-6">
          <div>
            <h3 className={headingClass}>Length</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Minimum Password Length</label>
                <input
                  type="number"
                  value={config.passwordMinLength}
                  onChange={(e) => handleIntegerChange('passwordMinLength', e.target.value, 8, 128)}
                  className={inputClass}
                  min={8}
                  max={128}
                />
                <p className="mt-1 text-xs text-slate-500">Minimum: 8 characters</p>
              </div>
            </div>
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>Required Characters</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Checkbox id="requireUppercase" label="Require Uppercase Letters (A-Z)" checked={config.requireUppercase} onChange={(checked) => handleChange('requireUppercase', checked)} />
              <Checkbox id="requireLowercase" label="Require Lowercase Letters (a-z)" checked={config.requireLowercase} onChange={(checked) => handleChange('requireLowercase', checked)} />
              <Checkbox id="requireSpecialChars" label="Require Special Characters (@, #, $, etc.)" checked={config.requireSpecialChars} onChange={(checked) => handleChange('requireSpecialChars', checked)} />
              <Checkbox id="requireNumbers" label="Require Numbers (0-9)" checked={config.requireNumbers} onChange={(checked) => handleChange('requireNumbers', checked)} />
            </div>
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>Not Allowed</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Checkbox id="disallowWhitespace" label="Disallow Spaces" checked={config.disallowWhitespace ?? false} onChange={(checked) => handleChange('disallowWhitespace', checked)} />
              <Checkbox id="disallowSequentialChars" label="Disallow Sequences (abc, 123, cba)" checked={config.disallowSequentialChars ?? false} onChange={(checked) => handleChange('disallowSequentialChars', checked)} />
              <Checkbox id="disallowCommonPasswords" label="Disallow Commonly Used Passwords" checked={config.disallowCommonPasswords ?? false} onChange={(checked) => handleChange('disallowCommonPasswords', checked)} />
              <Checkbox id="disallowUserInfo" label="Disallow Username, E-mail or Name in Password" checked={config.disallowUserInfo ?? false} onChange={(checked) => handleChange('disallowUserInfo', checked)} />
            </div>
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>Complexity Limits</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Minimum Unique Characters</label>
                <input
                  type="number"
                  value={config.minUniqueChars ?? 0}
                  onChange={(e) => handleIntegerChange('minUniqueChars', e.target.value, 0, 64)}
                  className={inputClass}
                  min={0}
                  max={64}
                />
                <p className="mt-1 text-xs text-slate-500">Number of different characters required. 0 = not enforced.</p>
              </div>
              <div>
                <label className={labelClass}>Maximum Repeated Characters in a Row</label>
                <input
                  type="number"
                  value={config.maxRepeatedChars ?? 0}
                  onChange={(e) => handleIntegerChange('maxRepeatedChars', e.target.value, 0, 10)}
                  className={inputClass}
                  min={0}
                  max={10}
                />
                <p className="mt-1 text-xs text-slate-500">E.g. 2 rejects "aaa". 0 = not enforced.</p>
              </div>
            </div>
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>Password Expiration</h3>
            <Checkbox id="enablePasswordExpiry" label="Enable Password Expiration" checked={config.enablePasswordExpiry} onChange={(checked) => handleChange('enablePasswordExpiry', checked)} />
            <p className="ml-7 text-xs text-slate-500">Force users to change their password periodically</p>
            {config.enablePasswordExpiry && (
              <div className="ml-7 mt-3">
                <label className={labelClass}>Password Expiry Period (Days)</label>
                <input
                  type="number"
                  value={config.passwordExpiryDays}
                  onChange={(e) => handleIntegerChange('passwordExpiryDays', e.target.value, 30, 365)}
                  className={`${inputClass} md:w-1/2`}
                  min={30}
                  max={365}
                />
                <p className="mt-1 text-xs text-slate-500">Users must change password every {config.passwordExpiryDays} days</p>
              </div>
            )}
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>Password History</h3>
            <Checkbox id="preventPasswordReuse" label="Prevent Password Reuse" checked={config.preventPasswordReuse} onChange={(checked) => handleChange('preventPasswordReuse', checked)} />
            <p className="ml-7 text-xs text-slate-500">Prevent users from reusing recent passwords</p>
            {config.preventPasswordReuse && (
              <div className="ml-7 mt-3">
                <label className={labelClass}>Password History Count</label>
                <input
                  type="number"
                  value={config.passwordHistoryCount}
                  onChange={(e) => handleIntegerChange('passwordHistoryCount', e.target.value, 3, 24)}
                  className={`${inputClass} md:w-1/2`}
                  min={3}
                  max={24}
                />
                <p className="mt-1 text-xs text-slate-500">Remember last {config.passwordHistoryCount} passwords and prevent reuse</p>
              </div>
            )}
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>First Sign-In</h3>
            <Checkbox
              id="forcePasswordChangeOnFirstLogin"
              label="Require Password Change on First Sign-In"
              checked={config.forcePasswordChangeOnFirstLogin ?? true}
              onChange={(checked) => handleChange('forcePasswordChangeOnFirstLogin', checked)}
            />
            <p className="ml-7 text-xs text-slate-500">
              New accounts created by an administrator must replace their temporary password when signing in for the first time.
            </p>
          </div>

          <PasswordPolicyTester config={config} />
        </div>
      )}

      {activeTab === 'sessions-accounts' && (
        <div className="space-y-6">
          <div>
            <h3 className={headingClass}>Session Timeout</h3>
            <Checkbox id="sessionTimeoutEnabled" label="Enable Session Timeout" checked={config.sessionTimeoutEnabled ?? true} onChange={(checked) => handleChange('sessionTimeoutEnabled', checked)} />
            <p className="ml-7 text-xs text-slate-500">Lock inactive sessions for all users. A locked session is unlocked with the same steps as signing in: the password, then the verification code when the account uses a second factor. A wrong password or code counts toward Account Lockout and is recorded in the Audit Trail.</p>
            {(config.sessionTimeoutEnabled ?? true) && (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Session Timeout (Minutes)</label>
                  <input
                    type="number"
                    value={config.sessionTimeoutMinutes}
                    onChange={(e) => handleSessionTimeoutChange(e.target.value)}
                    className={inputClass}
                    min={1}
                    max={1440}
                    step={1}
                  />
                  <p className="mt-1 text-xs text-slate-500">Minimum: 1 minute. Maximum: 1440 minutes.</p>
                </div>
              </div>
            )}
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>Two-Factor Authentication</h3>
            <Checkbox id="enable2FA" label="Enforce Two-Factor Authentication (2FA)" checked={config.enable2FA} onChange={(checked) => handleChange('enable2FA', checked)} />
            <p className="ml-7 text-xs text-slate-500">
              All users must set up 2FA (authenticator app or email). To require it for specific
              users before enabling it company-wide, use "Require Multifactor Authentication" on
              that user's Security &amp; Authorization tab in Settings &gt; Users -- a per-user
              requirement only adds to this setting, never exempts a user from it.
            </p>
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>Account Lockout</h3>
            <Checkbox id="enableAccountLockout" label="Enable Account Lockout" checked={config.enableAccountLockout} onChange={(checked) => handleChange('enableAccountLockout', checked)} />
            <p className="ml-7 text-xs text-slate-500">Lock user accounts after multiple failed login attempts</p>
            {config.enableAccountLockout && (
              <div className="ml-7 mt-3">
                <label className={labelClass}>Maximum Login Attempts</label>
                <input
                  type="number"
                  value={config.maxLoginAttempts}
                  onChange={(e) => handleIntegerChange('maxLoginAttempts', e.target.value, 3, 10)}
                  className={`${inputClass} md:w-1/2`}
                  min={3}
                  max={10}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Account will be locked after {config.maxLoginAttempts} consecutive failed login attempts. An administrator or a verified password reset can restore access.
                </p>
              </div>
            )}
          </div>

          <div className={groupClass}>
            <h3 className={headingClass}>Inactive Accounts</h3>
            <label className={labelClass}>Flag accounts without a sign-in for (days)</label>
            <input
              type="number"
              value={config.inactiveAccountDays ?? 90}
              onChange={(e) => handleIntegerChange('inactiveAccountDays', e.target.value, 0, 3650)}
              className={`${inputClass} md:w-1/2`}
              min={0}
              max={3650}
            />
            <p className="mt-1 text-xs text-slate-500">
              An account that has not signed in for this many days (counted from its creation when it never did) is marked Inactive in Access Review, so the reviewer can decide to keep or withdraw its access. It is only a flag: the system never suspends an account by itself. 0 switches the flag off.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'network-access' && networkPanel}

      {activeTab === 'history' && <ConfigHistory page="security" />}
    </ConfigTabs>
  );
};
