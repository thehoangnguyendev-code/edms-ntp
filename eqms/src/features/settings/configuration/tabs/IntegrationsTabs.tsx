import React, { lazy, Suspense } from 'react';
import { IconDatabase, IconChartBar, IconFileText } from '@tabler/icons-react';
import { Loading } from '@/components/ui/loading/Loading';
import type { IntegrationConfig, GeneralConfig } from '../types';
import type { OnlyOfficeStorageConfig } from '../types';
import { ConfigTabs, HISTORY_TAB } from './ConfigTabs';
import { ConfigHistory } from './ConfigHistory';
import type { IntegrationTabId } from './pageTabs';

const IntegrationTab = lazy(() => import('./IntegrationTab').then((m) => ({ default: m.IntegrationTab })));
const StorageUsagePanel = lazy(() => import('./StorageUsagePanel').then((m) => ({ default: m.StorageUsagePanel })));
const OnlyOfficeTab = lazy(() => import('./OnlyOfficeTab').then((m) => ({ default: m.OnlyOfficeTab })));

const ALL_TABS = [
  { id: 'storage', label: 'Storage', icon: IconDatabase },
  { id: 'storage-usage', label: 'Storage Usage', icon: IconChartBar },
  { id: 'onlyoffice', label: 'OnlyOffice', icon: IconFileText },
  HISTORY_TAB,
] as const;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

interface IntegrationsTabsProps {
  integrations: IntegrationConfig;
  onIntegrationsChange: (config: IntegrationConfig) => void;
  onlyOffice: OnlyOfficeStorageConfig;
  onOnlyOfficeChange: (config: OnlyOfficeStorageConfig) => void;
  /** Tells the page whether the OnlyOffice settings can be saved. */
  onOnlyOfficeValidationChange: (isValid: boolean) => void;
  /** What was last saved, to mark the tabs that hold a change that is not saved yet. */
  saved?: { integrations: IntegrationConfig; general: GeneralConfig } | null;
  onlyOfficeValid: boolean;
  /** Storage Usage is for the people who may manage the configuration; without it that tab is left out. */
  canManage: boolean;
  activeTab: IntegrationTabId;
  onTabChange: (tab: IntegrationTabId) => void;
}

/**
 * The Integrations page: the storage form, the storage measurements and the OnlyOffice server, one to a tab. The OnlyOffice form stays mounted (hidden) while
 * another tab is open, because it is what tells the page whether the settings are valid: unmounting it would leave the page with an old answer.
 */
export const IntegrationsTabs: React.FC<IntegrationsTabsProps> = ({
  integrations, onIntegrationsChange, onlyOffice, onOnlyOfficeChange, onOnlyOfficeValidationChange, saved, onlyOfficeValid, canManage, activeTab: requested, onTabChange,
}) => {
  const tabs = React.useMemo(() => ALL_TABS.filter((tab) => tab.id !== 'storage-usage' || canManage), [canManage]);
  const activeTab = tabs.some((tab) => tab.id === requested) ? requested : tabs[0].id;
  const changed = React.useMemo(() => {
    const set = new Set<IntegrationTabId>();
    if (!saved) return set;
    if (!same(integrations, saved.integrations)) set.add('storage');
    if (!same(onlyOffice, saved.general?.backupSettings?.onlyOffice)) set.add('onlyoffice');
    return set;
  }, [integrations, onlyOffice, saved]);
  const invalid = React.useMemo(() => (onlyOfficeValid ? new Set<IntegrationTabId>() : new Set<IntegrationTabId>(['onlyoffice'])), [onlyOfficeValid]);

  return (
    <ConfigTabs
      tabs={tabs}
      activeTab={activeTab}
      onChange={onTabChange}
      changed={changed}
      invalid={invalid}
      onReset={saved ? (tab) => {
        if (tab === 'storage') onIntegrationsChange(JSON.parse(JSON.stringify(saved.integrations)));
        else if (tab === 'onlyoffice' && saved.general?.backupSettings?.onlyOffice) onOnlyOfficeChange(JSON.parse(JSON.stringify(saved.general.backupSettings.onlyOffice)));
      } : undefined}
      ariaLabel="Integration sections"
      idPrefix="integrations"
    >
      <Suspense fallback={<Loading />}>
        {activeTab === 'storage' && <IntegrationTab config={integrations} onChange={onIntegrationsChange} />}
        {activeTab === 'storage-usage' && canManage && <StorageUsagePanel />}
        <div hidden={activeTab !== 'onlyoffice'}>
          <OnlyOfficeTab onlyOfficeConfig={onlyOffice} onOnlyOfficeChange={onOnlyOfficeChange} onOnlyOfficeValidationChange={onOnlyOfficeValidationChange} />
        </div>
        {activeTab === 'history' && <ConfigHistory page="integrations" />}
      </Suspense>
    </ConfigTabs>
  );
};
