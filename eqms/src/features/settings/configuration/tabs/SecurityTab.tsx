import React from 'react';
import { FormSection } from '@/components/ui/form/FormSection';
import { SecurityConfig } from '../types';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { Clock, Shield } from 'lucide-react';
import { IconKey } from '@tabler/icons-react';

interface SecurityTabProps {
  config: SecurityConfig;
  onChange: (config: SecurityConfig) => void;
}


export const SecurityTab: React.FC<SecurityTabProps> = ({ config, onChange }) => {
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
    <div className="p-4 md:p-5 space-y-4">
      {/* Password Requirements */}
      <FormSection title="Password Requirements" icon={<IconKey className="h-4 w-4" />}>
        <div className="space-y-5">
          <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Length</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              Minimum Password Length
            </label>
            <input
              type="number"
              value={config.passwordMinLength}
              onChange={(e) => handleIntegerChange('passwordMinLength', e.target.value, 8, 128)}
              className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              min={8}
              max={128}
            />
            <p className="text-xs text-slate-500 mt-1">
              Minimum: 8 characters
            </p>
          </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Required Characters</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Checkbox
            id="requireUppercase"
            label="Require Uppercase Letters (A-Z)"
            checked={config.requireUppercase}
            onChange={(checked) => handleChange('requireUppercase', checked)}
          />
          <Checkbox
            id="requireLowercase"
            label="Require Lowercase Letters (a-z)"
            checked={config.requireLowercase}
            onChange={(checked) => handleChange('requireLowercase', checked)}
          />
          <Checkbox
            id="requireSpecialChars"
            label="Require Special Characters (@, #, $, etc.)"
            checked={config.requireSpecialChars}
            onChange={(checked) => handleChange('requireSpecialChars', checked)}
          />
          <Checkbox
            id="requireNumbers"
            label="Require Numbers (0-9)"
            checked={config.requireNumbers}
            onChange={(checked) => handleChange('requireNumbers', checked)}
          />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Not Allowed</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Checkbox
            id="disallowWhitespace"
            label="Disallow Spaces"
            checked={config.disallowWhitespace ?? false}
            onChange={(checked) => handleChange('disallowWhitespace', checked)}
          />
          <Checkbox
            id="disallowSequentialChars"
            label="Disallow Sequences (abc, 123, cba)"
            checked={config.disallowSequentialChars ?? false}
            onChange={(checked) => handleChange('disallowSequentialChars', checked)}
          />
          <Checkbox
            id="disallowCommonPasswords"
            label="Disallow Commonly Used Passwords"
            checked={config.disallowCommonPasswords ?? false}
            onChange={(checked) => handleChange('disallowCommonPasswords', checked)}
          />
          <Checkbox
            id="disallowUserInfo"
            label="Disallow Username, E-mail or Name in Password"
            checked={config.disallowUserInfo ?? false}
            onChange={(checked) => handleChange('disallowUserInfo', checked)}
          />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Complexity Limits</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              Minimum Unique Characters
            </label>
            <input
              type="number"
              value={config.minUniqueChars ?? 0}
              onChange={(e) => handleIntegerChange('minUniqueChars', e.target.value, 0, 64)}
              className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              min={0}
              max={64}
            />
            <p className="text-xs text-slate-500 mt-1">Number of different characters required. 0 = not enforced.</p>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              Maximum Repeated Characters in a Row
            </label>
            <input
              type="number"
              value={config.maxRepeatedChars ?? 0}
              onChange={(e) => handleIntegerChange('maxRepeatedChars', e.target.value, 0, 10)}
              className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              min={0}
              max={10}
            />
            <p className="text-xs text-slate-500 mt-1">E.g. 2 rejects "aaa". 0 = not enforced.</p>
          </div>
            </div>
          </div>
        </div>
      </FormSection>

      {/* Password Lifecycle */}
      <FormSection title="Password Expiry & History" icon={<Clock className="h-4 w-4" />}>
        <div className="space-y-4">
          <div>
            <Checkbox
              id="enablePasswordExpiry"
              label="Enable Password Expiration"
              checked={config.enablePasswordExpiry}
              onChange={(checked) => handleChange('enablePasswordExpiry', checked)}
            />
            <p className="text-xs text-slate-500 ml-7">
              Force users to change their password periodically
            </p>
          </div>
          {config.enablePasswordExpiry && (
            <div className="ml-7">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                Password Expiry Period (Days)
              </label>
              <input
                type="number"
                value={config.passwordExpiryDays}
                onChange={(e) => handleIntegerChange('passwordExpiryDays', e.target.value, 30, 365)}
                className="w-full md:w-64 h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                min={30}
                max={365}
              />
              <p className="text-xs text-slate-500 mt-1">
                Users must change password every {config.passwordExpiryDays} days
              </p>
            </div>
          )}

          <div className="pt-2">
            <Checkbox
              id="preventPasswordReuse"
              label="Prevent Password Reuse"
              checked={config.preventPasswordReuse}
              onChange={(checked) => handleChange('preventPasswordReuse', checked)}
            />
            <p className="text-xs text-slate-500 ml-7">
              Prevent users from reusing recent passwords
            </p>
            {config.preventPasswordReuse && (
              <div className="ml-7 mt-3">
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                  Password History Count
                </label>
                <input
                  type="number"
                  value={config.passwordHistoryCount}
                onChange={(e) => handleIntegerChange('passwordHistoryCount', e.target.value, 3, 24)}
                  className="w-full md:w-64 h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  min={3}
                  max={24}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Remember last {config.passwordHistoryCount} passwords and prevent reuse
                </p>
              </div>
            )}
          </div>
          <div className="pt-2">
            <Checkbox
              id="forcePasswordChangeOnFirstLogin"
              label="Require Password Change on First Sign-In"
              checked={config.forcePasswordChangeOnFirstLogin ?? true}
              onChange={(checked) => handleChange('forcePasswordChangeOnFirstLogin', checked)}
            />
            <p className="text-xs text-slate-500 ml-7">
              New accounts created by an administrator must replace their temporary password when signing in for the first time.
            </p>
          </div>
        </div>
      </FormSection>

      {/* Session & Account Security */}
      <FormSection title="Session & Account Security" icon={<Shield className="h-4 w-4" />}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              Session Timeout (Minutes)
            </label>
            <input
              type="number"
              value={config.sessionTimeoutMinutes}
              onChange={(e) => handleSessionTimeoutChange(e.target.value)}
              className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              min={1}
              max={1440}
              step={1}
            />
            <p className="text-xs text-slate-500 mt-1">
              Minimum: 1 minute. Maximum: 1440 minutes.
            </p>
          </div>
          </div>

          <div>
            <Checkbox
              id="enable2FA"
              label="Enforce Two-Factor Authentication (2FA)"
              checked={config.enable2FA}
              onChange={(checked) => handleChange('enable2FA', checked)}
            />
            <p className="text-xs text-slate-500 ml-7">
              All users must set up 2FA (authenticator app or email). To require it for specific
              users before enabling it company-wide, use "Require Multifactor Authentication" on
              that user's Security &amp; Authorization tab in Settings &gt; Users -- a per-user
              requirement only adds to this setting, never exempts a user from it.
            </p>
          </div>

          <div className="pt-2">
            <Checkbox
              id="enableAccountLockout"
              label="Enable Account Lockout"
              checked={config.enableAccountLockout}
              onChange={(checked) => handleChange('enableAccountLockout', checked)}
            />
            <p className="text-xs text-slate-500 ml-7">
              Lock user accounts after multiple failed login attempts
            </p>
            {config.enableAccountLockout && (
              <div className="ml-7 mt-3">
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                  Maximum Login Attempts
                </label>
                <input
                  type="number"
                  value={config.maxLoginAttempts}
                  onChange={(e) => handleIntegerChange('maxLoginAttempts', e.target.value, 3, 10)}
                  className="w-full md:w-64 h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  min={3}
                  max={10}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Account will be locked after {config.maxLoginAttempts} consecutive failed login attempts. An administrator or a verified password reset can restore access.
                </p>
              </div>
            )}
          </div>
        </div>
      </FormSection>

    </div>
  );
};
