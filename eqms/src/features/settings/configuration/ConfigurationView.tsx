import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Shield, Bell, Menu, Cloud, Server, Check, Eye } from 'lucide-react';
import { PageHeader } from "@/components/ui/page/PageHeader";
import { configuration } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from '@/components/ui/button/Button';
import { TabNav } from '@/components/ui/tabs/TabNav';
import { useToast } from '@/components/ui/toast/Toast';
import { Loading } from "@/components/ui/loading/Loading";
import { AlertModal } from '@/components/ui/modal/AlertModal';
import { NavigationGuardModal } from "@/components/ui/modal/NavigationGuardModal";
import { SystemConfig } from './types';
import { BROWSER_TAB_TITLE_STORAGE_KEY, SECURITY_CONFIG_STORAGE_KEY } from '@/config/security';
import { settingsApi } from '@/services/api/settings';
import { useNetworkAccessDraft } from './useNetworkAccessDraft';
import { usePermissions } from '@/hooks/usePermissions';
import { IconDragDrop, IconFileIsr, IconPlugConnected, IconSettings2 } from '@tabler/icons-react';

const GeneralTab = lazy(() => import('./tabs/GeneralTab').then(m => ({ default: m.GeneralTab })));
const DashboardRoleDefaults = lazy(() => import('./tabs/DashboardRoleDefaults').then(m => ({ default: m.DashboardRoleDefaults })));
const NavigationLabelsTab = lazy(() => import('./tabs/NavigationLabelsTab').then(m => ({ default: m.NavigationLabelsTab })));
const SecurityTab = lazy(() => import('./tabs/SecurityTab').then(m => ({ default: m.SecurityTab })));
const OnlyOfficeTab = lazy(() => import('./tabs/OnlyOfficeTab').then(m => ({ default: m.OnlyOfficeTab })));
const NotificationTab = lazy(() => import('./tabs/NotificationTab').then(m => ({ default: m.NotificationTab })));
const IntegrationTab = lazy(() => import('./tabs/IntegrationTab').then(m => ({ default: m.IntegrationTab })));
const StorageUsagePanel = lazy(() => import('./tabs/StorageUsagePanel').then(m => ({ default: m.StorageUsagePanel })));
const NetworkAccessPanel = lazy(() => import('./tabs/NetworkAccessPanel').then(m => ({ default: m.NetworkAccessPanel })));
const PreviewFileTab = lazy(() => import('./tabs/PreviewFileTab').then(m => ({ default: m.PreviewFileTab })));
const FeaturesTab = lazy(() => import('./tabs/FeaturesTab').then(m => ({ default: m.FeaturesTab })));

type TabId = 'general' | 'navigation' | 'security' | 'notification' | 'integration' | 'preview' | 'features';

const TABS = [
  {
    id: 'general' as TabId,
    label: 'General',
    icon: IconSettings2,
  },
  {
    id: 'navigation' as TabId,
    label: 'Navigation Labels',
    icon: Menu,
  },
  {
    id: 'security' as TabId,
    label: 'Security',
    icon: Shield,
  },
  {
    id: 'notification' as TabId,
    label: 'Notifications',
    icon: Bell,
  },
  {
    id: 'integration' as TabId,
    label: 'Integrations',
    icon: IconPlugConnected,
  },
  {
    id: 'preview' as TabId,
    label: 'Preview File',
    icon: IconFileIsr,
  },
  {
    id: 'features' as TabId,
    label: 'Features',
    icon: IconDragDrop,
  },
];

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

