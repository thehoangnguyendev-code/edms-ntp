import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from "@/components/ui/page/PageHeader";
import { configuration } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from '@/components/ui/button/Button';
import { useToast } from '@/components/ui/toast/Toast';
import { Loading } from "@/components/ui/loading/Loading";
import { AlertModal } from '@/components/ui/modal/AlertModal';
import { NavigationGuardModal } from "@/components/ui/modal/NavigationGuardModal";
import { SystemConfig } from './types';
import { BROWSER_TAB_TITLE_STORAGE_KEY, SECURITY_CONFIG_STORAGE_KEY } from '@/config/security';
import { settingsApi } from '@/services/api/settings';
import { useNetworkAccessDraft } from './useNetworkAccessDraft';
import { useStoragePolicyDraft } from './useStoragePolicyDraft';
import { useIntegrationChecks } from './useIntegrationChecks';
import { retentionChange, retentionLabel, retentionLockedUntil } from './tabs/storageIntegration';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { formatDate } from '@/utils/format';
import { usePermissions } from '@/hooks/usePermissions';
import { useReportUnsavedChanges } from '@/hooks/useReportUnsavedChanges';
import { DEFAULT_CONFIGURATION_PAGE, configurationPageForPath, type ConfigurationPage } from './configurationPages';
import { generalTabFromParam } from './tabs/generalTabs';
import { securityTabFromParam } from './tabs/securityTabs';
import { INTEGRATION_TAB_IDS, NOTIFICATION_TAB_IDS, PREVIEW_TAB_IDS, WATERMARK_TAB_IDS, pageTabFromParam } from './tabs/pageTabs';

const IntegrationsTabs = lazy(() => import('./tabs/IntegrationsTabs').then(m => ({ default: m.IntegrationsTabs })));
const GeneralTab = lazy(() => import('./tabs/GeneralTab').then(m => ({ default: m.GeneralTab })));
const DashboardRoleDefaults = lazy(() => import('./tabs/DashboardRoleDefaults').then(m => ({ default: m.DashboardRoleDefaults })));
const NavigationLabelsTab = lazy(() => import('./tabs/NavigationLabelsTab').then(m => ({ default: m.NavigationLabelsTab })));
const SecurityTab = lazy(() => import('./tabs/SecurityTab').then(m => ({ default: m.SecurityTab })));
const NotificationTab = lazy(() => import('./tabs/NotificationTab').then(m => ({ default: m.NotificationTab })));
const NetworkAccessPanel = lazy(() => import('./tabs/NetworkAccessPanel').then(m => ({ default: m.NetworkAccessPanel })));
const PreviewFileTab = lazy(() => import('./tabs/PreviewFileTab').then(m => ({ default: m.PreviewFileTab })));
const FeaturesTab = lazy(() => import('./tabs/FeaturesTab').then(m => ({ default: m.FeaturesTab })));
const ImageWatermarkTab = lazy(() => import('./tabs/ImageWatermarkTab').then(m => ({ default: m.ImageWatermarkTab })));

const SECURITY_CONFIG_UPDATED_EVENT = "eqms:security-config-updated";

const deepMerge = (target: any, source: any): any => {
  if (!source) return target;
  const result = { ...target };
  Object.keys(source).forEach((key) => {
    const targetValue = target[key];
    const sourceValue = source[key];
    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      result[key] = deepMerge(
        targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)
          ? targetValue
          : {},
        sourceValue
      );
    } else {
      result[key] = sourceValue;
    }
  });
  return result;
};

/**
 * Configuration is a group of pages, one menu entry each. The page follows the address; the state is keyed by the page, so a page starts from the saved configuration
 * and leaving it with edits asks first (the sidebar reads the flag set below).
 */
export const ConfigurationView: React.FC = () => {
  const location = useLocation();
  const page = configurationPageForPath(location.pathname) ?? DEFAULT_CONFIGURATION_PAGE;
  return <ConfigurationPageBody key={page.id} page={page} />;
};

