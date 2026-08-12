import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, Shield, Database, FolderOpen, ChevronRight, AlertTriangle, Check, X, Loader2, Home, Eye, EyeOff } from 'lucide-react';
import { IconChevronRight, IconCheck, IconFolder, IconPencilMinus } from '@tabler/icons-react';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { Button } from '@/components/ui/button/Button';
import { useToast } from '@/components/ui/toast/Toast';
import { cn } from '@/components/ui/utils';
import { FormModal } from '@/components/ui/modal/FormModal';
import { Select } from '@/components/ui/select/Select';
import { settingsApi } from '@/services/api/settings';
import { DocumentConfig, OfficeOnlineStorageConfig } from '../types';

interface DocumentTabProps {
  documentConfig: DocumentConfig;
  officeOnlineConfig: OfficeOnlineStorageConfig;
  onDocumentChange: (config: DocumentConfig) => void;
  onOfficeOnlineChange: (config: OfficeOnlineStorageConfig) => void;
  onOfficeOnlineValidationChange?: (isValid: boolean) => void;
}

interface FolderItem {
  id: string;
  name: string;
  path: string;
  webUrl: string;
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

function splitPath(path: string): string[] {
  return path.split('/').filter((segment) => segment.trim().length > 0);
}

function joinPath(segments: string[]): string {
  return segments.join('/');
}

interface LibraryFolderPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

const LibraryFolderPicker: React.FC<LibraryFolderPickerProps> = ({ value, onChange, disabled, error }) => {
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState<string>('');
  const [browseItems, setBrowseItems] = useState<FolderItem[]>([]);
  const [isBrowseLoading, setIsBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState('');
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [manualValue, setManualValue] = useState(value);
  const [folderChanged, setFolderChanged] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setManualValue(value);
  }, [value]);

  useEffect(() => {
    if (!folderChanged) return;
    const timer = window.setTimeout(() => setFolderChanged(false), 1800);
    return () => window.clearTimeout(timer);
  }, [folderChanged]);

  const segments = splitPath(value || '');
  const workspaceRoot = joinPath(segments) || 'EQMS';

  const fetchBrowse = useCallback(async (path: string) => {
    setIsBrowseLoading(true);
    setBrowseError('');
    try {
      const items = await settingsApi.browseFolders(path || undefined);
      setBrowseItems(items);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load workspace folders.';
      setBrowseError(message);
      setBrowseItems([]);
    } finally {
      setIsBrowseLoading(false);
    }
  }, []);

  const closeBrowse = useCallback(() => {
    setBrowseOpen(false);
    setBrowseError('');
  }, []);

  const openBrowse = useCallback(() => {
    setBrowsePath(value || '');
    setBrowseOpen(true);
    fetchBrowse(value || '');
  }, [value, fetchBrowse]);

  useEffect(() => {
    if (!browseOpen) return;

    const handler = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        closeBrowse();
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [browseOpen, closeBrowse]);

  const handleBrowseToPath = (path: string) => {
    setBrowsePath(path);
    fetchBrowse(path);
  };

  const handleSelectFolder = (item: FolderItem) => {
    onChange(item.path);
    setFolderChanged(true);
    closeBrowse();
  };

  const handleBreadcrumbClick = (index: number) => {
    const nextPath = index < 0 ? '' : joinPath(splitPath(browsePath).slice(0, index + 1));
    handleBrowseToPath(nextPath);
  };

  const applyManualEdit = () => {
    const cleaned = manualValue.trim().replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
    onChange(cleaned);
    setIsManualEdit(false);
    setFolderChanged(true);
  };

  const cancelManualEdit = () => {
    setManualValue(value);
    setIsManualEdit(false);
  };

  const browseBreadcrumbs = splitPath(browsePath);

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label className="block text-xs sm:text-sm font-medium text-slate-700">Library Folder</label>
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {!isManualEdit && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setIsManualEdit(true);
                window.setTimeout(() => inputRef.current?.focus(), 60);
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              title="Edit path manually"
            >
              <IconPencilMinus className="h-3 w-3" />
              Edit manually
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={openBrowse}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 transition-colors"
              title="Browse workspace folders"
          >
            <IconFolder className="h-3.5 w-3.5" />
            Browse
          </button>
        </div>
      </div>

      {!isManualEdit ? (
        <div
          className={cn(
            'flex flex-wrap items-center gap-1 min-h-[36px] px-3 py-2 rounded-lg border text-sm transition-all',
            error
              ? 'border-red-300 bg-red-50'
              : folderChanged
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-slate-200 bg-slate-50',
            disabled && 'opacity-60 cursor-not-allowed',
          )}
        >
          <Home className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          {segments.length === 0 ? (
            <span className="text-slate-400 italic text-xs">Root (no folder set)</span>
          ) : (
            segments.map((segment, index) => (
              <React.Fragment key={`${segment}-${index}`}>
                <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-md text-xs font-medium',
                    index === segments.length - 1 ? 'bg-emerald-100 text-emerald-800' : 'text-slate-600',
                  )}
                >
                  {segment}
                </span>
              </React.Fragment>
            ))
          )}
          {folderChanged && <Check className="h-3.5 w-3.5 text-emerald-600 ml-auto shrink-0" />}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyManualEdit();
                if (e.key === 'Escape') cancelManualEdit();
              }}
              className={cn(
                'w-full h-9 px-3.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500',
                error ? 'border-red-300' : 'border-slate-300',
              )}
              placeholder="e.g. EQMS/Revisions"
              disabled={disabled}
            />
          </div>
          <button
            type="button"
            onClick={applyManualEdit}
            className="shrink-0 inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-xs font-medium bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
            Apply
          </button>
          <button
            type="button"
            onClick={cancelManualEdit}
            className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Workspace path:{' '}
        <code className="font-semibold text-slate-600 bg-slate-100 px-1 rounded">
          …/root:/{value || '(root)'}/&#123;fileName&#125;
        </code>
      </p>

