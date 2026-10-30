import React, { useMemo, useState } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { evaluatePasswordPolicy } from '@/features/auth/passwordPolicyRules';
import type { SecurityConfig } from '../types';

const inputClass = 'w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500';

/**
 * Lets the administrator type a password and see at once which of the rules being edited it meets.
 * It uses the values on the screen (also those not saved yet); the server stays authoritative when a password is really set.
 * Nothing typed here is stored or sent anywhere.
 */
export const PasswordPolicyTester: React.FC<{ config: SecurityConfig }> = ({ config }) => {
  const [password, setPassword] = useState('');
  const [userInfo, setUserInfo] = useState('');
  const [visible, setVisible] = useState(false);

  const result = useMemo(() => {
    const tokens = userInfo.split(/[\s,;@.]+/).filter(Boolean);
    return evaluatePasswordPolicy(password, config, tokens);
  }, [password, userInfo, config]);

  return (
    <div className="border-t border-slate-100 pt-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Test a Password</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="password-policy-test" className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Password to Check</label>
          <div className="relative">
            <input
              id="password-policy-test"
              type={visible ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              spellCheck={false}
              placeholder="Type a password to test the rules above"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Hide password' : 'Show password'}
              className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:text-slate-600"
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">Uses the rules as shown on this screen, including changes not saved yet. Nothing typed here is stored.</p>
        </div>
        {config.disallowUserInfo && (
          <div>
            <label htmlFor="password-policy-test-user" className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Username, E-mail or Name</label>
            <input
              id="password-policy-test-user"
              type="text"
              value={userInfo}
              onChange={(e) => setUserInfo(e.target.value)}
              autoComplete="off"
              placeholder="e.g. nguyen.van.a@company.com"
              className={inputClass}
            />
            <p className="text-xs text-slate-500 mt-1">The password may not contain any part (3 characters or more) of this text.</p>
          </div>
        )}
      </div>

      {password.length > 0 && (
        <div className="mt-3 space-y-2" aria-live="polite">
          <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {result.checks.map((check) => (
              <li key={check.key} className={`flex items-center gap-2 text-xs sm:text-sm ${check.met ? 'text-emerald-700' : 'text-red-600'}`}>
                {check.met ? <Check className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />}
                {check.label}
              </li>
            ))}
          </ul>
          <p role="status" className={`text-sm font-semibold ${result.isValid ? 'text-emerald-700' : 'text-red-600'}`}>
            {result.isValid ? 'This password meets all the rules.' : `This password does not meet ${result.maxScore - result.score} of ${result.maxScore} rules.`}
          </p>
        </div>
      )}
    </div>
  );
};