const ConfigurationPageBody: React.FC<{ page: ConfigurationPage }> = ({ page }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermissionAlias } = usePermissions();
  const canManageConfiguration = hasPermissionAlias(page.managePermission);
  const [isMountLoading, setIsMountLoading] = useState(true);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<SystemConfig | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const network = useNetworkAccessDraft(canManageConfiguration && page.id === 'security');
  const storagePolicy = useStoragePolicyDraft(canManageConfiguration && page.id === 'integrations');
  const integrationChecks = useIntegrationChecks(page.id === 'integrations');
  const [retentionAcknowledged, setRetentionAcknowledged] = useState(false);
  const hasUnsavedChanges = isDirty || network.isDirty || storagePolicy.isDirty;
  useReportUnsavedChanges(`configuration-${page.id}`, hasUnsavedChanges);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [isGeneralValid, setIsGeneralValid] = useState(true);
  const [isOnlyOfficeValid, setIsOnlyOfficeValid] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateBrowserTabTitle = (displayName?: string) => {
    const nextTitle = displayName?.trim() || 'EQMS';
    if (typeof document !== 'undefined') {
      document.title = nextTitle;
    }
    window.localStorage.setItem(BROWSER_TAB_TITLE_STORAGE_KEY, nextTitle);
  };

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await settingsApi.getSystemConfiguration() as unknown as SystemConfig;
        setConfig(response);
        setOriginalConfig(JSON.parse(JSON.stringify(response)));
        window.localStorage.setItem(SECURITY_CONFIG_STORAGE_KEY, JSON.stringify(response));
        updateBrowserTabTitle(response.general?.systemDisplayName);
      } catch {
        const raw = window.localStorage.getItem(SECURITY_CONFIG_STORAGE_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as SystemConfig;
            setConfig(parsed);
            updateBrowserTabTitle(parsed.general?.systemDisplayName);
          } catch {
            // ignore
          }
        }
      } finally {
        setIsMountLoading(false);
      }
    };

    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfigChange = <K extends keyof SystemConfig>(section: K, value: SystemConfig[K]) => {
    if (!config) return;
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: value,
      };
    });
    setIsDirty(true);
  };

  const extractServerErrorMessage = (error: unknown) => {
    if (error && typeof error === "object") {
      const response = (error as { response?: { data?: any } }).response;
      const data = response?.data;
      if (typeof data === "string" && data.trim()) {
        return data;
      }
      if (data?.error?.message) return String(data.error.message);
      if (data?.message) return String(data.message);
      if (data?.error?.details?.length) return String(data.error.details[0]);
      if (data?.details?.length) return String(data.details[0]);
      if (data?.details && typeof data.details === "string") return data.details;
    }
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return "Unable to save system configuration.";
  };

  const saveConfiguration = async () => {
    if (!config || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    let systemSaved = false;
    let step: 'system' | 'network' | 'storage' = 'system';
    try {
      const delta: any = {};
      if (originalConfig) {
        Object.keys(config).forEach((key) => {
          const k = key as keyof SystemConfig;
          if (JSON.stringify(config[k]) !== JSON.stringify(originalConfig[k])) {
            delta[k] = config[k];
          }
        });
      } else {
        Object.assign(delta, config);
      }
      if (Object.keys(delta).length > 0) {
        const saved = await settingsApi.updateSystemConfiguration(delta) as unknown as SystemConfig;
        setConfig(saved);
        setOriginalConfig(JSON.parse(JSON.stringify(saved)));
        window.localStorage.setItem(SECURITY_CONFIG_STORAGE_KEY, JSON.stringify(saved));
        window.dispatchEvent(new Event(SECURITY_CONFIG_UPDATED_EVENT));
        window.dispatchEvent(new Event('eqms:branding-updated'));
        window.dispatchEvent(new Event('eqms:localization-updated'));
        updateBrowserTabTitle(saved.general?.systemDisplayName);
        setIsDirty(false);
        systemSaved = true;
      }
      // Save the network restriction last: it can immediately limit subsequent requests.
      step = 'network';
      await network.save();
      // The storage policy is written after the system settings and, like the network policy, only when it changed.
      step = 'storage';
      await storagePolicy.save();
      setShowSaveModal(false);
      showToast({
        type: "success",
        title: "Changes saved",
        message: "System configuration has been updated successfully.",
      });
    } catch (error) {
      setShowSaveModal(false);
      showToast({
        type: "error",
        title: "Save failed",
        message: `${systemSaved && step === 'network' ? 'System configuration was saved, but the network policy was not saved. Your network changes are kept. ' : ''}${systemSaved && step === 'storage' ? 'System configuration was saved, but the storage policy was not saved. Your storage changes are kept. ' : ''}${extractServerErrorMessage(error)}`,
      });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  // A change of the retention is the one thing on this page that cannot be undone, so it is acknowledged before Save.
  const pendingRetentionChange = page.id === 'integrations' ? retentionChange(originalConfig?.integrations?.storage, config?.integrations?.storage) : null;

  const handleSaveClick = () => {
    setRetentionAcknowledged(false);
    setShowSaveModal(true);
  };

  const handleResetClick = () => {
    setShowResetModal(true);
  };

  const handleResetConfirm = () => {
    network.reset();
    storagePolicy.reset();
    if (originalConfig) {
      setConfig(JSON.parse(JSON.stringify(originalConfig)));
      setIsDirty(false);
      setShowResetModal(false);
      showToast({
        type: "info",
        title: "Changes discarded",
        message: "Configuration reset to last saved state.",
      });
    }
  };


  const selectTab = (tab: string) => setSearchParams((current) => { const next = new URLSearchParams(current); next.set('tab', tab); return next; }, { replace: true });

  const renderTabContent = () => {
    if (!config) return null;
    switch (page.id) {
      case 'general':
        return (
          <GeneralTab
            config={config.general}
            onChange={(val) => handleConfigChange('general', val)}
            onValidationChange={setIsGeneralValid}
            activeTab={generalTabFromParam(searchParams.get('tab'))}
            onTabChange={selectTab}
            savedConfig={originalConfig?.general}
            extra={canManageConfiguration ? <DashboardRoleDefaults /> : null}
          />
        );
      case 'navigation-labels':
        return <NavigationLabelsTab config={config.general} onChange={(val) => handleConfigChange('general', val)} />;
      case 'security':
        return (
          <SecurityTab
            config={config.security}
            onChange={(val) => handleConfigChange('security', val)}
            activeTab={securityTabFromParam(searchParams.get('tab'))}
            onTabChange={selectTab}
            savedConfig={originalConfig?.security}
            networkChanged={network.isDirty}
            onNetworkReset={network.reset}
            networkPanel={canManageConfiguration ? <NetworkAccessPanel value={network.draft} onChange={network.setDraft} failed={network.failed} /> : null}
          />
        );
      case 'notifications':
        return (
          <NotificationTab
            config={config.notifications}
            onChange={(val) => handleConfigChange('notifications', val)}
            activeTab={pageTabFromParam(NOTIFICATION_TAB_IDS, searchParams.get('tab'))}
            onTabChange={selectTab}
            savedConfig={originalConfig?.notifications}
          />
        );
      case 'integrations':
        return (
          <IntegrationsTabs
            integrations={config.integrations}
            onIntegrationsChange={(val) => handleConfigChange('integrations', val)}
            onlyOffice={config.general.backupSettings.onlyOffice}
            onOnlyOfficeChange={(val) =>
              handleConfigChange('general', {
                ...config.general,
                backupSettings: {
                  ...config.general.backupSettings,
                  onlyOffice: val,
                },
              })
            }
            onOnlyOfficeValidationChange={setIsOnlyOfficeValid}
            onlyOfficeValid={isOnlyOfficeValid}
            storagePolicy={storagePolicy}
            checks={integrationChecks}
            saved={originalConfig}
            canManage={canManageConfiguration}
            activeTab={pageTabFromParam(INTEGRATION_TAB_IDS, searchParams.get('tab'))}
            onTabChange={selectTab}
          />
        );
      case 'preview-file':
        return (
          <PreviewFileTab
            onlyOfficeConfig={config.general.backupSettings.onlyOffice}
            onOnlyOfficeChange={(val) =>
              handleConfigChange('general', {
                ...config.general,
                backupSettings: { ...config.general.backupSettings, onlyOffice: val },
              })
            }
            documentsConfig={config.documents}
            onDocumentsChange={(val) => handleConfigChange('documents', val)}
            activeTab={pageTabFromParam(PREVIEW_TAB_IDS, searchParams.get('tab'))}
            onTabChange={selectTab}
            savedOnlyOffice={originalConfig?.general.backupSettings.onlyOffice}
            savedDocuments={originalConfig?.documents}
          />
        );
      case 'image-watermark':
        return (
          <ImageWatermarkTab
            config={config.general}
            onChange={(val) => handleConfigChange('general', val)}
            activeTab={pageTabFromParam(WATERMARK_TAB_IDS, searchParams.get('tab'))}
            onTabChange={selectTab}
            savedConfig={originalConfig?.general}
          />
        );
      case 'features':
        return <FeaturesTab features={config.features} onChange={(val) => handleConfigChange('features', val)} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      {/* Header */}
      <PageHeader
        title={page.label}
        breadcrumbItems={configuration(navigate, page.label)}
        actions={
          canManageConfiguration ? (
            <>
              <Button variant="outline-emerald" onClick={handleResetClick} disabled={!hasUnsavedChanges || isSaving} size="sm" className="gap-2">
                Reset
              </Button>
              <Button variant="outline-emerald" onClick={handleSaveClick} disabled={!hasUnsavedChanges || !isGeneralValid || !isOnlyOfficeValid || !storagePolicy.isValid || isSaving} size="sm" className="gap-2" loading={isSaving}>
                Save
              </Button>
            </>
          ) : undefined
        }
      />

      <AlertModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onConfirm={saveConfiguration}
        isLoading={isSaving}
        confirmDisabled={Boolean(pendingRetentionChange) && !retentionAcknowledged}
        type="confirm"
        title="Save System Configuration?"
        description={
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              You are about to save changes to System Configuration. This action will be recorded in the Audit Trail.
            </p>
            {pendingRetentionChange && (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
                <p className="text-sm font-medium text-amber-900">
                  Retention of stored records: {retentionLabel(pendingRetentionChange.from)} → {retentionLabel(pendingRetentionChange.to)}
                </p>
                <p className="text-xs text-amber-900">
                  Records stored from now on are locked until {formatDate(retentionLockedUntil(pendingRetentionChange.to))}. Nobody, administrators included, can shorten or delete
                  them before then. Objects already stored keep the period they were written with. This cannot be undone.
                </p>
                <Checkbox
                  id="confirm-retention-change"
                  label="I understand this cannot be undone."
                  checked={retentionAcknowledged}
                  onChange={setRetentionAcknowledged}
                />
              </div>
            )}
            <p className="text-sm font-medium text-emerald-700">
              Please confirm to proceed.
            </p>
        </div>
        }
        confirmText="Save"
        cancelText="Cancel"
      />

      {/* Reset Confirmation Modal */}
      <NavigationGuardModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleResetConfirm}
        mode="discard"
        currentPageTitle="System Configuration"
        title="Discard Unsaved Changes?"
        description={
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              All unsaved changes will be lost and the configuration will be reset to the last saved state.
            </p>
            <p className="text-sm font-medium text-amber-700">
              This action cannot be undone.
            </p>
          </div>
        }
        primaryActionLabel="Discard Changes"
        secondaryActionLabel="Keep Editing"
      />

      {/* The page */}
      <fieldset disabled={isSaving} className="min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Suspense fallback={<Loading text="Loading configuration section..." className="min-h-48 py-12" />}>
          {isMountLoading
            ? <Loading text="Loading System Configuration..." className="min-h-48 py-12" />
            : renderTabContent()}
        </Suspense>
      </fieldset>
    </div>
  );
};
