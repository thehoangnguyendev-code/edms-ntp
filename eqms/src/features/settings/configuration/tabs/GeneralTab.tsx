import React, { useState, useEffect } from 'react';
import { GeneralConfig } from '../types';
import { Select } from '@/components/ui/select/Select';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { ImageIcon, PanelTop } from 'lucide-react';
import { Button } from '@/components/ui/button/Button';
import { useToast } from '@/components/ui/toast/Toast';
import { settingsApi } from '@/services/api/settings';
import { DEFAULT_FOOTER_LEFT, DEFAULT_SYSTEM_HEADER_TITLE, type LoginCarouselConfig } from '@/services/api/branding';
import { Switch } from '@/components/ui/switch';
import { AppShortcutSection } from './AppShortcutSection';
import { AuditTabViewSection } from './AuditTabViewSection';
import { ColorPickerInput } from '@/components/ui/color-picker/ColorPickerInput';
import { DEFAULT_ALTERNATING_RECORD_COLOR } from '@/config/record-stripes';
import { PageBackgroundEditor } from './PageBackgroundEditor';
import { LoginCarouselEditor } from './LoginCarouselEditor';
import { ConfigTabs } from './ConfigTabs';
import { ConfigHistory } from './ConfigHistory';
import { GENERAL_TABS, changedGeneralTabs, revertGeneralTab, type GeneralTabId } from './generalTabs';
import { DEFAULT_MENU_COLOR } from '@/config/menu-colors';
import type { PageBackground } from '@/config/page-background';

interface GeneralTabProps {
  config: GeneralConfig;
  onChange: (config: GeneralConfig) => void;
  onValidationChange?: (isValid: boolean) => void;
  /** The tab that is open. When the page keeps it (in the address), it is given here with onTabChange; otherwise the tab keeps its own. */
  activeTab?: GeneralTabId;
  onTabChange?: (tab: GeneralTabId) => void;
  /** What was last saved, to mark the tabs that hold a change that is not saved yet. */
  savedConfig?: GeneralConfig | null;
  /** Drawn at the end of the Module Display tab (the Dashboard defaults by role, which are saved on their own). */
  extra?: React.ReactNode;
}


