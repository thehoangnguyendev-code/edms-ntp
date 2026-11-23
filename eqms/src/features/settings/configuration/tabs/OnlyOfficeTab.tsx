import React, { useEffect, useState } from 'react';
import { IconEye, IconEyeOff, IconKey, IconPlugConnected, IconRefresh, IconStack2, IconInfoCircle } from '@tabler/icons-react';
import { CONTROL_STATE_CLASSES } from '@/components/ui/controlState';
import { Badge } from '@/components/ui/badge/Badge';
import { Button } from '@/components/ui/button/Button';
import { CopyButton } from '@/components/ui/button/CopyButton';
import { Collapsible } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch/Switch';
import { useToast } from '@/components/ui/toast/Toast';
import { settingsApi } from '@/services/api/settings';
import { formatDateTime } from '@/utils/format';
import { OnlyOfficeStorageConfig } from '../types';
import type { IntegrationChecksController } from '../useIntegrationChecks';
import { IntegrationSectionCard } from './IntegrationSectionCard';
import { IntegrationStatusCard } from './IntegrationStatusCard';
import { tr, trFormat } from "@/i18n";

interface OnlyOfficeTabProps {
  onlyOfficeConfig: OnlyOfficeStorageConfig;
  onOnlyOfficeChange: (config: OnlyOfficeStorageConfig) => void;
  onOnlyOfficeValidationChange?: (isValid: boolean) => void;
  /** What was last saved. "Test connection" tests this, never the draft, so the tab says so while the two differ. */
  savedOnlyOffice?: OnlyOfficeStorageConfig;
  /** The last "Test connection" result of each integration, kept by the server. */
  checks: IntegrationChecksController;
}

const INPUT_CLASS = 'w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500';
const LABEL_CLASS = 'block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize';

/** A random secret of 32 bytes, base64url: long enough for the HS256 signing the Document Server and this application share. */
export const generateJwtSecret = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Whether the draft differs from what is saved in a way that the connection test (which reads the saved settings) would not see. */
export const hasUnsavedConnectionChange = (draft: OnlyOfficeStorageConfig, saved: OnlyOfficeStorageConfig | undefined): boolean => {
  if (!saved) return false;
  return Boolean(draft.enabled) !== Boolean(saved.enabled)
    || (draft.documentServerUrl || '').trim() !== (saved.documentServerUrl || '').trim()
    || (draft.jwtSecret || '').trim().length > 0
    || Boolean(draft.clearJwtSecret);
};

/**
 * Admin config screen for the OnlyOffice Document Server provider: the status of the server (what the last test found), the switch and the address, the JWT secret, and the
 * values that have to be the same on the Document Server's side. "Test connection" tests the saved settings; the tab says so while there are changes that are not saved.
 */