export const ConfigurationView: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermissionAlias } = usePermissions();
  const canManageConfiguration = hasPermissionAlias('settings.configuration.manage');
  const [isMountLoading, setIsMountLoading] = useState(true);
  const getTabFromSearch = (search: string): TabId => {
    const tab = new URLSearchParams(search).get('tab');
    if (tab === 'general' || tab === 'navigation' || tab === 'security' || tab === 'notification' || tab === 'integration' || tab === 'preview' || tab === 'features') {
      return tab;
    }
    return 'general';
  };

  const [activeTab, setActiveTab] = useState<TabId>(() => getTabFromSearch(location.search));
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<SystemConfig | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const network = useNetworkAccessDraft(canManageConfiguration && activeTab === 'security');
  const hasUnsavedChanges = isDirty || network.isDirty;
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
    setActiveTab(getTabFromSearch(location.search));
  }, [location.search]);

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

  const handleTabClick = (tabId: TabId) => {
    const params = new URLSearchParams(location.search);
    params.set('tab', tabId);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

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
      await network.save();
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
        message: `${systemSaved ? 'System configuration was saved, but the network policy was not saved. Your network changes are kept. ' : ''}${extractServerErrorMessage(error)}`,
      });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleSaveClick = () => {
    setShowSaveModal(true);
  };

  const handleResetClick = () => {
    setShowResetModal(true);
  };

  const handleResetConfirm = () => {
    network.reset();
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


  const renderTabContent = () => {
    if (!config) return null;
    switch (activeTab) {
      case 'general':
        return <><GeneralTab config={config.general} onChange={(val) => handleConfigChange('general', val)} onValidationChange={setIsGeneralValid} />{canManageConfiguration && <div className="px-4 pb-5 md:px-5"><DashboardRoleDefaults /></div>}</>;
      case 'navigation':
        return <NavigationLabelsTab config={config.general} onChange={(val) => handleConfigChange('general', val)} />;
      case 'security':
        return <><SecurityTab config={config.security} onChange={(val) => handleConfigChange('security', val)} />{canManageConfiguration && <div className="px-4 pb-5 md:px-5"><NetworkAccessPanel value={network.draft} onChange={network.setDraft} failed={network.failed} /></div>}</>;
      case 'notification':
        return (
          <NotificationTab
            config={config.notifications}
            onChange={(val) => handleConfigChange('notifications', val)}
            toastPosition={config.general.appearance?.toastPosition ?? 'top-right'}
            onToastPositionChange={(toastPosition) => handleConfigChange('general', { ...config.general, appearance: { ...config.general.appearance, toastPosition } })}
            toastDurationSeconds={config.general.appearance?.toastDurationSeconds}
            onToastDurationChange={(toastDurationSeconds) => handleConfigChange('general', { ...config.general, appearance: { ...config.general.appearance, toastDurationSeconds } })}
          />
        );;
      case 'integration':
        return (
          <div className="space-y-0">
            <IntegrationTab config={config.integrations} onChange={(val) => handleConfigChange('integrations', val)} />
            {canManageConfiguration && <div className="px-4 pb-5 md:px-5"><StorageUsagePanel /></div>}
            <OnlyOfficeTab
              embedded
              onlyOfficeConfig={config.general.backupSettings.onlyOffice}
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
            />
          </div>
        );
      case 'preview':
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
        title="Configuration"
        breadcrumbItems={configuration(navigate, TABS.find(t => t.id === activeTab)?.label)}
        actions={
          canManageConfiguration ? (
            <>
              <Button variant="outline-emerald" onClick={handleResetClick} disabled={!hasUnsavedChanges || isSaving} size="sm" className="gap-2">
                Reset
              </Button>
              <Button variant="outline-emerald" onClick={handleSaveClick} disabled={!hasUnsavedChanges || !isGeneralValid || !isOnlyOfficeValid || isSaving} size="sm" className="gap-2" loading={isSaving}>
                Save Changes
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
        type="confirm"
        title="Save System Configuration?"
        description={
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              You are about to save changes to System Configuration. This action will be recorded in the Audit Trail.
            </p>
            <p className="text-sm font-medium text-emerald-700">
              Please confirm to proceed.
            </p>
        </div>
        }
        confirmText="Save Changes"
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
        primaryActionLabel="Discard changes"
        secondaryActionLabel="Keep editing"
      />

      {/* Section tabs + content */}
      <fieldset disabled={isSaving} className="min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav
          tabs={TABS}
          activeTab={activeTab}
          onChange={(id) => handleTabClick(id as TabId)}
          ariaLabel="Configuration sections"
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <Suspense fallback={<Loading text="Loading configuration section..." className="min-h-48 py-12" />}>
              {isMountLoading
                ? <Loading text="Loading System Configuration..." className="min-h-48 py-12" />
                : renderTabContent()}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </fieldset>
    </div>
  );
};
