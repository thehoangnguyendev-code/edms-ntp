import React, { useEffect, useState } from 'react';
import { IconAlertTriangle, IconChevronDown, IconDatabase, IconEye, IconEyeOff, IconNetwork, IconPlugConnected, IconServer } from '@tabler/icons-react';
import { CONTROL_STATE_CLASSES } from '@/components/ui/controlState';
import { Badge } from '@/components/ui/badge/Badge';
import { Button } from '@/components/ui/button/Button';
import { Collapsible } from '@/components/ui/collapsible';
import { useToast } from '@/components/ui/toast/Toast';
import { settingsApi } from '@/services/api/settings';
import type { IntegrationConfig } from '../types';
import type { IntegrationChecksController } from '../useIntegrationChecks';
import { IntegrationSectionCard } from './IntegrationSectionCard';
import { IntegrationStatusCard } from './IntegrationStatusCard';
import { RetentionControl } from './RetentionControl';
import { StorageLayoutTable } from './StorageLayoutTable';
import { StorageProviderCards } from './StorageProviderCards';
import { buildNasUncPath, buildStorageTestPayload, canTestStorage, retentionYearsOf, storageSubject } from './storageIntegration';
import { tr } from "@/i18n";

type StoragePathPreview = Awaited<ReturnType<typeof settingsApi.getStoragePathPreview>>;
type Storage = IntegrationConfig['storage'];

const INPUT_CLASS = 'w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500';
const LABEL_CLASS = 'block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize';

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const candidate = error as { response?: { data?: { message?: string } }; message?: string };
    const apiMessage = candidate.response?.data?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage.trim();
    }
    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      return candidate.message.trim();
    }
  }
  return 'Storage connection test failed.';
};

