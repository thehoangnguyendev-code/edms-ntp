import React, { useEffect, useState } from 'react';
import { FormSection } from '@/components/ui/form/FormSection';
import { Server, Eye, EyeOff } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { Button } from '@/components/ui/button/Button';
import { useToast } from '@/components/ui/toast/Toast';
import { settingsApi } from '@/services/api/settings';
import { OnlyOfficeStorageConfig } from '../types';

interface OnlyOfficeTabProps {
  onlyOfficeConfig: OnlyOfficeStorageConfig;
  onOnlyOfficeChange: (config: OnlyOfficeStorageConfig) => void;
  onOnlyOfficeValidationChange?: (isValid: boolean) => void;
  embedded?: boolean;
}


/**
 * Admin config screen for the OnlyOffice Document Server provider -- the self-hosted counterpart
 * to OfficeOnlineTab.tsx (Microsoft Graph). Which provider is active is chosen by the segmented
 * control above both tabs in ConfigurationView.tsx (`EditOnlineProviderSelector`), which shows
 * only the selected provider's card -- this component only renders its own settings, unaware of
 * the other provider.
 */
export const OnlyOfficeTab: React.FC<OnlyOfficeTabProps> = ({
  onlyOfficeConfig,
  onOnlyOfficeChange,
  onOnlyOfficeValidationChange,
  embedded = false,
}) => {
  const { showToast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showJwtSecret, setShowJwtSecret] = useState(false);
  const [isReplacingJwtSecret, setIsReplacingJwtSecret] = useState(false);

  const handleFieldChange = (key: keyof OnlyOfficeStorageConfig, value: any) => {
    onOnlyOfficeChange({
      ...onlyOfficeConfig,
      [key]: value,
      ...(key !== 'clearJwtSecret' ? { clearJwtSecret: false } : {}),
    });
  };

  const handleResetJwtSecret = () => {
    onOnlyOfficeChange({
      ...onlyOfficeConfig,
      jwtSecret: '',
      jwtSecretConfigured: false,
      jwtSecretMasked: '',
      clearJwtSecret: true,
    });
    setIsReplacingJwtSecret(false);
  };

  const hasStoredJwtSecret = Boolean(
    onlyOfficeConfig.jwtSecretConfigured && !onlyOfficeConfig.clearJwtSecret && !onlyOfficeConfig.jwtSecret?.trim(),
  );
  const isStoredJwtSecretPreview = hasStoredJwtSecret && !isReplacingJwtSecret;

  useEffect(() => {
    const nextErrors: Record<string, string> = {};
    if (onlyOfficeConfig.enabled) {
      if (!onlyOfficeConfig.documentServerUrl?.trim()) {
        nextErrors.documentServerUrl = 'Document Server URL is required.';
      } else {
        try {
          new URL(onlyOfficeConfig.documentServerUrl);
        } catch {
          nextErrors.documentServerUrl = 'Document Server URL must be a valid URL.';
        }
      }
      const hasExistingSecret = Boolean(onlyOfficeConfig.jwtSecretConfigured && !onlyOfficeConfig.clearJwtSecret);
      const hasNewSecret = (onlyOfficeConfig.jwtSecret || '').trim().length > 0;
      if (!hasExistingSecret && !hasNewSecret) {
        nextErrors.jwtSecret = 'JWT Secret is required (must match the onlyoffice-documentserver container\'s JWT_SECRET).';
      }
    }
    setErrors(nextErrors);
    onOnlyOfficeValidationChange?.(Object.keys(nextErrors).length === 0);
  }, [onlyOfficeConfig, onOnlyOfficeValidationChange]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const result = await settingsApi.testOnlyOfficeConnection();
      showToast({
        type: result.success ? 'success' : 'error',
        title: result.success ? 'Connection successful' : 'Connection failed',
        message: result.message,
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Connection failed',
        message: error instanceof Error ? error.message : 'Unable to reach the OnlyOffice Document Server.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const renderFieldError = (key: string) => (errors[key] ? <p className="text-xs text-red-600 mt-1">{errors[key]}</p> : null);

  return (
    <div className={embedded ? 'px-4 pb-4 md:px-5 md:pb-5' : 'p-4 md:p-5 space-y-4'}>
      <FormSection title="OnlyOffice Document Server" icon={<Server className="h-4 w-4" />}>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">OnlyOffice Document Server</h4>
            </div>
            <Checkbox
              id="enableOnlyOffice"
              label="Enable"
              checked={!!onlyOfficeConfig.enabled}
              onChange={(checked) => handleFieldChange('enabled', checked)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                Document Server URL (browser-reachable)
              </label>
              <input
                type="text"
                value={onlyOfficeConfig.documentServerUrl || ''}
                onChange={(e) => handleFieldChange('documentServerUrl', e.target.value)}
                className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="http://localhost:8082"
              />
              {renderFieldError('documentServerUrl')}
              <p className="mt-1 text-xs text-slate-500">
                Matches the frontend's VITE_ONLYOFFICE_URL -- the address the browser loads the editor script from.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">JWT Secret</label>
              <div className="relative">
                <input
                  type={showJwtSecret ? 'text' : 'password'}
                  value={isStoredJwtSecretPreview ? 'Stored secret configured' : onlyOfficeConfig.jwtSecret || ''}
                  onChange={(e) => handleFieldChange('jwtSecret', e.target.value)}
                  readOnly={isStoredJwtSecretPreview}
                  className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder={isReplacingJwtSecret ? 'Enter a replacement secret' : 'Must match the onlyoffice-documentserver JWT_SECRET env var'}
                />
                <button
                  type="button"
                  onClick={() => setShowJwtSecret(!showJwtSecret)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showJwtSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {renderFieldError('jwtSecret')}
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                {isStoredJwtSecretPreview && (
                  <Button type="button" variant="outline-emerald" size="sm" onClick={() => setIsReplacingJwtSecret(true)}>
                    Replace Secret
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline-emerald"
                  size="sm"
                  onClick={handleResetJwtSecret}
                  disabled={!onlyOfficeConfig.jwtSecretConfigured && !onlyOfficeConfig.jwtSecret}
                >
                  Reset Secret
                </Button>
              </div>
            </div>

          </div>

          <div className="flex justify-end mt-4">
            <Button type="button" variant="outline-emerald" onClick={handleTestConnection} disabled={isTesting} size="sm">
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        </div>
      </FormSection>
    </div>
  );
};
