import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Mail, Clock3, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button/Button';
import { cn } from '@/components/ui/utils';
import { AlertModal } from '@/components/ui/modal/AlertModal';
import { Switch } from '@/components/ui';
import { FormSection } from '@/components/ui/form/FormSection';
import { authApi } from '@/services/api/auth';
import { useAuth } from '@/contexts/AuthContext';
import { IconCheck } from '@tabler/icons-react';

const OTP_LENGTH = 6;

interface SecuritySettingsTabProps {
  onRegisterSaveHandler?: ((handler: (() => Promise<void>) | null) => void);
}

export const SecuritySettingsTab: React.FC<SecuritySettingsTabProps> = ({ onRegisterSaveHandler }) => {
  const { user, updateUser } = useAuth();

  const [persistedAppMfaEnabled, setPersistedAppMfaEnabled] = useState(user?.mfaEnabled || false);
  const [appMfaEnabled, setAppMfaEnabled] = useState(user?.mfaEnabled || false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  const handleCopySecret = async () => {
    const textToCopy = setupData?.secret || '';
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    }
  };
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [setupError, setSetupError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableError, setDisableError] = useState('');


  const [persistedEmailFallbackEnabled, setPersistedEmailFallbackEnabled] = useState(user?.mfaEmailFallbackEnabled !== false);
  const [emailFallbackEnabled, setEmailFallbackEnabled] = useState(user?.mfaEmailFallbackEnabled !== false);
  const [persistedRememberDeviceEnabled, setPersistedRememberDeviceEnabled] = useState(user?.mfaRememberDeviceEnabled !== false);
  const [rememberDeviceEnabled, setRememberDeviceEnabled] = useState(user?.mfaRememberDeviceEnabled !== false);

  useEffect(() => {
    const nextAppEnabled = user?.mfaEnabled || false;
    const nextEmailFallbackEnabled = user?.mfaEmailFallbackEnabled !== false;
    const nextRememberDeviceEnabled = user?.mfaRememberDeviceEnabled !== false;

    setPersistedAppMfaEnabled(nextAppEnabled);
    setAppMfaEnabled(nextAppEnabled);
    setPersistedEmailFallbackEnabled(nextEmailFallbackEnabled);
    setEmailFallbackEnabled(nextEmailFallbackEnabled);
    setPersistedRememberDeviceEnabled(nextRememberDeviceEnabled);
    setRememberDeviceEnabled(nextRememberDeviceEnabled);

    setEnrollOpen(false);
    setSetupData(null);
    setSetupCode('');
    setSetupError('');
    setResetConfirmOpen(false);
    setDisablePassword('');
    setDisableError('');
  }, [user?.mfaEnabled]);

  useEffect(() => {
    setPersistedEmailFallbackEnabled(user?.mfaEmailFallbackEnabled !== false);
    setEmailFallbackEnabled(user?.mfaEmailFallbackEnabled !== false);
    setPersistedRememberDeviceEnabled(user?.mfaRememberDeviceEnabled !== false);
    setRememberDeviceEnabled(user?.mfaRememberDeviceEnabled !== false);
  }, [user?.mfaEmailFallbackEnabled, user?.mfaRememberDeviceEnabled]);

  const handleEmailFallbackToggle = () => {
    setEmailFallbackEnabled((prev) => !prev);
  };

  const handleRememberDeviceToggle = () => {
    setRememberDeviceEnabled((prev) => !prev);
  };

  const enrollmentUri = useMemo(() => {
    return setupData?.qrCodeUrl || '';
  }, [setupData]);

  const handleSetupCodeChange = (value: string) => {
    const numericOnly = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setSetupCode(numericOnly);
    setSetupError('');
  };

  const handleSetupStart = async () => {
    setEnrollOpen(true);
    setSetupError('');
    setSetupCode('');
    setIsSaving(true);
    try {
      const data = await authApi.setupMFA();
      setSetupData(data);
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Unable to initialize MFA setup.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveChanges = useCallback(async () => {
    const pendingAppChange = appMfaEnabled !== persistedAppMfaEnabled;
    const pendingEmailFallbackChange = emailFallbackEnabled !== persistedEmailFallbackEnabled;
    const pendingRememberDeviceChange = rememberDeviceEnabled !== persistedRememberDeviceEnabled;

    if (!pendingAppChange && !pendingEmailFallbackChange && !pendingRememberDeviceChange) {
      return;
    }

    setIsSaving(true);
    try {
      const settingsPayload: {
        mfaEmailFallbackEnabled?: boolean;
        mfaRememberDeviceEnabled?: boolean;
      } = {};

      if (pendingEmailFallbackChange) {
        settingsPayload.mfaEmailFallbackEnabled = emailFallbackEnabled;
      }

      if (pendingRememberDeviceChange) {
        settingsPayload.mfaRememberDeviceEnabled = rememberDeviceEnabled;
      }

      if (Object.keys(settingsPayload).length > 0) {
        await authApi.updateMfaSettings(settingsPayload);
      }

      if (pendingAppChange) {
        if (appMfaEnabled) {
          if (setupCode.length < OTP_LENGTH || !setupData) {
            throw new Error('Complete authenticator setup before saving changes.');
          }
          await authApi.enableMFA({ otp: setupCode, method: 'app' });
        } else {
          if (!disablePassword.trim()) {
            throw new Error('Password is required to disable authenticator app.');
          }
          await authApi.disableMFA({ password: disablePassword });
        }
      }

      const refreshedUser = await authApi.getCurrentUser();
      updateUser(refreshedUser);
      setPersistedAppMfaEnabled(refreshedUser.mfaEnabled || false);
      setPersistedEmailFallbackEnabled(refreshedUser.mfaEmailFallbackEnabled !== false);
      setPersistedRememberDeviceEnabled(refreshedUser.mfaRememberDeviceEnabled !== false);
      setAppMfaEnabled(refreshedUser.mfaEnabled || false);
      setEmailFallbackEnabled(refreshedUser.mfaEmailFallbackEnabled !== false);
      setRememberDeviceEnabled(refreshedUser.mfaRememberDeviceEnabled !== false);
      setSetupCode('');
      setSetupData(null);
      setDisablePassword('');
      setResetConfirmOpen(false);
      setEnrollOpen(false);
    } finally {
      setIsSaving(false);
    }
  }, [
    appMfaEnabled,
    disablePassword,
    emailFallbackEnabled,
    persistedAppMfaEnabled,
    persistedEmailFallbackEnabled,
    persistedRememberDeviceEnabled,
    rememberDeviceEnabled,
    setupCode,
    setupData,
    updateUser,
  ]);

  useEffect(() => {
    onRegisterSaveHandler?.(saveChanges);
    return () => {
      onRegisterSaveHandler?.(null);
    };
  }, [onRegisterSaveHandler, saveChanges]);

  const stageAppMfaEnabled = useCallback(() => {
    setAppMfaEnabled(true);
    setEnrollOpen(false);
    setDisableError('');
    setSetupError('');
  }, []);

  const stageAppMfaDisabled = useCallback(() => {
    setAppMfaEnabled(false);
    setResetConfirmOpen(false);
    setDisablePassword('');
    setDisableError('');
  }, []);

  useEffect(() => {
    if (appMfaEnabled) {
      // keep any staged setup information until save
    }
  }, [appMfaEnabled]);

  useEffect(() => {
    if (!appMfaEnabled) {
      setSetupError('');
    }
  }, [appMfaEnabled]);

  const handleEnableAppMfaDraft = () => {
    if (setupCode.length < OTP_LENGTH) {
      setSetupError('Please enter a valid 6-digit authenticator code.');
      return;
    }

    setSetupError('');
    stageAppMfaEnabled();
  };

  const handleDisableMfaDraft = () => {
    if (!disablePassword.trim()) {
      setDisableError('Password is required');
      return;
    }

    stageAppMfaDisabled();
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {user?.mfaSetupRequired && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">2FA Policy: Required</p>
          <p className="mt-1 text-xs text-amber-800">
            Multi-factor authentication is mandatory for all users. You must configure and enable a verification method before proceeding.
          </p>
        </div>
      )}

      <FormSection
        title="Authenticator App and Fallback"
        icon={<ShieldCheck className="h-4 w-4" />}
      >
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-3 py-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">App MFA status</p>
              <p className="mt-1 text-xs text-slate-500">
                Recommended primary method for secure and reliable verification.
              </p>
            </div>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                appMfaEnabled
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-50 text-slate-600'
              )}
            >
              {appMfaEnabled ? 'Enabled' : 'Not enabled'}
            </span>
          </div>

          {!appMfaEnabled ? (
            <div className="space-y-3">
              <Button type="button" size="sm" onClick={handleSetupStart} disabled={isSaving}>
                {enrollOpen ? 'Refresh Setup' : 'Setup Authenticator App'}
              </Button>

              {enrollOpen && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[120px_1fr] md:items-start">
                    <div className="flex justify-center rounded-lg border border-emerald-100 bg-white p-2">
                      {enrollmentUri ? (
                        <QRCodeSVG value={enrollmentUri} size={96} />
                      ) : (
                        <div className="h-24 w-24 bg-slate-100 animate-pulse rounded flex items-center justify-center text-xs text-slate-400">
                          Loading QR...
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-900">
                          1. Scan QR with Google Authenticator, Microsoft Authenticator, or Authy.
                        </p>
                        {setupData?.secret && (
                          <div className="flex flex-col gap-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <p className="text-xs font-bold text-slate-700">Secret Key (Manual Entry)</p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 bg-white px-2.5 py-1.5 rounded border border-slate-200 text-xs font-semibold text-slate-900 break-all select-all select-text">
                                {setupData.secret}
                              </code>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleCopySecret}
                                className="h-8 px-2.5 flex items-center justify-center gap-1 border-slate-300 hover:border-slate-400 hover:bg-slate-100 text-slate-600 transition-colors shrink-0"
                                title="Copy Secret Key"
                              >
                                {secretCopied ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    <span className="text-xs font-semibold text-emerald-700">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold text-slate-600">Copy</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 pt-1">
                        <p className="text-sm font-semibold text-slate-900">
                          2. Enter the 6-digit code to complete setup.
                        </p>

                        <div className="space-y-1.5 max-w-[240px]">
                          <label htmlFor="setup-otp" className="block text-xs font-bold text-slate-700">
                            Verification Code
                          </label>
                          <input
                            id="setup-otp"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={setupCode}
                            onChange={(e) => handleSetupCodeChange(e.target.value)}
                            className={cn(
                              'h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-700 outline-none transition-all focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500',
                              setupError ? 'border-red-300' : 'border-slate-300'
                            )}
                            placeholder="Enter 6-digit code"
                            maxLength={6}
                          />
                          {setupError && <p className="text-xs font-medium text-red-600 mt-1">{setupError}</p>}
                        </div>

                        <Button type="button" size="sm" onClick={handleEnableAppMfaDraft} disabled={isSaving || setupCode.length < 6}>
                          Confirm and Enable
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" size="sm" variant="outline-emerald" onClick={() => setResetConfirmOpen(true)}>
                Disable Authenticator App
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <Mail className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Email OTP fallback</p>
                <p className="text-xs text-slate-500">Used when authenticator app is unavailable.</p>
              </div>
            </div>
            <Switch
              checked={emailFallbackEnabled}
              onChange={handleEmailFallbackToggle}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <Clock3 className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Remember this device</p>
                <p className="text-xs text-slate-500">Skip MFA on trusted device for 8 hours.</p>
              </div>
            </div>
              <Switch
              checked={rememberDeviceEnabled}
              onChange={() => handleRememberDeviceToggle()}
              disabled={isSaving}
            />
          </div>

        </div>
      </FormSection>

      <AlertModal
        isOpen={resetConfirmOpen}
        onClose={() => {
          setResetConfirmOpen(false);
          setDisablePassword('');
          setDisableError('');
        }}
        onConfirm={handleDisableMfaDraft}
        type="warning"
        title="Disable Authenticator App?"
        isLoading={isSaving}
        description={
          <div className="space-y-3 mt-2">
            <p className="text-sm text-slate-600">
              This will remove your current authenticator app setup. You will need to re-enroll to use it for MFA. Your email OTP fallback will remain active.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="disable-pwd" className="block text-xs font-semibold text-slate-700">
                Confirm your password to disable
              </label>
              <input
                id="disable-pwd"
                type="password"
                value={disablePassword}
                onChange={(e) => {
                  setDisablePassword(e.target.value);
                  setDisableError('');
                }}
                className={cn(
                  "w-full h-9 px-3 text-sm border bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500",
                  disableError ? "border-red-300" : "border-slate-300"
                )}
                placeholder="Enter password"
              />
              {disableError && <p className="text-xs font-medium text-red-600">{disableError}</p>}
            </div>
          </div>
        }
        confirmText="Disable"
        cancelText="Cancel"
      />
    </div>
  );
};