export const OnlyOfficeTab: React.FC<OnlyOfficeTabProps> = ({
  onlyOfficeConfig,
  onOnlyOfficeChange,
  onOnlyOfficeValidationChange,
  savedOnlyOffice,
  checks,
}) => {
  const { showToast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showJwtSecret, setShowJwtSecret] = useState(false);
  const [isReplacingJwtSecret, setIsReplacingJwtSecret] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState(false);

  const handleFieldChange = (key: keyof OnlyOfficeStorageConfig, value: any) => {
    if (key === 'jwtSecret') setGeneratedSecret(false);
    onOnlyOfficeChange({
      ...onlyOfficeConfig,
      [key]: value,
      ...(key !== 'clearJwtSecret' ? { clearJwtSecret: false } : {}),
    });
  };

  const handleResetJwtSecret = () => {
    setGeneratedSecret(false);
    onOnlyOfficeChange({
      ...onlyOfficeConfig,
      jwtSecret: '',
      jwtSecretConfigured: false,
      jwtSecretMasked: '',
      clearJwtSecret: true,
    });
    setIsReplacingJwtSecret(false);
  };

  const handleGenerateJwtSecret = () => {
    setGeneratedSecret(true);
    setIsReplacingJwtSecret(true);
    setShowJwtSecret(true);
    onOnlyOfficeChange({ ...onlyOfficeConfig, jwtSecret: generateJwtSecret(), clearJwtSecret: false });
  };

  const hasStoredJwtSecret = Boolean(
    onlyOfficeConfig.jwtSecretConfigured && !onlyOfficeConfig.clearJwtSecret && !onlyOfficeConfig.jwtSecret?.trim(),
  );
  const isStoredJwtSecretPreview = hasStoredJwtSecret && !isReplacingJwtSecret;
  const hasNewJwtSecret = (onlyOfficeConfig.jwtSecret || '').trim().length > 0;

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
        title: tr('Connection failed'),
        message: error instanceof Error ? error.message : 'Unable to reach the OnlyOffice Document Server.',
      });
    } finally {
      setIsTesting(false);
      // the server keeps what this test found, so the card shows it after the toast is gone
      void checks.reload();
    }
  };

  const renderFieldError = (key: string) => (errors[key] ? <p className="mt-1 text-xs text-red-600">{errors[key]}</p> : null);

  const saved = savedOnlyOffice ?? onlyOfficeConfig;
  const unsaved = hasUnsavedConnectionChange(onlyOfficeConfig, savedOnlyOffice);
  const savedUrl = (saved.documentServerUrl || '').trim();
  const secretChangedAt = onlyOfficeConfig.jwtSecretChangedAt;

  const statusCard = (
    <IntegrationStatusCard
      icon={<IconStack2 className="h-5 w-5" />}
      title={tr("OnlyOffice Document Server")}
      subtitle={savedUrl || 'No Document Server URL saved yet'}
      badge={<Badge semantic={saved.enabled ? 'success' : 'neutral'}>{saved.enabled ? 'Enabled' : 'Disabled'}</Badge>}
      action={saved.enabled ? (
        <Button
          type="button"
          variant="outline-emerald"
          size="sm"
          className="gap-1.5"
          onClick={handleTestConnection}
          loading={isTesting}
          loadingText="Testing..."
        >
          <IconPlugConnected className="h-4 w-4" />
          {unsaved ? 'Test saved settings' : tr('Test connection')}
        </Button>
      ) : undefined}
      check={checks.checks.ONLYOFFICE}
      currentSubject={`OnlyOffice · ${savedUrl}`}
      emptyText={saved.enabled ? 'No connection test has been run yet.' : 'OnlyOffice is off, so there is nothing to test.'}
    />
  );

  const secretCard = (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-600"><IconKey className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{tr("JWT secret")}</p>
            <p className="text-2xs text-slate-500 md:text-xs">
              {hasStoredJwtSecret || onlyOfficeConfig.jwtSecretConfigured ? 'A secret is saved.' : 'No secret is saved.'}
              {secretChangedAt ? ` Last changed ${formatDateTime(secretChangedAt)}.` : ''}
            </p>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Button type="button" variant="outline-emerald" size="sm" className="col-span-2 gap-1.5 sm:col-auto" onClick={handleGenerateJwtSecret}>
            <IconRefresh className="h-4 w-4" />
            {tr("Generate new")}
          </Button>
          {isStoredJwtSecretPreview && (
            <Button type="button" variant="outline-emerald" size="sm" onClick={() => setIsReplacingJwtSecret(true)}>
              {tr("Replace Secret")}
            </Button>
          )}
          <Button
            type="button"
            variant="outline-emerald"
            size="sm"
            onClick={handleResetJwtSecret}
            disabled={!onlyOfficeConfig.jwtSecretConfigured && !onlyOfficeConfig.jwtSecret}
          >
            {tr("Reset Secret")}
          </Button>
        </div>
      </div>
      <div className="mt-3">
        <label className={LABEL_CLASS} htmlFor="onlyoffice-jwt-secret">{tr("JWT Secret")}</label>
        <div className="flex items-center gap-1">
          <div className="relative min-w-0 flex-1">
            <input
              id="onlyoffice-jwt-secret"
              type={showJwtSecret ? 'text' : 'password'}
              value={isStoredJwtSecretPreview ? 'Stored secret configured' : onlyOfficeConfig.jwtSecret || ''}
              onChange={(e) => handleFieldChange('jwtSecret', e.target.value)}
              readOnly={isStoredJwtSecretPreview}
              className={isStoredJwtSecretPreview ? `${CONTROL_STATE_CLASSES.readonlyField} pr-10` : `${INPUT_CLASS} pr-10`}
              placeholder={isReplacingJwtSecret ? 'Enter a replacement secret' : 'Must match the onlyoffice-documentserver JWT_SECRET env var'}
            />
            <button
              type="button"
              onClick={() => setShowJwtSecret(!showJwtSecret)}
              aria-label={showJwtSecret ? 'Hide the JWT secret' : 'Show the JWT secret'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition-colors hover:text-slate-600"
            >
              {showJwtSecret ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
            </button>
          </div>
          {generatedSecret && hasNewJwtSecret && <CopyButton value={onlyOfficeConfig.jwtSecret} label={tr("Copy the new JWT secret")} />}
        </div>
        {renderFieldError('jwtSecret')}
        {hasNewJwtSecret && (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <IconInfoCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {generatedSecret ? 'This new secret is shown here once: after Save it is hidden. ' : ''}
              {tr("Put the same value in the Document Server's JWT_SECRET before you press Save, or the editor cannot open documents.")}
            </span>
          </p>
        )}
      </div>
    </div>
  );

  const settingsRow = (label: string, value: string, copyLabel: string | null) => (
    <div className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
      <dt className="text-xs font-medium text-slate-600">{label}</dt>
      <dd className="min-w-0 break-all font-mono text-2xs text-slate-800 md:text-xs">{value || '—'}</dd>
      <span className="justify-self-end">{copyLabel && value ? <CopyButton value={value} label={copyLabel} /> : null}</span>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {statusCard}

      <IntegrationSectionCard title={tr("Connection")} description={tr("The Document Server that opens Office files in the browser.")}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
          <div className="flex items-center gap-3">
            <Switch size="sm" checked={!!onlyOfficeConfig.enabled} onChange={(checked) => handleFieldChange('enabled', checked)} aria-label={tr("Enable OnlyOffice")} />
            <span className="text-sm font-medium text-slate-800">{onlyOfficeConfig.enabled ? 'OnlyOffice is on' : 'OnlyOffice is off'}</span>
          </div>
          <p className={`max-w-xl text-xs ${onlyOfficeConfig.enabled ? 'text-slate-500' : 'text-amber-800'}`}>
            {onlyOfficeConfig.enabled
              ? 'Files that open in OnlyOffice use the Document Server below.'
              : 'While it is off, the OnlyOffice editor and viewer cannot be opened.'}
          </p>
        </div>

        <Collapsible open={!!onlyOfficeConfig.enabled}>
          <div className="space-y-4">
            <div>
              <label className={LABEL_CLASS} htmlFor="onlyoffice-server-url">{tr("Document Server URL (browser-reachable)")}</label>
              <input
                id="onlyoffice-server-url"
                type="text"
                value={onlyOfficeConfig.documentServerUrl || ''}
                onChange={(e) => handleFieldChange('documentServerUrl', e.target.value)}
                className={INPUT_CLASS}
                placeholder="http://localhost:8082"
              />
              {renderFieldError('documentServerUrl')}
              <p className="mt-1 text-xs text-slate-500">{tr("Matches the frontend's VITE_ONLYOFFICE_URL -- the address the browser loads the editor script from.")}</p>
            </div>
            {secretCard}
            {unsaved && (
              <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <IconInfoCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{tr("There are changes that are not saved yet.")} <strong>{tr("Test connection checks the saved settings")}</strong>{tr("; save first to test the new ones.")}</span>
              </p>
            )}
          </div>
        </Collapsible>
      </IntegrationSectionCard>

      {onlyOfficeConfig.enabled && (
        <IntegrationSectionCard title={tr("Settings for the Document Server")} description={tr("Both ends must agree. These are the values the other side needs.")}>
          <dl className="divide-y divide-slate-100">
            {settingsRow('VITE_ONLYOFFICE_URL (frontend)', (onlyOfficeConfig.documentServerUrl || '').trim(), 'Copy the Document Server URL')}
            {settingsRow('Callback base URL (the Document Server calls this application here)', (onlyOfficeConfig.callbackBaseUrl || '').trim(), 'Copy the callback base URL')}
            {settingsRow('JWT secret', 'The same value as JWT_SECRET of the Document Server', null)}
          </dl>
        </IntegrationSectionCard>
      )}
    </div>
  );
};
