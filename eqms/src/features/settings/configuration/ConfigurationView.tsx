import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Save, RotateCcw, Settings, Shield, FileText, Bell, Plug, ToggleLeft, ChevronLeft, Menu } from 'lucide-react';
import { PageHeader } from "@/components/ui/page/PageHeader";
import { configuration } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from '@/components/ui/button/Button';
import { TabNav } from '@/components/ui/tabs/TabNav';
import { cn } from '@/components/ui/utils';
import { useToast } from '@/components/ui/toast/Toast';
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { AlertModal } from '@/components/ui/modal/AlertModal';
import { NavigationGuardModal } from "@/components/ui/modal/NavigationGuardModal";
import { SystemConfig } from './types';
import { GeneralTab } from './tabs/GeneralTab';
import { NavigationLabelsTab } from './tabs/NavigationLabelsTab';
import { SecurityTab } from './tabs/SecurityTab';
import { DocumentTab } from './tabs/DocumentTab';
import { NotificationTab } from './tabs/NotificationTab';
import { IntegrationTab } from './tabs/IntegrationTab';
import { FeaturesTab } from './tabs/FeaturesTab';
import { BROWSER_TAB_TITLE_STORAGE_KEY, SECURITY_CONFIG_STORAGE_KEY } from '@/config/security';
import { settingsApi } from '@/services/api/settings';
import { usePermissions } from '@/hooks/usePermissions';
import { IconDragDrop, IconFileDescription, IconPlugConnected, IconSettings2 } from '@tabler/icons-react';

type TabId = 'general' | 'navigation' | 'security' | 'document' | 'notification' | 'integration' | 'features';

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
    id: 'document' as TabId,
    label: 'Documents',
    icon: IconFileDescription,
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
  const canManageConfiguration = hasPermissionAlias('settings.configuration.manage') || hasPermissionAlias('settings.configuration.edit');
  const [isMountLoading, setIsMountLoading] = useState(true);
  const getTabFromSearch = (search: string): TabId => {
    const tab = new URLSearchParams(search).get('tab');
    if (tab === 'general' || tab === 'navigation' || tab === 'security' || tab === 'document' || tab === 'notification' || tab === 'integration' || tab === 'features') {
      return tab;
    }
    return 'general';
  };

  const [activeTab, setActiveTab] = useState<TabId>(() => getTabFromSearch(location.search));
  // On narrow screens, land on the section list first (like a settings menu) unless the URL
  // explicitly deep-links to a tab — then open straight to that section's detail view.
  const [mobileListView, setMobileListView] = useState<boolean>(
    () => !new URLSearchParams(location.search).get('tab'),
  );
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<SystemConfig | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isGeneralValid, setIsGeneralValid] = useState(true);
  const [isOfficeOnlineValid, setIsOfficeOnlineValid] = useState(true);
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
    if (!config) return;
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
      const saved = await settingsApi.updateSystemConfiguration(delta) as unknown as SystemConfig;
      setConfig(saved);
      setOriginalConfig(JSON.parse(JSON.stringify(saved)));
      window.localStorage.setItem(SECURITY_CONFIG_STORAGE_KEY, JSON.stringify(saved));
      window.dispatchEvent(new Event(SECURITY_CONFIG_UPDATED_EVENT));
      window.dispatchEvent(new Event('eqms:branding-updated'));
      window.dispatchEvent(new Event('eqms:localization-updated'));
      updateBrowserTabTitle(saved.general?.systemDisplayName);
      setIsDirty(false);
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
        message: extractServerErrorMessage(error),
      });
    }
  };

  const handleSaveClick = () => {
    setShowSaveModal(true);
  };

  const handleResetClick = () => {
    setShowResetModal(true);
  };

  const handleResetConfirm = () => {
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
        return <GeneralTab config={config.general} onChange={(val) => handleConfigChange('general', val)} onValidationChange={setIsGeneralValid} />;
      case 'navigation':
        return <NavigationLabelsTab config={config.general} onChange={(val) => handleConfigChange('general', val)} />;
      case 'security':
        return <SecurityTab config={config.security} onChange={(val) => handleConfigChange('security', val)} />;
      case 'document':
        return (
          <DocumentTab
            documentConfig={config.documents}
            officeOnlineConfig={config.general.backupSettings.officeOnline}
            onDocumentChange={(val) => handleConfigChange('documents', val)}
            onOfficeOnlineChange={(val) =>
              handleConfigChange('general', {
                ...config.general,
                backupSettings: {
                  ...config.general.backupSettings,
                  officeOnline: val,
                },
              })
            }
            onOfficeOnlineValidationChange={setIsOfficeOnlineValid}
          />
        );
      case 'notification':
        return <NotificationTab config={config.notifications} onChange={(val) => handleConfigChange('notifications', val)} />;
      case 'integration':
        return <IntegrationTab config={config.integrations} onChange={(val) => handleConfigChange('integrations', val)} />;
      case 'features':
        return <FeaturesTab features={config.features} onChange={(val) => handleConfigChange('features', val)} />;
      default:
        return null;
    }
  };

  if (isMountLoading) {
    return <FullPageLoading text="Loading System Configuration..." />;
  }

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      {/* Header */}
      <PageHeader
        title="Configuration"
        breadcrumbItems={configuration(navigate, TABS.find(t => t.id === activeTab)?.label)}
        actions={
          canManageConfiguration ? (
            <>
              <Button variant="outline-emerald" onClick={handleResetClick} disabled={!isDirty} size="sm" className="gap-2">
                Reset
              </Button>
              <Button variant="outline-emerald" onClick={handleSaveClick} disabled={!isDirty || !isGeneralValid || !isOfficeOnlineValid} size="sm" className="gap-2">
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
        type="confirm"
        title="Save system configuration?"
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
        title="Discard unsaved changes?"
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

      {/* Section list (sidebar on md+, drill-in menu on mobile) + content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden md:flex md:items-stretch">
        <div
          className={cn(
            "md:w-72 md:shrink-0 md:border-r md:border-slate-200 p-2 md:p-3",
            mobileListView ? "block" : "hidden md:block",
          )}
        >
          <TabNav
            variant="vertical"
            tabs={TABS}
            activeTab={activeTab}
            onChange={(id) => {
              handleTabClick(id as TabId);
              setMobileListView(false);
            }}
            ariaLabel="Configuration sections"
            compactVertical
          />
        </div>

        <div className={cn("min-w-0 flex-1", mobileListView ? "hidden md:block" : "block")}>
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileListView(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Back to settings list"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="text-sm font-semibold text-slate-900">
              {TABS.find((t) => t.id === activeTab)?.label}
            </p>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
