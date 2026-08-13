import React, { useState } from 'react';
import { IntegrationConfig } from '../types';
import { useEffect } from 'react';
import { Select } from '@/components/ui/select/Select';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { Button } from '@/components/ui/button/Button';
import { useToast } from '@/components/ui/toast/Toast';
import { useTranslation } from '@/i18n';
import {
  Eye,
  EyeOff,
  Link2,
  Key,
  Cloud,
} from 'lucide-react';
import { settingsApi, type StorageTestPayload } from '@/services/api/settings';
import { formatDateTime } from '@/utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

interface FolderItem {
  id: string;
  name: string;
  path: string;
  webUrl: string;
}

type StoragePathPreview = Awaited<ReturnType<typeof settingsApi.getStoragePathPreview>>;

const buildNasUncPath = (host?: string, shareName?: string) => {
  const cleanedHost = (host || '').trim().replace(/^\\\\+/, '').replace(/^smb:\/\//i, '').replace(/[\\/]+$/, '');
  const cleanedShare = (shareName || '').trim().replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
  if (!cleanedHost || !cleanedShare) {
    return '';
  }
  return `\\\\${cleanedHost}\\${cleanedShare}`;
};

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

const buildStorageTestPayload = (storage: IntegrationConfig['storage']): StorageTestPayload => {
  switch (storage.provider) {
    case 'nas':
      return {
        provider: 'nas',
        nasHost: storage.nasHost,
        nasShareName: storage.nasShareName,
        nasDomain: storage.nasDomain,
        nasPath: storage.nasPath?.trim() || buildNasUncPath(storage.nasHost, storage.nasShareName),
        nasUsername: storage.nasUsername,
        nasPassword: storage.nasPassword,
      };
    case 'aws-s3':
      return {
        provider: 'aws-s3',
        bucketName: storage.bucketName,
        region: storage.region,
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
        basePath: storage.basePath,
      };
    case 'azure-blob':
      return {
        provider: 'azure-blob',
        bucketName: storage.bucketName,
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
        basePath: storage.basePath,
      };
    case 'google-cloud':
      return {
        provider: 'google-cloud',
        bucketName: storage.bucketName,
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
        basePath: storage.basePath,
      };
    case 'minio':
      return {
        provider: 'minio',
        minioEndpoint: storage.minioEndpoint || '',
        minioBucket: storage.minioBucket || '',
        minioAccessKeyId: storage.minioAccessKeyId || '',
        minioSecretAccessKey: storage.minioSecretAccessKey || '',
        minioRetentionYears: storage.minioRetentionYears || 5,
        documentsPrefix: storage.documentsPrefix || 'documents',
        controlledCopiesPrefix: storage.controlledCopiesPrefix || 'controlled-copies',
        templatesPrefix: storage.templatesPrefix || 'templates',
        trainingPrefix: storage.trainingPrefix || 'training',
        auditPrefix: storage.auditPrefix || 'audit',
        tempPrefix: storage.tempPrefix || 'temp',
      };
    case 'google-drive':
      return {
        provider: 'google-drive',
        googleDriveClientId: storage.googleDriveClientId,
        googleDriveClientSecret: storage.googleDriveClientSecret,
        googleDriveFolderId: storage.googleDriveFolderId,
      };
    case 'onedrive':
      return {
        provider: 'onedrive',
        msTenantId: storage.msTenantId,
        msClientId: storage.msClientId,
        msClientSecret: storage.msClientSecret,
        msDriveId: storage.msDriveId,
        msLibraryFolder: storage.msLibraryFolder,
      };
    case 'sharepoint':
      return {
        provider: 'sharepoint',
        msTenantId: storage.msTenantId,
        msClientId: storage.msClientId,
        msClientSecret: storage.msClientSecret,
        msSiteId: storage.msSiteId,
        msDriveId: storage.msDriveId,
        msLibraryFolder: storage.msLibraryFolder,
      };
    case 'dropbox':
      return {
        provider: 'dropbox',
        dropboxAccessToken: storage.dropboxAccessToken,
        dropboxAppKey: storage.dropboxAppKey,
        dropboxAppSecret: storage.dropboxAppSecret,
        dropboxFolderPath: storage.dropboxFolderPath,
      };
    default:
      return {
        provider: 'local',
        basePath: storage.basePath,
      };
  }
};

interface IntegrationTabProps {
  config: IntegrationConfig;
  onChange: (config: IntegrationConfig) => void;
}



const SettingsCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="flex items-center gap-2.5 px-4 md:px-5 py-4 border-b border-slate-100">
      <span className="text-emerald-600">{icon}</span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    </div>
    <div className="p-4 md:p-5">{children}</div>
  </div>
);