const BrandImagePreview: React.FC<{
  src?: string;
  alt: string;
  variant: 'logo' | 'sidebar' | 'favicon';
}> = ({ src, alt, variant }) => {
  const [failed, setFailed] = useState(false);
  const PreviewIcon = variant === 'favicon' ? PanelTop : ImageIcon;

  useEffect(() => setFailed(false), [src]);

  const hasImage = Boolean(src) && !failed;
  const placeholderClasses = variant !== 'favicon'
    ? 'rounded-md bg-emerald-50 text-emerald-600'
    : 'rounded-md bg-sky-50 text-sky-600';

  return (
    <div
      className={
        variant === 'logo'
          ? `relative flex h-10 w-24 items-center justify-center overflow-hidden ${hasImage ? '' : placeholderClasses}`
          : `relative flex h-10 w-10 items-center justify-center overflow-hidden ${hasImage ? '' : placeholderClasses}`
      }
    >
      {!hasImage && <PreviewIcon className={variant === 'logo' ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden="true" />}
      {hasImage && (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};



export const GeneralTab: React.FC<GeneralTabProps> = ({ config, onChange, onValidationChange, activeTab: activeTabProp, onTabChange, savedConfig, extra }) => {
  const [ownTab, setOwnTab] = useState<GeneralTabId>('branding');
  const activeTab = activeTabProp ?? ownTab;
  const selectTab = (tab: GeneralTabId) => { setOwnTab(tab); onTabChange?.(tab); };
  const changedTabs = React.useMemo(() => changedGeneralTabs(config, savedConfig), [config, savedConfig]);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const collapsedSidebarLogoInputRef = React.useRef<HTMLInputElement>(null);
  const faviconInputRef = React.useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const locale = config.locale || {} as any;

  const handleChange = (key: keyof GeneralConfig, value: any) => {
    if (key === 'systemSidebarCollapsedLogo') {
      onChange({
        ...config,
        appearance: {
          ...config.appearance,
          primaryColor: config.appearance?.primaryColor ?? '#10b981',
          compactMode: config.appearance?.compactMode ?? false,
          showBreadcrumbs: config.appearance?.showBreadcrumbs ?? true,
          sidebarDefaultCollapsed: config.appearance?.sidebarDefaultCollapsed ?? false,
          animationsEnabled: config.appearance?.animationsEnabled ?? true,
          theme: config.appearance?.theme ?? 'light',
          showSidebarUserProfile: config.appearance?.showSidebarUserProfile ?? false,
          compactDesktopFilters: config.appearance?.compactDesktopFilters ?? false,
          systemSidebarCollapsedLogo: value,
        },
      });
      return;
    }
    onChange({ ...config, [key]: value });
  };

  const handleAppearanceChange = (key: keyof GeneralConfig['appearance'], value: boolean | string | PageBackground | LoginCarouselConfig | null) => {
    onChange({
      ...config,
      appearance: {
        ...config.appearance,
        primaryColor: config.appearance?.primaryColor ?? '#10b981',
        compactMode: config.appearance?.compactMode ?? false,
        showBreadcrumbs: config.appearance?.showBreadcrumbs ?? true,
        sidebarDefaultCollapsed: config.appearance?.sidebarDefaultCollapsed ?? false,
        animationsEnabled: config.appearance?.animationsEnabled ?? true,
        theme: config.appearance?.theme ?? 'light',
        systemSidebarCollapsedLogo: config.appearance?.systemSidebarCollapsedLogo ?? config.systemSidebarCollapsedLogo,
        showSidebarUserProfile: config.appearance?.showSidebarUserProfile ?? false,        compactDesktopFilters: config.appearance?.compactDesktopFilters ?? false,
        [key]: value,
      },
    });
  };

  const collapsedSidebarLogo = config.appearance?.systemSidebarCollapsedLogo || config.systemSidebarCollapsedLogo || '';

  const handleLocaleChange = (key: keyof GeneralConfig['locale'], value: any) => {
    onChange({
      ...config,
      locale: {
        ...(config.locale || {}),
        [key]: value,
      } as any,
    });
  };

  const selectBrandImage = async (file: File | undefined, key: 'systemLogo' | 'systemSidebarCollapsedLogo' | 'systemFavicon', maxBytes: number) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast({ type: 'error', title: 'Invalid file', message: 'Please select an image file.' });
      return;
    }
    if (file.size > maxBytes) {
      const label = key === 'systemFavicon' ? 'favicon' : key === 'systemSidebarCollapsedLogo' ? 'collapsed sidebar logo' : 'logo';
      showToast({ type: 'error', title: 'File too large', message: `The ${label} must be smaller than ${Math.round(maxBytes / 1024)} KB.` });
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    handleChange(key, dataUrl);
  };


  return (
    <ConfigTabs
      tabs={GENERAL_TABS}
      activeTab={activeTab}
      onChange={selectTab}
      changed={changedTabs}
      onReset={savedConfig ? (tab) => onChange(revertGeneralTab(config, savedConfig, tab)) : undefined}
      ariaLabel="General configuration sections"
      idPrefix="general"
    >
        {activeTab === 'branding' && (
          <div className="space-y-6">
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">System Identity</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">
                    System Name (Internal)
                  </label>
                  <input
                    type="text"
                    value={config.systemName}
                    onChange={(e) => handleChange('systemName',e.target.value)}
                    className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="EQMS Enterprise"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Internal system identifier
                  </p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">
                    Display Name (Browser Tab)
                  </label>
                  <input
                    type="text"
                    value={config.systemDisplayName}
                    onChange={(e) => handleChange('systemDisplayName',e.target.value)}
                    className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="EQMS - Quality Management System"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Displayed in browser tab title
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Header</h3>
              <label htmlFor="system-header-title" className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">Header Title (Dashboard)</label>
              <input
                id="system-header-title"
                type="text"
                value={config.systemHeaderTitle ?? ''}
                onChange={(e) => handleChange('systemHeaderTitle', e.target.value.replace(/[\r\n\t]+/g, ' ').slice(0, 120))}
                maxLength={120}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder={DEFAULT_SYSTEM_HEADER_TITLE}
              />
              <p className="mt-1 text-xs text-slate-500">
                Shown in the top bar of the Dashboard on desktop, and stays there while the page is scrolled. Leave empty to use “{DEFAULT_SYSTEM_HEADER_TITLE}”.
              </p>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Footer</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="systemFooterLeft" className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">Left Footer</label>
                  <input
                    id="systemFooterLeft"
                    type="text"
                    value={config.systemFooterLeft ?? DEFAULT_FOOTER_LEFT}
                    onChange={(e) => handleChange('systemFooterLeft', e.target.value.replace(/[\r\n]+/g, ' ').slice(0, 500))}
                    maxLength={500}
                    className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="© {year} Your Company. All rights reserved."
                  />
                  <p className="mt-1 text-xs text-slate-500">Shown at the left of the footer. Use <code>{'{year}'}</code> to insert the current year.</p>
                </div>
                <div>
                  <label htmlFor="systemFooterRight" className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">Right Footer</label>
                  <input
                    id="systemFooterRight"
                    type="text"
                    value={config.systemFooterRight ?? ''}
                    onChange={(e) => handleChange('systemFooterRight', e.target.value.replace(/[\r\n]+/g, ' ').slice(0, 500))}
                    maxLength={500}
                    className="w-full h-9 px-3 text-sm text-right border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g. Version, hotline or support e-mail"
                  />
                  <p className="mt-1 text-xs text-slate-500">Always shown at the right of the footer. Leave empty to show nothing there.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 cursor-pointer select-none">
                  <Switch checked={config.footerShowOnDesktop ?? true} onChange={(on) => handleChange('footerShowOnDesktop', on)} />
                  Show footer on Desktop and Tablet
                </label>
                <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 cursor-pointer select-none">
                  <Switch checked={config.footerShowOnMobile ?? false} onChange={(on) => handleChange('footerShowOnMobile', on)} />
                  Show footer on Mobile
                </label>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Logos & Browser Icon</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">Application Logo</label>
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <BrandImagePreview src={config.systemLogo} alt="Application logo preview" variant="logo" />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline-emerald" onClick={() => logoInputRef.current?.click()}>Upload Logo</Button>
                      {config.systemLogo&&<Button type="button" size="sm" variant="ghost" onClick={() => handleChange('systemLogo','')}>Reset</Button>}
                    </div>
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => { void selectBrandImage(e.target.files?.[0],'systemLogo',5*1024*1024); e.currentTarget.value=''; }} />
                  <p className="text-xs text-slate-500 mt-1">Used in the sidebar and all authentication screens. PNG, JPG, SVG or WebP; max 5 MB.</p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">Collapsed Sidebar Logo</label>
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <BrandImagePreview src={collapsedSidebarLogo} alt="Collapsed sidebar logo preview" variant="sidebar" />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline-emerald" onClick={() => collapsedSidebarLogoInputRef.current?.click()}>Upload Compact Logo</Button>
                      {collapsedSidebarLogo&&<Button type="button" size="sm" variant="ghost" onClick={() => handleChange('systemSidebarCollapsedLogo','')}>Reset</Button>}
                    </div>
                  </div>
                  <input ref={collapsedSidebarLogoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => { void selectBrandImage(e.target.files?.[0],'systemSidebarCollapsedLogo',5*1024*1024); e.currentTarget.value=''; }} />
                  <p className="text-xs text-slate-500 mt-1">Used only when the sidebar is collapsed. Square PNG, JPG, SVG or WebP; max 5 MB. Falls back to Application Logo when not configured.</p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">Browser Tab Icon (Favicon)</label>
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <BrandImagePreview src={config.systemFavicon} alt="Favicon preview" variant="favicon" />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline-emerald" onClick={() => faviconInputRef.current?.click()}>Upload Favicon</Button>
                      {config.systemFavicon&&<Button type="button" size="sm" variant="ghost" onClick={() => handleChange('systemFavicon','')}>Reset</Button>}
                    </div>
                  </div>
                  <input ref={faviconInputRef} type="file" accept="image/png,image/svg+xml,image/x-icon" className="hidden" onChange={(e) => { void selectBrandImage(e.target.files?.[0],'systemFavicon',1024*1024); e.currentTarget.value=''; }} />
                  <p className="text-xs text-slate-500 mt-1">Used in the browser tab. Square PNG, SVG or ICO; max 1 MB.</p>
                </div>
              </div>
            </div>
            <AppShortcutSection config={config} onChange={onChange} />
          </div>
          </div>
        )}

        {activeTab === 'sign-in' && (
          <div className="space-y-6">
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Sign-in Screen</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Select
                  label="Sign-in screen layout"
                  value={config.appearance?.loginLayout ?? 'CLASSIC'}
                  enableSearch={false}
                  onChange={(val) => handleAppearanceChange('loginLayout', val)}
                  options={[
                    { label: 'Classic', value: 'CLASSIC' },
                    { label: 'Split with product panel', value: 'SPLIT' },
                  ]}
                />
              </div>
              {(config.appearance?.loginLayout ?? 'CLASSIC') === 'SPLIT' && (
                <LoginCarouselEditor value={config.appearance?.loginCarousel} logo={config.systemLogo} onChange={(value) => handleAppearanceChange('loginCarousel', value)} />
              )}
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Authentication Background</h3>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <PageBackgroundEditor title="Authentication" allowImage value={config.appearance?.authBackground} onChange={(value) => handleAppearanceChange('authBackground', value)} />
              </div>
            </div>
          </div>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-6">
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Sidebar</h3>
              <Checkbox
                id="showSidebarUserProfile"
                label="Show signed-in user profile at the bottom of the sidebar"
                checked={config.appearance?.showSidebarUserProfile??false}
                onChange={(checked) => handleAppearanceChange('showSidebarUserProfile',checked)}
              />
              <p className="ml-7 mt-1 text-xs text-slate-500">
                Shows the current user&apos;s avatar, name and position. In collapsed mode, only the avatar is shown.
              </p>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Desktop Filters</h3>
              <Checkbox id="compactDesktopFilters" label="Use compact desktop filters"
                checked={config.appearance?.compactDesktopFilters??false}
                onChange={(checked) => handleAppearanceChange('compactDesktopFilters',checked)} />
              <p className="ml-7 mt-1 text-xs text-slate-500">Show Search and a Filter button. Select a field on the left, edit values on the right, then click Apply. Mobile filters are unchanged. Applies after Save.</p>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Record Lists</h3>
              <Checkbox id="alternatingRecordColors" label="Use alternating record colors"
                checked={config.appearance?.alternatingRecordColors ?? false}
                onChange={(checked) => handleAppearanceChange('alternatingRecordColors', checked)} />
              <p className="ml-7 mt-1 text-xs text-slate-500">Apply a subtle background to alternating records after saving. Status and selection colors take priority.</p>
              <div className="ml-7 mt-3 max-w-xs">
                <ColorPickerInput label="Alternating row color" value={config.appearance?.alternatingRecordColor ?? DEFAULT_ALTERNATING_RECORD_COLOR}
                  onChange={(value) => handleAppearanceChange('alternatingRecordColor', value)} disabled={!config.appearance?.alternatingRecordColors} />
              </div>
              <div className="mt-4">
                <Checkbox id="tableColumnDividers" label="Show vertical column dividers"
                  checked={config.appearance?.tableColumnDividers ?? false}
                  onChange={(checked) => handleAppearanceChange('tableColumnDividers', checked)} />
                <p className="ml-7 mt-1 text-xs text-slate-500">Draw a vertical line between the columns of every table, besides the horizontal line between records. Applies after Save.</p>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Dropdown Menus</h3>
              <p className="mb-3 text-xs text-slate-500">Colours of the text and of the icons in the items of every dropdown (action) menu, for every user. A red item (such as Terminate or Delete) keeps its own colour. Applies after Save.</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {(['menuTextColor', 'menuIconColor'] as const).map((field) => (
                  <div key={field} className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <ColorPickerInput label={field === 'menuTextColor' ? 'Menu text color' : 'Menu icon color'} value={config.appearance?.[field] || DEFAULT_MENU_COLOR}
                        onChange={(value) => handleAppearanceChange(field, value)} />
                    </div>
                    <Button type="button" size="sm" variant="outline" disabled={!config.appearance?.[field]} onClick={() => handleAppearanceChange(field, '')}>Use default</Button>
                  </div>
                ))}
              </div>
              <div className="mt-3 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-sm" aria-label="Menu preview">
                {['View/Edit Profile', 'Reset Password', 'Suspend Account'].map((label) => (
                  <div key={label} className="flex items-center gap-2 px-3 py-2 text-xs font-medium" style={{ color: config.appearance?.menuTextColor || DEFAULT_MENU_COLOR }}>
                    <span className="h-4 w-4 rounded-sm border-2" style={{ borderColor: config.appearance?.menuIconColor || DEFAULT_MENU_COLOR }} aria-hidden="true" />
                    {label}
                  </div>
                ))}
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-500">
                  <span className="h-4 w-4 rounded-sm border-2 border-red-500" aria-hidden="true" />
                  Terminate Account
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Page Backgrounds</h3>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <PageBackgroundEditor title="Main Layout" value={config.appearance?.mainBackground} onChange={(value) => handleAppearanceChange('mainBackground', value)} />
                <PageBackgroundEditor title="Knowledge Base" value={config.appearance?.knowledgeBackground} onChange={(value) => handleAppearanceChange('knowledgeBackground', value)} />
              </div>
            </div>
          </div>
          </div>
        )}

        {activeTab === 'module-display' && (
          <div className="space-y-6">
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Training Management</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Select
                  label="Training Materials layout"
                  value={config.appearance?.trainingMaterialsLayout ?? 'TABLE'}
                  enableSearch={false}
                  onChange={(val) => handleAppearanceChange('trainingMaterialsLayout', val)}
                  options={[
                    { label: 'Table', value: 'TABLE' },
                    { label: 'Tiles with a drop zone', value: 'TILES' },
                  ]}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                How the materials of a training are shown on the New, planning and conduct screens. Table keeps a list with the actions on each row; Tiles shows a drop zone and a card for each material. Takes effect for every signed-in user right after you save.
              </p>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Knowledge Base</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Select
                  label="Folder names in the layout"
                  value={config.appearance?.knowledgeFolderNames ?? 'FULL'}
                  enableSearch={false}
                  onChange={(val) => handleAppearanceChange('knowledgeFolderNames', val)}
                  options={[
                    { label: 'Full name', value: 'FULL' },
                    { label: 'Abbreviation', value: 'ABBREVIATION' },
                  ]}
                />
                <Select
                  label="Folder names in the sidebar"
                  value={config.appearance?.knowledgeSidebarFolderNames ?? config.appearance?.knowledgeFolderNames ?? 'FULL'}
                  enableSearch={false}
                  onChange={(val) => handleAppearanceChange('knowledgeSidebarFolderNames', val)}
                  options={[
                    { label: 'Full name', value: 'FULL' },
                    { label: 'Abbreviation', value: 'ABBREVIATION' },
                  ]}
                />
              </div>
              <div className="mt-4">
                <Checkbox
                  id="knowledgeOpenInNewTab"
                  label="Open the Knowledge Base in a new browser tab"
                  checked={config.appearance?.knowledgeOpenInNewTab ?? true}
                  onChange={(checked) => handleAppearanceChange('knowledgeOpenInNewTab', checked)}
                />
                <p className="ml-7 mt-1 text-xs text-slate-500">Off: the Knowledge Base replaces the page you are on.</p>
              </div>
            </div>
          </div>
            <AuditTabViewSection config={config} onChange={(key, value) => handleAppearanceChange(key, value)} />
            {extra ? <div className="border-t border-slate-200 pt-6">{extra}</div> : null}
          </div>
        )}

        {activeTab === 'system' && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">
                    Admin Email
                  </label>
                  <input
                    type="email"
                    value={config.adminEmail}
                    onChange={(e) => handleChange('adminEmail',e.target.value)}
                    className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="admin@example.com"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Receives the e-mail about maintenance windows and restore requests
                  </p>
                </div>
              </div>
            </div>

            {/* Localization */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Localization</h3>
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Date & Time</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-slate-700 sm:text-sm">Date & Time Format</p>
                      <p className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">DD/MM/YYYY HH:mm:ss</p>
                      <p className="mt-1 text-xs text-slate-500">One format for the whole system: dates are dd/MM/yyyy and dates with a time are dd/MM/yyyy HH:mm:ss. It is not a setting.</p>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-slate-700 sm:text-sm">Time Zone</p>
                      <p className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">Asia/Ho_Chi_Minh (UTC+7)</p>
                      <p className="mt-1 text-xs text-slate-500">The zone of the site, for every screen, document and record. It is not a setting.</p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Language & Numbers</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-slate-700 sm:text-sm">Language</p>
                      <p className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">English</p>
                      <p className="mt-1 text-xs text-slate-500">The system is written in English only. It is not a setting.</p>
                    </div>
                    <Select
                      label="Number Format"
                      value={locale.numberFormat||'en-US'}
                      onChange={(val) => handleLocaleChange('numberFormat',val)}
                      options={[
                        { label: '1,234.56 (US/UK)',value: 'en-US' },
                        { label: '1.234,56 (EU)',value: 'de-DE' },
                        { label: '1 234,56 (FR)',value: 'fr-FR' },
                        { label: '1,234.56 (JP)',value: 'ja-JP' },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>


            {/* System Maintenance */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">System Maintenance</h3>
              <div className="space-y-4">
                <div>
                  <Checkbox
                    id="maintenanceMode"
                    label="Enable Maintenance Mode"
                    checked={config.maintenanceMode}
                    onChange={(checked) => handleChange('maintenanceMode',checked)}
                  />
                  <p className="text-xs text-slate-500 ml-7">
                    When enabled, only administrators can access the system. Regular users will see a maintenance notice.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && <ConfigHistory page="general" />}
    </ConfigTabs>
  );
};