      <FormModal
        isOpen={browseOpen}
        onClose={closeBrowse}
        title="Browse Workspace Folders"
        size="lg"
        cancelText="Cancel"
        confirmText="Done"
        onConfirm={closeBrowse}
      >
        <div ref={modalRef} className="space-y-4">
          <p className="text-xs text-slate-500 bg-slate-50 px-3.5 py-2.5 rounded-lg border border-slate-100">
            Click a folder to navigate, or <strong className="font-semibold text-slate-700">Select</strong> to choose it.
          </p>

          <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs overflow-x-auto whitespace-nowrap scrollbar-none">
            <button
              type="button"
              onClick={() => handleBrowseToPath('')}
              className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-medium shrink-0"
            >
              <Home className="h-3.5 w-3.5" />
              Root
            </button>
            {browseBreadcrumbs.map((segment, index) => (
              <React.Fragment key={`${segment}-${index}`}>
                <IconChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(index)}
                  className={cn(
                    'font-medium transition-colors shrink-0 max-w-[120px] truncate',
                    index === browseBreadcrumbs.length - 1
                      ? 'text-slate-700 cursor-default'
                      : 'text-emerald-600 hover:text-emerald-800',
                  )}
                >
                  {segment}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="space-y-1 min-h-[120px]">
            <button
              type="button"
              onClick={() => {
                onChange(browsePath || '');
                setFolderChanged(true);
                closeBrowse();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium border border-emerald-200 transition-colors mb-2"
            >
              <IconCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              Use "{browsePath || 'Root'}" as workspace folder
            </button>

            {isBrowseLoading && (
              <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading folders...</span>
              </div>
            )}

            {browseError && !isBrowseLoading && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{browseError}</span>
              </div>
            )}

            {!isBrowseLoading && !browseError && browseItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                <FolderOpen className="h-8 w-8 text-slate-300" />
                <span className="text-sm">No subfolders found here</span>
              </div>
            )}

            {!isBrowseLoading &&
              browseItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 w-full rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50 px-1 min-w-0"
                >
                  <button
                    type="button"
                    onClick={() => handleBrowseToPath(item.path)}
                    className="flex items-center gap-2 flex-1 min-w-0 px-2 py-2 text-sm text-left text-slate-700 hover:text-slate-900 transition-colors"
                  >
                    <FolderOpen className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="font-medium truncate flex-1 min-w-0">{item.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectFolder(item)}
                    className="shrink-0 text-xs px-2.5 py-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition-colors mr-1"
                  >
                    Select
                  </button>
                </div>
              ))}
          </div>
        </div>
      </FormModal>
    </div>
  );
};