const SecretInput: React.FC<{ id: string; value: string; placeholder: string; label: string; onChange: (value: string) => void }> = ({ id, value, placeholder, label, onChange }) => {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={shown ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT_CLASS} pr-10`} placeholder={placeholder} />
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-label={shown ? `Hide ${label}` : `Show ${label}`}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 transition-colors hover:text-slate-600"
      >
        {shown ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
      </button>
    </div>
  );
};

interface IntegrationTabProps {
  config: IntegrationConfig;
  onChange: (config: IntegrationConfig) => void;
  /** What was last saved: the retention control says when its value differs from it. */
  savedStorage?: Storage;
  /** The last "Test connection" result of each integration, kept by the server. */
  checks: IntegrationChecksController;
}

export const IntegrationTab: React.FC<IntegrationTabProps> = ({ config, onChange, savedStorage, checks }) => {
  const { showToast } = useToast();
  const [testingStorage, setTestingStorage] = useState(false);
  const [endpointHelpOpen, setEndpointHelpOpen] = useState(false);
  const [storagePathPreview, setStoragePathPreview] = useState<StoragePathPreview | null>(null);
  const { storage } = config;

  const handleTestStorageConnection = async () => {
    setTestingStorage(true);
    try {
      const response = await settingsApi.testStorageConnection(buildStorageTestPayload(storage));
      if (response.success) {
        showToast({ type: 'success', title: tr('Success'), message: tr(response.message || 'Storage connection test successful.') });
      } else {
        showToast({ type: 'error', title: tr('Error'), message: tr(response.message || 'Storage connection test failed.') });
      }
    } catch (error) {
      showToast({ type: 'error', title: tr('Connection Failed'), message: getErrorMessage(error) });
    } finally {
      setTestingStorage(false);
      // the server keeps what this test found (success or failure), so the card shows it after the toast is gone
      void checks.reload();
    }
  };

  const handleStorageChange = (key: keyof Storage, value: Storage[keyof Storage]) => {
    onChange({ ...config, storage: { ...storage, [key]: value } });
  };

  useEffect(() => {
    let cancelled = false;
    settingsApi.getStoragePathPreview()
      .then((preview) => {
        if (!cancelled) setStoragePathPreview(preview);
      })
      .catch(() => {
        if (!cancelled) setStoragePathPreview(null);
      });
    return () => { cancelled = true; };
  }, []);

  const provider = storage.provider;
  const header = provider === 'minio'
    ? { icon: <IconDatabase className="h-5 w-5" />, title: `MinIO · ${storage.minioBucket?.trim() || 'no bucket yet'}`, subtitle: storage.minioEndpoint?.trim() || 'No endpoint yet' }
    : provider === 'nas'
      ? { icon: <IconNetwork className="h-5 w-5" />, title: tr('Network Attached Storage'), subtitle: (storage.nasPath || buildNasUncPath(storage.nasHost, storage.nasShareName)) || 'No shared folder yet' }
      : { icon: <IconServer className="h-5 w-5" />, title: tr('Local Server'), subtitle: tr('A folder on the application server') };

  const endpointHelp = (
    <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
      <p>{tr("This is the MinIO S3 API endpoint that the backend will use when testing and saving the configuration.")}</p>
      <p>{tr("Use")} <span className="font-medium text-slate-700">{tr("http://localhost:9000")}</span> {tr("when the backend runs locally on your machine.")}</p>
      <p>{tr("Use")} <span className="font-medium text-slate-700">{tr("http://minio:9000")}</span> {tr("when the backend runs inside Docker Compose and connects to the MinIO container over the internal Docker network.")}</p>
      <p>{tr("Do not use port")} <span className="font-medium text-slate-700">9001</span>{tr("; that is the MinIO Console, not the S3 API.")}</p>
    </div>
  );

  const minioFields = (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={LABEL_CLASS} htmlFor="storage-minio-endpoint">{tr("MinIO Endpoint")}</label>
          <input id="storage-minio-endpoint" type="text" value={storage.minioEndpoint || ''} onChange={(e) => handleStorageChange('minioEndpoint', e.target.value)} className={INPUT_CLASS} placeholder="http://localhost:9000" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">{tr("Quick fill")}</span>
            <Button type="button" variant="outline-emerald" size="xs" className="whitespace-nowrap" onClick={() => handleStorageChange('minioEndpoint', 'http://localhost:9000')}>{tr("localhost:9000")}</Button>
            <Button type="button" variant="outline-emerald" size="xs" className="whitespace-nowrap" onClick={() => handleStorageChange('minioEndpoint', 'http://minio:9000')}>{tr("minio:9000")}</Button>
            <button
              type="button"
              onClick={() => setEndpointHelpOpen(!endpointHelpOpen)}
              aria-expanded={endpointHelpOpen}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800"
            >
              {tr("Which endpoint?")}
              <IconChevronDown className={`h-3.5 w-3.5 transition-transform ${endpointHelpOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <Collapsible open={endpointHelpOpen}>{endpointHelp}</Collapsible>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="storage-minio-bucket">{tr("Bucket Name")}</label>
          <input id="storage-minio-bucket" type="text" value={storage.minioBucket || ''} onChange={(e) => handleStorageChange('minioBucket', e.target.value)} className={INPUT_CLASS} placeholder={tr("eqms-gmp-revisions")} />
          <p className="mt-1 text-xs text-slate-500">{tr("A dedicated bucket. The system enables Versioning and Object Lock Compliance.")}</p>
        </div>
      </div>
      <div className="border-t border-slate-100 pt-4">
        <p className="mb-3 text-2xs font-semibold uppercase tracking-wide text-slate-500 md:text-xs">{tr("Credentials")}</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL_CLASS} htmlFor="storage-minio-access-key">{tr("Access Key ID")}</label>
            <input id="storage-minio-access-key" type="text" value={storage.minioAccessKeyId || ''} onChange={(e) => handleStorageChange('minioAccessKeyId', e.target.value)} className={INPUT_CLASS} placeholder={tr("eqms-minio")} />
            <p className="mt-1 text-xs text-slate-500">{tr("MinIO service-account access key with bucket configuration and object read/write permissions.")}</p>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="storage-minio-secret">{tr("Secret Access Key")}</label>
            <SecretInput id="storage-minio-secret" value={storage.minioSecretAccessKey || ''} placeholder={tr("eqms-minio-secret")} label={tr("secret access key")} onChange={(value) => handleStorageChange('minioSecretAccessKey', value)} />
          </div>
        </div>
      </div>
    </>
  );

  const nasFields = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className={LABEL_CLASS} htmlFor="storage-nas-host">{tr("NAS Host / IP")}</label>
        <input id="storage-nas-host" type="text" value={storage.nasHost || ''} onChange={(e) => handleStorageChange('nasHost', e.target.value)} className={INPUT_CLASS} placeholder={tr("ProjectT7 or 10.0.80.254")} />
      </div>
      <div className="md:col-span-2">
        <label className={LABEL_CLASS} htmlFor="storage-nas-share">{tr("Shared Folder Name")}</label>
        <input id="storage-nas-share" type="text" value={storage.nasShareName || ''} onChange={(e) => handleStorageChange('nasShareName', e.target.value)} className={INPUT_CLASS} placeholder={tr("ShareT7 or Documents")} />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="storage-nas-domain">{tr("Domain / Workgroup (optional)")}</label>
        <input id="storage-nas-domain" type="text" value={storage.nasDomain || ''} onChange={(e) => handleStorageChange('nasDomain', e.target.value)} className={INPUT_CLASS} placeholder={tr("WORKGROUP or DOMAIN")} />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="storage-nas-user">{tr("Username")}</label>
        <input id="storage-nas-user" type="text" value={storage.nasUsername || ''} onChange={(e) => handleStorageChange('nasUsername', e.target.value)} className={INPUT_CLASS} placeholder={tr("nas_user")} />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="storage-nas-password">{tr("Password")}</label>
        <SecretInput id="storage-nas-password" value={storage.nasPassword || ''} placeholder="••••••••" label={tr("password")} onChange={(value) => handleStorageChange('nasPassword', value)} />
      </div>
      <div className="md:col-span-2">
        <label className={LABEL_CLASS} htmlFor="storage-nas-path">{tr("Resolved SMB Path")}</label>
        <input
          id="storage-nas-path"
          type="text"
          value={storage.nasPath || buildNasUncPath(storage.nasHost, storage.nasShareName)}
          readOnly
          className={CONTROL_STATE_CLASSES.readonlyField}
          placeholder={tr("\\\\\\\\ProjectT7\\\\ShareT7")}
        />
        <p className="mt-1 text-xs text-slate-500">{tr("Use the exact Synology shared folder name. The backend connects to this SMB path directly.")}</p>
      </div>
    </div>
  );

  const localNote = (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{tr("Files are written to a folder on the application server. That folder is not part of the backup, so a lost disk loses them. Use MinIO or a NAS for real records.")}</p>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <IntegrationStatusCard
        icon={header.icon}
        title={header.title}
        subtitle={header.subtitle}
        badge={provider === 'local' ? <Badge semantic="warning">{tr("Not backed up")}</Badge> : undefined}
        action={
          <Button
            variant="outline-emerald"
            size="sm"
            loading={testingStorage}
            loadingText="Testing..."
            onClick={handleTestStorageConnection}
            className="gap-1.5"
            disabled={!canTestStorage(storage)}
            title={canTestStorage(storage) ? undefined : 'Fill in the connection fields first'}
          >
            <IconPlugConnected className="h-4 w-4" />
            {tr("Test connection")}
          </Button>
        }
        check={checks.checks.STORAGE}
        currentSubject={storageSubject(storage)}
        emptyText={tr("No connection test has been run yet.")}
      />

      <IntegrationSectionCard title={tr("Connection")} description={tr("Where the files are stored and how the system signs in.")}>
        <StorageProviderCards value={provider} onChange={(value) => handleStorageChange('provider', value)} />
        {provider === 'minio' && minioFields}
        {provider === 'nas' && nasFields}
        {provider === 'local' && localNote}
      </IntegrationSectionCard>

      {provider === 'minio' && (
        <IntegrationSectionCard title={tr("Retention")} description={tr("How long stored records are locked.")}>
          <RetentionControl
            years={retentionYearsOf(storage)}
            savedYears={retentionYearsOf(savedStorage ?? storage)}
            onChange={(years) => handleStorageChange('minioRetentionYears', years)}
          />
        </IntegrationSectionCard>
      )}

      {provider === 'minio' && (
        <IntegrationSectionCard title={tr("Layout")} description={tr("How files are arranged in the buckets.")}>
          <p className="text-xs text-slate-500">
            {tr("The folder structure is fixed by the system and cannot be changed here. Every file is stored under one of the registered data domains below, which keeps backup, restore and reconciliation reliable. A folder appears when the first file is stored in it. The keys are generated by the server with the production path builder.")}
          </p>
          <StorageLayoutTable preview={storagePathPreview} />
        </IntegrationSectionCard>
      )}
    </div>
  );
};