export const IntegrationTab: React.FC<IntegrationTabProps> = ({ config, onChange }) => {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [showLdapPassword, setShowLdapPassword] = useState(false);
  const [showStorageKey, setShowStorageKey] = useState(false);
  const [showLdapServerUrl, setShowLdapServerUrl] = useState(false);
  const [showLdapBaseDn, setShowLdapBaseDn] = useState(false);
  const [showLdapBindDn, setShowLdapBindDn] = useState(false);
  const [showStorageAccessKeyId, setShowStorageAccessKeyId] = useState(false);
  const [showMinioSecretAccessKey, setShowMinioSecretAccessKey] = useState(false);
  const [showNasPassword, setShowNasPassword] = useState(false);
  const [testingStorage, setTestingStorage] = useState(false);
  const [showGoogleDriveClientSecret, setShowGoogleDriveClientSecret] = useState(false);
  const [showMsClientSecret, setShowMsClientSecret] = useState(false);
  const [showDropboxAppSecret, setShowDropboxAppSecret] = useState(false);
  const [showDropboxAccessToken, setShowDropboxAccessToken] = useState(false);
  const [storagePathPreview, setStoragePathPreview] = useState<StoragePathPreview | null>(null);

  const handleTestStorageConnection = async () => {
    setTestingStorage(true);
    try {
      const response = await settingsApi.testStorageConnection(buildStorageTestPayload(config.storage));
      if (response.success) {
        showToast({
          type: 'success',
          title: t('integration.storage.successTitle'),
          message: response.message || t('integration.storage.successMessage'),
        });
      } else {
        showToast({
          type: 'error',
          title: t('integration.storage.failedTitle'),
          message: response.message || t('integration.storage.failedMessage'),
        });
      }
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      showToast({
        type: 'error',
        title: t('integration.connectionFailed'),
        message: errorMsg,
      });
    } finally {
      setTestingStorage(false);
    }
  };

  const handleLdapChange = (key: keyof IntegrationConfig['ldap'], value: any) => {
    onChange({
      ...config,
      ldap: { ...config.ldap, [key]: value },
    });
  };

  const handleStorageChange = (key: keyof IntegrationConfig['storage'], value: any) => {
    onChange({
      ...config,
      storage: { ...config.storage, [key]: value },
    });
  };

  const applyMinioEndpointPreset = (value: string) => {
    handleStorageChange('minioEndpoint', value);
  };

  const handleChange = (key: keyof IntegrationConfig, value: any) => {
    onChange({ ...config, [key]: value });
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
  }, [
    config.storage.documentsPrefix,
    config.storage.controlledCopiesPrefix,
    config.storage.templatesPrefix,
    config.storage.trainingPrefix,
    config.storage.auditPrefix,
    config.storage.tempPrefix,
  ]);

  return (
    <div className="p-4 md:p-5 space-y-4">
      {/* LDAP Directory */}
      <SettingsCard title="LDAP / Active Directory" icon={<Key className="h-4 w-4" />}>
        <div className="space-y-4">
          <div>
            <Checkbox
              id="enableLdap"
              label="Enable LDAP Integration"
              checked={config.ldap.enableLdap}
              onChange={(checked) => handleLdapChange('enableLdap', checked)}
            />
            <p className="text-xs text-slate-500 ml-7">
              Synchronize users and groups from your LDAP/AD directory
            </p>
          </div>

          {config.ldap.enableLdap && (
            <div className="ml-4 sm:ml-7 p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    LDAP Server URL
                  </label>
                  <div className="relative">
                    <input
                      type={showLdapServerUrl ? 'text' : 'password'}
                      value={config.ldap.serverUrl}
                      onChange={(e) => handleLdapChange('serverUrl', e.target.value)}
                      className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="ldaps://ldap.company.com:636"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLdapServerUrl(!showLdapServerUrl)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showLdapServerUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Base DN
                  </label>
                  <div className="relative">
                    <input
                      type={showLdapBaseDn ? 'text' : 'password'}
                      value={config.ldap.baseDn}
                      onChange={(e) => handleLdapChange('baseDn', e.target.value)}
                      className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="dc=company,dc=com"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLdapBaseDn(!showLdapBaseDn)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showLdapBaseDn ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Bind DN (Service Account)
                  </label>
                  <div className="relative">
                    <input
                      type={showLdapBindDn ? 'text' : 'password'}
                      value={config.ldap.bindDn}
                      onChange={(e) => handleLdapChange('bindDn', e.target.value)}
                      className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="cn=admin,dc=company,dc=com"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLdapBindDn(!showLdapBindDn)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showLdapBindDn ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Bind Password
                  </label>
                  <div className="relative">
                    <input
                      type={showLdapPassword ? 'text' : 'password'}
                      value={config.ldap.bindPassword}
                      onChange={(e) => handleLdapChange('bindPassword', e.target.value)}
                      className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Enter bind password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLdapPassword(!showLdapPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showLdapPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    User Search Filter
                  </label>
                  <input
                    type="text"
                    value={config.ldap.userSearchFilter}
                    onChange={(e) => handleLdapChange('userSearchFilter', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                    placeholder="(sAMAccountName={username})"
                  />
                </div>
                <Select
                  label="Sync Schedule"
                  value={config.ldap.syncSchedule}
                  onChange={(val) => handleLdapChange('syncSchedule', val as any)}
                  options={[
                    { label: 'Hourly', value: 'hourly' },
                    { label: 'Daily', value: 'daily' },
                    { label: 'Manual Only', value: 'manual' },
                  ]}
                />
              </div>
              <div className="flex items-center justify-between">
                {config.ldap.lastSyncDate && (
                  <p className="text-xs text-slate-500 font-medium">
                    Last synchronized: {formatDateTime(config.ldap.lastSyncDate)}
                  </p>
                )}
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => {
                  showToast({ type: 'info', title: t('integration.info'), message: t('integration.ldap.started') });
                  setTimeout(() => {
                    showToast({ type: 'success', title: t('integration.ldap.successTitle'), message: t('integration.ldap.successMessage', { count: 142 }) });
                  }, 2000);
                }} className="gap-2 shadow-sm">
                  <Link2 className="h-3.5 w-3.5" />
                  Test Connection
                </Button>
              </div>
            </div>
          )}
        </div>
      </SettingsCard>



      {/* Cloud Storage */}
      <SettingsCard title="Cloud Storage Integration" icon={<Cloud className="h-4 w-4" />}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Storage Provider"
              value={config.storage.provider}
              onChange={(val) => handleStorageChange('provider', val as any)}
              options={[
                { label: 'Local Server', value: 'local' },
              { label: 'Amazon S3', value: 'aws-s3' },
                { label: 'MinIO', value: 'minio' },
                { label: 'Azure Blob Storage', value: 'azure-blob' },
                { label: 'Google Cloud Storage', value: 'google-cloud' },
                { label: 'Network Attached Storage (NAS)', value: 'nas' },
                { label: 'Google Drive', value: 'google-drive' },
                { label: 'Microsoft OneDrive', value: 'onedrive' },
                { label: 'Microsoft SharePoint Workspace', value: 'sharepoint' },
                { label: 'Dropbox', value: 'dropbox' },
              ]}
            />
            {['aws-s3', 'azure-blob', 'google-cloud'].includes(config.storage.provider) && (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                  Bucket / Container Name
                </label>
                <input
                  type="text"
                  value={config.storage.bucketName}
                  onChange={(e) => handleStorageChange('bucketName', e.target.value)}
                  className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                  placeholder="my-eqms-bucket"
                />
              </div>
            )}
          </div>
          {['aws-s3', 'azure-blob', 'google-cloud'].includes(config.storage.provider) && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Region
                  </label>
                  <input
                    type="text"
                    value={config.storage.region}
                    onChange={(e) => handleStorageChange('region', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                    placeholder="ap-southeast-1"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Base Path
                  </label>
                  <input
                    type="text"
                    value={config.storage.basePath}
                    onChange={(e) => handleStorageChange('basePath', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                    placeholder="/documents"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Access Key ID
                  </label>
                  <div className="relative">
                    <input
                      type={showStorageAccessKeyId ? 'text' : 'password'}
                      value={config.storage.accessKeyId}
                      onChange={(e) => handleStorageChange('accessKeyId', e.target.value)}
                      className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="AKIA..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowStorageAccessKeyId(!showStorageAccessKeyId)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showStorageAccessKeyId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Secret Access Key
                  </label>
                  <div className="relative">
                    <input
                      type={showStorageKey ? 'text' : 'password'}
                      value={config.storage.secretAccessKey}
                      onChange={(e) => handleStorageChange('secretAccessKey', e.target.value)}
                      className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Enter secret key"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStorageKey(!showStorageKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showStorageKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <Checkbox
                  id="enableCdn"
                  label="Enable CDN (Content Delivery Network)"
                  checked={config.storage.enableCdn}
                  onChange={(checked) => handleStorageChange('enableCdn', checked)}
                />
                {config.storage.enableCdn && (
                  <div className="mt-3">
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                      CDN URL
                    </label>
                    <input
                      type="url"
                      value={config.storage.cdnUrl}
                      onChange={(e) => handleStorageChange('cdnUrl', e.target.value)}
                      className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                      placeholder="https://cdn.example.com"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          {config.storage.provider === 'minio' && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    MinIO Endpoint
                  </label>
                  <input
                    type="text"
                    value={config.storage.minioEndpoint || ''}
                    onChange={(e) => handleStorageChange('minioEndpoint', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="http://localhost:9000"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline-emerald"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => applyMinioEndpointPreset('http://localhost:9000')}
                    >
                      Use localhost:9000
                    </Button>
                    <Button
                      type="button"
                      variant="outline-emerald"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => applyMinioEndpointPreset('http://minio:9000')}
                    >
                      Use minio:9000
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 space-y-1">
                    <span className="block">
                      This is the MinIO S3 API endpoint that the backend will use when testing and saving the configuration.
                    </span>
                    <span className="block">
                      Use <span className="font-medium text-slate-700">http://localhost:9000</span> when the backend runs locally on your machine.
                    </span>
                    <span className="block">
                      Use <span className="font-medium text-slate-700">http://minio:9000</span> when the backend runs inside Docker Compose and connects to the MinIO container over the internal Docker network.
                    </span>
                    <span className="block">
                      Do not use port <span className="font-medium text-slate-700">9001</span>; that is the MinIO Console, not the S3 API.
                    </span>
                  </p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Bucket Name
                  </label>
                  <input
                    type="text"
                    value={config.storage.minioBucket || ''}
                    onChange={(e) => handleStorageChange('minioBucket', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="eqms-gmp-revisions"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    A dedicated bucket. The system enables Versioning and Object Lock Compliance.
                  </p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Access Key ID
                  </label>
                  <input
                    type="text"
                    value={config.storage.minioAccessKeyId || ''}
                    onChange={(e) => handleStorageChange('minioAccessKeyId', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="eqms-minio"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    MinIO service-account access key with bucket configuration and object read/write permissions.
                  </p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Secret Access Key
                  </label>
                  <div className="relative">
                    <input
                      type={showMinioSecretAccessKey ? 'text' : 'password'}
                      value={config.storage.minioSecretAccessKey || ''}
                      onChange={(e) => handleStorageChange('minioSecretAccessKey', e.target.value)}
                      className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="eqms-minio-secret"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMinioSecretAccessKey(!showMinioSecretAccessKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showMinioSecretAccessKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Retention Period (Years)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={config.storage.minioRetentionYears ?? 5}
                    onChange={(e) => handleStorageChange('minioRetentionYears', Number(e.target.value || 5))}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="5"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    WORM retention in Compliance Mode. Existing retained objects cannot be shortened or deleted.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Storage Prefix Configuration</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    These values are top-level namespaces only. The backend owns the V2 folders below them and uses immutable IDs, so do not add revision, source, published, or copy subfolders here.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                      Documents Prefix
                    </label>
                    <input
                      type="text"
                      value={config.storage.documentsPrefix || 'documents'}
                      onChange={(e) => handleStorageChange('documentsPrefix', e.target.value)}
                      className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="documents"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                      Controlled Copies Prefix
                    </label>
                    <input
                      type="text"
                      value={config.storage.controlledCopiesPrefix || 'controlled-copies'}
                      onChange={(e) => handleStorageChange('controlledCopiesPrefix', e.target.value)}
                      className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="controlled-copies"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                      Templates Prefix
                    </label>
                    <input
                      type="text"
                      value={config.storage.templatesPrefix || 'templates'}
                      onChange={(e) => handleStorageChange('templatesPrefix', e.target.value)}
                      className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="templates"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                      Training Prefix
                    </label>
                    <input
                      type="text"
                      value={config.storage.trainingPrefix || 'training'}
                      onChange={(e) => handleStorageChange('trainingPrefix', e.target.value)}
                      className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="training"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                      Audit Prefix
                    </label>
                    <input
                      type="text"
                      value={config.storage.auditPrefix || 'audit'}
                      onChange={(e) => handleStorageChange('auditPrefix', e.target.value)}
                      className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="audit"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                      Temp Prefix
                    </label>
                    <input
                      type="text"
                      value={config.storage.tempPrefix || 'temp'}
                      onChange={(e) => handleStorageChange('tempPrefix', e.target.value)}
                      className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="temp"
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3">
                  <p className="text-xs font-semibold text-sky-900">System-managed V2 object-key examples</p>
                  <p className="mt-1 text-xs leading-relaxed text-sky-800">
                    Returned by the server using the persisted configuration and production path builder. Save a changed prefix to refresh these examples. Changing a prefix creates a new root for future objects; it does not move or rename existing retained objects.
                  </p>
                  <dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-2 lg:grid-cols-2">
                    {[
                      ['Documents', storagePathPreview?.documents],
                      ['Controlled Copies', storagePathPreview?.controlledCopies],
                      ['Templates', storagePathPreview?.templates],
                      ['Training', storagePathPreview?.training],
                      ['Audit evidence', storagePathPreview?.auditEvidence],
                      ['Temporary files', storagePathPreview?.temporaryFiles],
                    ].map(([label, path]) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-2xs font-semibold uppercase tracking-wide text-sky-700">{label}</dt>
                        <dd className="mt-0.5 break-all font-mono text-2xs text-slate-700">{path || 'Loading server-generated path…'}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          )}
          {config.storage.provider === 'nas' && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    NAS Host / IP
                  </label>
                  <input
                    type="text"
                    value={config.storage.nasHost || ''}
                    onChange={(e) => handleStorageChange('nasHost', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                    placeholder="ProjectT7 or 10.0.80.254"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Shared Folder Name
                  </label>
                  <input
                    type="text"
                    value={config.storage.nasShareName || ''}
                    onChange={(e) => handleStorageChange('nasShareName', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                    placeholder="ShareT7 or Documents"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Domain / Workgroup (optional)
                  </label>
                  <input
                    type="text"
                    value={config.storage.nasDomain || ''}
                    onChange={(e) => handleStorageChange('nasDomain', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                    placeholder="WORKGROUP or DOMAIN"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    value={config.storage.nasUsername || ''}
                    onChange={(e) => handleStorageChange('nasUsername', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                    placeholder="nas_user"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNasPassword ? 'text' : 'password'}
                      value={config.storage.nasPassword || ''}
                      onChange={(e) => handleStorageChange('nasPassword', e.target.value)}
                      className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNasPassword(!showNasPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showNasPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Resolved SMB Path
                  </label>
                  <input
                    type="text"
                    value={config.storage.nasPath || buildNasUncPath(config.storage.nasHost, config.storage.nasShareName)}
                    readOnly
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-600"
                    placeholder="\\\\ProjectT7\\ShareT7"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Use the exact Synology shared folder name. The backend connects to this SMB path directly.
                  </p>
                </div>
              </div>
            </div>
          )}
          {config.storage.provider === 'google-drive' && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={config.storage.googleDriveClientId || ''}
                    onChange={(e) => handleStorageChange('googleDriveClientId', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                    placeholder="Enter Google Client ID"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Client Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showGoogleDriveClientSecret ? 'text' : 'password'}
                      value={config.storage.googleDriveClientSecret || ''}
                      onChange={(e) => handleStorageChange('googleDriveClientSecret', e.target.value)}
                      className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGoogleDriveClientSecret(!showGoogleDriveClientSecret)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showGoogleDriveClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Google Drive Folder ID
                  </label>
                  <input
                    type="text"
                    value={config.storage.googleDriveFolderId || ''}
                    onChange={(e) => handleStorageChange('googleDriveFolderId', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                    placeholder="Enter Folder ID (e.g. 1a2b3c4d5e...)"
                  />
                </div>
              </div>
            </div>
          )}

          {['onedrive', 'sharepoint'].includes(config.storage.provider) && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Tenant ID
                  </label>
                  <input
                    type="text"
                    value={config.storage.msTenantId || ''}
                    onChange={(e) => handleStorageChange('msTenantId', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                    placeholder="Enter MS Tenant ID"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={config.storage.msClientId || ''}
                    onChange={(e) => handleStorageChange('msClientId', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                    placeholder="Enter MS Client ID"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Client Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showMsClientSecret ? 'text' : 'password'}
                      value={config.storage.msClientSecret || ''}
                      onChange={(e) => handleStorageChange('msClientSecret', e.target.value)}
                      className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMsClientSecret(!showMsClientSecret)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showMsClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {config.storage.provider === 'sharepoint' && (
                  <div className="md:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                      SharePoint Workspace Site ID
                    </label>
                    <input
                      type="text"
                      value={config.storage.msSiteId || ''}
                      onChange={(e) => handleStorageChange('msSiteId', e.target.value)}
                      className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                      placeholder="domain.sharepoint.com,xxxx-xxxx-xxxx,yyyy-yyyy-yyyy"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Drive ID
                  </label>
                  <input
                    type="text"
                    value={config.storage.msDriveId || ''}
                    onChange={(e) => handleStorageChange('msDriveId', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                    placeholder="Enter OneDrive / SharePoint workspace Drive ID"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Workspace Folder / Path
                  </label>
                  <input
                    type="text"
                    value={config.storage.msLibraryFolder || ''}
                    onChange={(e) => handleStorageChange('msLibraryFolder', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                    placeholder="e.g. /Documents"
                  />
                </div>
              </div>
            </div>
          )}

          {config.storage.provider === 'dropbox' && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    App Key
                  </label>
                  <input
                    type="text"
                    value={config.storage.dropboxAppKey || ''}
                    onChange={(e) => handleStorageChange('dropboxAppKey', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                    placeholder="Enter Dropbox App Key"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    App Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showDropboxAppSecret ? 'text' : 'password'}
                      value={config.storage.dropboxAppSecret || ''}
                      onChange={(e) => handleStorageChange('dropboxAppSecret', e.target.value)}
                      className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDropboxAppSecret(!showDropboxAppSecret)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showDropboxAppSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Access Token
                  </label>
                  <div className="relative">
                    <input
                      type={showDropboxAccessToken ? 'text' : 'password'}
                      value={config.storage.dropboxAccessToken || ''}
                      onChange={(e) => handleStorageChange('dropboxAccessToken', e.target.value)}
                      className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Enter Access Token"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDropboxAccessToken(!showDropboxAccessToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showDropboxAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Folder Path
                  </label>
                  <input
                    type="text"
                    value={config.storage.dropboxFolderPath || ''}
                    onChange={(e) => handleStorageChange('dropboxFolderPath', e.target.value)}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 "
                    placeholder="e.g. /eqms-documents"
                  />
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button
              variant="outline-emerald"
              size="sm"
              loading={testingStorage}
              loadingText="Testing..."
              onClick={handleTestStorageConnection}
              className="gap-2 shadow-sm"
              disabled={
                (config.storage.provider === 'nas' && !((config.storage.nasPath || buildNasUncPath(config.storage.nasHost, config.storage.nasShareName)).trim()))
                || (config.storage.provider === 'aws-s3' && (!config.storage.bucketName?.trim() || !config.storage.region?.trim() || !config.storage.accessKeyId?.trim() || !config.storage.secretAccessKey?.trim()))
                || (config.storage.provider === 'minio' && (!config.storage.minioEndpoint?.trim() || !config.storage.minioBucket?.trim() || !config.storage.minioAccessKeyId?.trim() || !config.storage.minioSecretAccessKey?.trim()))
                || (config.storage.provider === 'azure-blob' && (!config.storage.bucketName?.trim() || !config.storage.accessKeyId?.trim() || !config.storage.secretAccessKey?.trim()))
                || (config.storage.provider === 'google-cloud' && (!config.storage.bucketName?.trim() || !config.storage.accessKeyId?.trim() || !config.storage.secretAccessKey?.trim()))
                || (config.storage.provider === 'google-drive' && (!config.storage.googleDriveClientId?.trim() || !config.storage.googleDriveClientSecret?.trim() || !config.storage.googleDriveFolderId?.trim()))
                || (config.storage.provider === 'onedrive' && (!config.storage.msTenantId?.trim() || !config.storage.msClientId?.trim() || !config.storage.msClientSecret?.trim() || !config.storage.msDriveId?.trim()))
                || (config.storage.provider === 'sharepoint' && (!config.storage.msTenantId?.trim() || !config.storage.msClientId?.trim() || !config.storage.msClientSecret?.trim() || !config.storage.msSiteId?.trim() || !config.storage.msDriveId?.trim()))
                || (config.storage.provider === 'dropbox' && (!config.storage.dropboxAccessToken?.trim() || !config.storage.dropboxAppKey?.trim() || !config.storage.dropboxAppSecret?.trim() || !config.storage.dropboxFolderPath?.trim()))
              }
            >
              Test Storage Connect
            </Button>
          </div>
        </div>
      </SettingsCard>


    </div>
  );
};