export const DocumentTab: React.FC<DocumentTabProps> = ({
  documentConfig,
  officeOnlineConfig,
  onDocumentChange,
  onOfficeOnlineChange,
  onOfficeOnlineValidationChange,
}) => {
  const { showToast } = useToast();
  const [isTestingOfficeOnline, setIsTestingOfficeOnline] = useState(false);
  const [officeOnlineErrors, setOfficeOnlineErrors] = useState<Record<string, string>>({});
  const [showTenantId, setShowTenantId] = useState(false);
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showSiteId, setShowSiteId] = useState(false);
  const [showDriveId, setShowDriveId] = useState(false);
  const [storagePathPreview, setStoragePathPreview] = useState<Awaited<ReturnType<typeof settingsApi.getStoragePathPreview>> | null>(null);

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
  }, [officeOnlineConfig.libraryFolder]);

  const handleDocumentFieldChange = (key: keyof DocumentConfig, value: any) => {
    onDocumentChange({ ...documentConfig, [key]: value });
  };

  const handleOfficeOnlineFieldChange = (
    key: keyof OfficeOnlineStorageConfig,
    value: any,
  ) => {
    onOfficeOnlineChange({
      ...officeOnlineConfig,
      [key]: value,
      ...(key !== 'clearClientSecret' ? { clearClientSecret: false } : {}),
    });
  };

  const handleResetClientSecret = () => {
    onOfficeOnlineChange({
      ...officeOnlineConfig,
      clientSecret: '',
      clientSecretConfigured: false,
      clientSecretMasked: '',
      clearClientSecret: true,
    });
  };

  useEffect(() => {
    const nextErrors: Record<string, string> = {};

    if (officeOnlineConfig.enabled) {
      if (!officeOnlineConfig.graphBaseUrl?.trim()) {
        nextErrors.graphBaseUrl = 'Microsoft Graph Base URL is required.';
      } else {
        try {
          new URL(officeOnlineConfig.graphBaseUrl);
        } catch {
          nextErrors.graphBaseUrl = 'Microsoft Graph Base URL must be a valid URL.';
        }
      }

      if (!officeOnlineConfig.tenantId?.trim()) nextErrors.tenantId = 'Tenant ID is required.';
      if (!officeOnlineConfig.clientId?.trim()) nextErrors.clientId = 'Client ID is required.';
      if (!officeOnlineConfig.siteId?.trim()) nextErrors.siteId = 'Site ID is required.';
      if (!officeOnlineConfig.driveId?.trim()) nextErrors.driveId = 'Drive ID is required.';
      if (!officeOnlineConfig.libraryFolder?.trim()) nextErrors.libraryFolder = 'Library Folder is required.';
      const hasExistingSecret = Boolean(officeOnlineConfig.clientSecretConfigured && !officeOnlineConfig.clearClientSecret);
      const hasNewSecret = officeOnlineConfig.clientSecret?.trim().length > 0;
      if (!hasExistingSecret && !hasNewSecret) {
        nextErrors.clientSecret = 'Client Secret is required.';
      }
    }

    setOfficeOnlineErrors(nextErrors);
    onOfficeOnlineValidationChange?.(Object.keys(nextErrors).length === 0);
  }, [officeOnlineConfig, onOfficeOnlineValidationChange]);

  const handleTestOfficeOnlineConnection = async () => {
    if (Object.keys(officeOnlineErrors).length > 0) {
      showToast({
        type: 'error',
        title: 'Validation error',
        message: 'Please fix the Office Online configuration errors before testing the connection.',
      });
      return;
    }

    setIsTestingOfficeOnline(true);
    try {
      const result = await settingsApi.testOfficeOnlineConnection({
        enabled: officeOnlineConfig.enabled,
        graphBaseUrl: officeOnlineConfig.graphBaseUrl,
        tenantId: officeOnlineConfig.tenantId,
        clientId: officeOnlineConfig.clientId,
        clientSecret: officeOnlineConfig.clientSecret,
        siteId: officeOnlineConfig.siteId,
        driveId: officeOnlineConfig.driveId,
        libraryFolder: officeOnlineConfig.libraryFolder,
        shareLinkScope: officeOnlineConfig.shareLinkScope || 'users',
        reviewLinksEnabled: Boolean(officeOnlineConfig.reviewLinksEnabled),
      });

      showToast({
        type: 'success',
        title: 'Connection successful',
        message: result.message,
      });
    } catch (error) {
      let message = 'Unable to connect to the Office Online workspace.';
      if (error && typeof error === 'object') {
        const response = (error as { response?: { data?: any } }).response;
        const data = response?.data;
        if (typeof data === 'string' && data.trim()) {
          message = data;
        } else if (data?.message) {
          message = String(data.message);
        } else if (data?.error?.message) {
          message = String(data.error.message);
        }
      } else if (error instanceof Error && error.message.trim()) {
        message = error.message;
      }

      showToast({
        type: 'error',
        title: 'Connection failed',
        message,
      });
    } finally {
      setIsTestingOfficeOnline(false);
    }
  };

  const renderFieldError = (key: string) =>
    officeOnlineErrors[key] ? <p className="text-xs text-red-600 mt-1">{officeOnlineErrors[key]}</p> : null;

  return (
    <div className="p-4 md:p-5 space-y-4">
      <SettingsCard title="Retention & Storage" icon={<Archive className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              Max File Size (MB)
            </label>
            <input
              type="number"
              value={documentConfig.maxFileSizeMB}
              onChange={(e) => handleDocumentFieldChange('maxFileSizeMB', parseInt(e.target.value))}
              className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              min={1}
            />
            <p className="text-xs text-slate-500 mt-1">Maximum file size for document uploads</p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Office Online Workspace" icon={<Database className="h-4 w-4" />}>
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Office Online Workspace</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Configure Microsoft Graph access for revision editing and temporary Office Online workspace synchronization. MinIO remains the official storage.
                </p>
              </div>
              <Checkbox
                id="enableOfficeOnlineStorage"
                label="Enable"
                checked={!!officeOnlineConfig.enabled}
                onChange={(checked) => handleOfficeOnlineFieldChange('enabled', checked)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                Microsoft Graph Base URL
              </label>
              <input
                type="text"
                value={officeOnlineConfig.graphBaseUrl || ''}
                onChange={(e) => handleOfficeOnlineFieldChange('graphBaseUrl', e.target.value)}
                className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="https://graph.microsoft.com/v1.0"
              />
              {renderFieldError('graphBaseUrl')}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Tenant ID</label>
              <div className="relative">
                <input
                  type={showTenantId ? 'text' : 'password'}
                  value={officeOnlineConfig.tenantId || ''}
                  onChange={(e) => handleOfficeOnlineFieldChange('tenantId', e.target.value)}
                  className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. 7388a43f-f419-48da-9095-c72b48f31bb6"
                />
                <button
                  type="button"
                  onClick={() => setShowTenantId(!showTenantId)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showTenantId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {renderFieldError('tenantId')}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Client ID</label>
              <div className="relative">
                <input
                  type={showClientId ? 'text' : 'password'}
                  value={officeOnlineConfig.clientId || ''}
                  onChange={(e) => handleOfficeOnlineFieldChange('clientId', e.target.value)}
                  className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. 0bc8c12c-fa8a-4b19-b3c3-70c1c6afbae0"
                />
                <button
                  type="button"
                  onClick={() => setShowClientId(!showClientId)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showClientId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {renderFieldError('clientId')}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Client Secret</label>
              <div className="relative">
                <input
                  type={showClientSecret ? 'text' : 'password'}
                  value={officeOnlineConfig.clientSecret || ''}
                  onChange={(e) => handleOfficeOnlineFieldChange('clientSecret', e.target.value)}
                  className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder={
                    officeOnlineConfig.clientSecretConfigured
                      ? 'Stored secret is already configured'
                      : 'e.g. your_azure_client_secret'
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowClientSecret(!showClientSecret)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {officeOnlineConfig.clientSecretConfigured && !officeOnlineConfig.clearClientSecret
                  ? 'Leave blank to keep the current secret.'
                  : 'The secret will be stored server-side and will not be shown again.'}
              </p>
              {renderFieldError('clientSecret')}
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline-emerald"
                  size="sm"
                  onClick={handleResetClientSecret}
                  disabled={!officeOnlineConfig.clientSecretConfigured && !officeOnlineConfig.clientSecret}
                  className="w-full sm:w-auto"
                >
                  Reset Secret
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Site ID</label>
              <div className="relative">
                <input
                  type={showSiteId ? 'text' : 'password'}
                  value={officeOnlineConfig.siteId || ''}
                  onChange={(e) => handleOfficeOnlineFieldChange('siteId', e.target.value)}
                  className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. contoso.sharepoint.com,cc70f86d-...,e7947422-..."
                />
                <button
                  type="button"
                  onClick={() => setShowSiteId(!showSiteId)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showSiteId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {renderFieldError('siteId')}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Drive ID</label>
              <div className="relative">
                <input
                  type={showDriveId ? 'text' : 'password'}
                  value={officeOnlineConfig.driveId || ''}
                  onChange={(e) => handleOfficeOnlineFieldChange('driveId', e.target.value)}
                  className="w-full h-9 px-3.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. b!bfhwzM1mnEmf2k8b0epM2CJ0lOef_KJM..."
                />
                <button
                  type="button"
                  onClick={() => setShowDriveId(!showDriveId)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showDriveId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {renderFieldError('driveId')}
            </div>

            <div className="sm:col-span-2">
              <LibraryFolderPicker
                value={officeOnlineConfig.libraryFolder || ''}
                onChange={(value) => handleOfficeOnlineFieldChange('libraryFolder', value)}
                disabled={!officeOnlineConfig.enabled}
                error={officeOnlineErrors.libraryFolder}
              />
              {renderFieldError('libraryFolder')}
              <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3">
                <p className="text-xs font-semibold text-sky-900">Server-generated V2 workspace path</p>
                <p className="mt-1 break-all font-mono text-2xs text-sky-800">
                  {storagePathPreview?.officeOnlineWorkspace || 'Loading server-generated path…'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-sky-800">
                  This value is returned by the server using the persisted Office Online configuration and production path builder. Library Folder is the workspace root only; save a change to refresh the path.
                </p>
              </div>
              <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong className="font-semibold">Immediate effect:</strong> Changing this
                  root affects Office Online workspace sync immediately after saving. All new
                  document revisions will use the updated V2 workspace root. Existing
                  Office Online working links for already-synced revisions will remain unchanged.
                </p>
              </div>
            </div>

            <div className="sm:col-span-2 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3">
              <p className="text-xs text-sky-800 leading-relaxed">
                Office Online access is granted to named users only. Microsoft 365 authenticates internal
                users and sends its own one-time passcode to approved external guest e-mail addresses.
                Anonymous “anyone” links are not permitted for controlled revisions.
              </p>
            </div>

            <div className="sm:col-span-2">
              <Select
                label="Sharing scope"
                value={officeOnlineConfig.shareLinkScope || 'users'}
                onChange={(value) => handleOfficeOnlineFieldChange('shareLinkScope', String(value))}
                options={[
                  { value: 'users', label: 'Named users only (recommended)' },
                  { value: 'organization', label: 'People in the organization' },
                ]}
                disabled={!officeOnlineConfig.enabled}
              />
              <p className="mt-1 text-xs text-slate-500">Anonymous sharing is not available for controlled revisions.</p>
            </div>

            <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
              <Checkbox
                id="enableWordReviewLinks"
                label="Enable Word Online comment-only review links (Microsoft Graph beta)"
                checked={Boolean(officeOnlineConfig.reviewLinksEnabled)}
                onChange={(checked) => handleOfficeOnlineFieldChange('reviewLinksEnabled', checked)}
              />
              <p className="mt-1 ml-7 text-xs leading-relaxed text-amber-800">
                This requires tenant validation because Microsoft currently exposes the named “Can review” link through Graph beta. It never falls back to edit access.
              </p>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button
              type="button"
              variant="outline-emerald"
              onClick={handleTestOfficeOnlineConnection}
              disabled={isTestingOfficeOnline}
              size="sm"
              className="w-full sm:w-auto"
            >
              {isTestingOfficeOnline ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Protection & Distribution" icon={<Shield className="h-4 w-4" />}>
        <div className="space-y-4">
          <div>
            <Checkbox
              id="enableWatermark"
              label="Enable Watermarking"
              checked={documentConfig.enableWatermark}
              onChange={(checked) => handleDocumentFieldChange('enableWatermark', checked)}
            />
            <p className="text-xs text-slate-500 ml-7">
              Apply "For Preview Only" watermark to server-side document previews
            </p>
          </div>

          <div className="pt-2">
            <Checkbox
              id="allowDownload"
              label="Allow Document Download or Print"
              checked={documentConfig.allowDownload}
              onChange={(checked) => handleDocumentFieldChange('allowDownload', checked)}
            />
            <p className="text-xs text-slate-500 ml-7">
              If disabled, documents can only be viewed within the system viewer
            </p>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};
