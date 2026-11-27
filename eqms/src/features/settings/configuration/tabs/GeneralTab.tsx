import { tr as __ariaTr } from "@/i18n";
﻿import React, { useState, useEffect } from 'react';
import { GeneralConfig } from '../types';
import { Select } from '@/components/ui/select/Select';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { FieldHint } from '@/components/ui/form/FieldHint';
import { ImageIcon, PanelTop } from 'lucide-react';
import { Button } from '@/components/ui/button/Button';
import { useToast } from '@/components/ui/toast/Toast';
import { settingsApi } from '@/services/api/settings';
import { DEFAULT_FOOTER_LEFT, DEFAULT_SYSTEM_HEADER_TITLE, type LoginCarouselConfig } from '@/services/api/branding';
import { Switch } from '@/components/ui/switch';
import { AppShortcutSection } from './AppShortcutSection';
import { AuditTabViewSection } from './AuditTabViewSection';
import { NotificationInboxLayoutSection } from './NotificationInboxLayoutSection';
import { ColorPickerInput } from '@/components/ui/color-picker/ColorPickerInput';
import { DEFAULT_ALTERNATING_RECORD_COLOR } from '@/config/record-stripes';
import { PageBackgroundEditor } from './PageBackgroundEditor';
import { LoginCarouselEditor } from './LoginCarouselEditor';
import { ConfigTabs } from './ConfigTabs';
import { ConfigHistory } from './ConfigHistory';
import { LoadingSettings } from './LoadingSettings';
import { GENERAL_TABS, changedGeneralTabs, revertGeneralTab, type GeneralTabId } from './generalTabs';
import { DEFAULT_MENU_COLOR } from '@/config/menu-colors';
import type { PageBackground } from '@/config/page-background';
import { tr, trFormat } from "@/i18n";

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
      showToast({ type: 'error', title: tr('Invalid file'), message: tr('Please select an image file.') });
      return;
    }
    if (file.size > maxBytes) {
      const label = key === 'systemFavicon' ? 'favicon' : key === 'systemSidebarCollapsedLogo' ? tr('collapsed sidebar logo') : 'logo';
      showToast({ type: 'error', title: tr('File too large'), message: `The ${label} must be smaller than ${Math.round(maxBytes / 1024)} KB.` });
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
      ariaLabel={__ariaTr("General configuration sections")}
      idPrefix="general"
    >
        {activeTab === 'branding' && (
          <div className="space-y-6">
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("System Identity")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">
                    {tr("System Name (Internal)")}
                  </label>
                  <input
                    type="text"
                    value={config.systemName}
                    onChange={(e) => handleChange('systemName',e.target.value)}
                    className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder={tr("EQMS Enterprise")}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    {tr("Internal system identifier")}
                  </p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">
                    {tr("Display Name (Browser Tab)")}
                  </label>
                  <input
                    type="text"
                    value={config.systemDisplayName}
                    onChange={(e) => handleChange('systemDisplayName',e.target.value)}
                    className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder={tr("EQMS - Quality Management System")}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    {tr("Displayed in browser tab title")}
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Header")}</h3>
              <label htmlFor="system-header-title" className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("Header Title (Dashboard)")}</label>
              <input
                id="system-header-title"
                type="text"
                value={config.systemHeaderTitle ?? ''}
                onChange={(e) => handleChange('systemHeaderTitle', e.target.value.replace(/[\r\n\t]+/g, ' ').slice(0, 120))}
                maxLength={120}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder={DEFAULT_SYSTEM_HEADER_TITLE}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {trFormat("Shown in the top bar of the Dashboard on desktop, and stays there while the page is scrolled. Leave empty to use “{title}”.", { title: DEFAULT_SYSTEM_HEADER_TITLE })}
              </p>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Footer")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="systemFooterLeft" className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("Left Footer")}</label>
                  <input
                    id="systemFooterLeft"
                    type="text"
                    value={config.systemFooterLeft ?? DEFAULT_FOOTER_LEFT}
                    onChange={(e) => handleChange('systemFooterLeft', e.target.value.replace(/[\r\n]+/g, ' ').slice(0, 500))}
                    maxLength={500}
                    className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder={tr("© {year} Your Company. All rights reserved.")}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">{trFormat("Shown at the left of the footer. Use {year} to insert the current year.", { year: "{year}" })}</p>
                </div>
                <div>
                  <label htmlFor="systemFooterRight" className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("Right Footer")}</label>
                  <input
                    id="systemFooterRight"
                    type="text"
                    value={config.systemFooterRight ?? ''}
                    onChange={(e) => handleChange('systemFooterRight', e.target.value.replace(/[\r\n]+/g, ' ').slice(0, 500))}
                    maxLength={500}
                    className="w-full h-9 px-3 text-sm text-right border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder={tr("e.g. Version, hotline or support e-mail")}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">{tr("Always shown at the right of the footer. Leave empty to show nothing there.")}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 cursor-pointer select-none">
                  <Switch checked={config.footerShowOnDesktop ?? true} onChange={(on) => handleChange('footerShowOnDesktop', on)} />
                  {tr("Show footer on Desktop and Tablet")}
                </label>
                <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 cursor-pointer select-none">
                  <Switch checked={config.footerShowOnMobile ?? false} onChange={(on) => handleChange('footerShowOnMobile', on)} />
                  {tr("Show footer on Mobile")}
                </label>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Logos & Browser Icon")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("Application Logo")}</label>
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <BrandImagePreview src={config.systemLogo} alt="Application logo preview" variant="logo" />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline-emerald" onClick={() => logoInputRef.current?.click()}>{tr("Upload Logo")}</Button>
                      {config.systemLogo&&<Button type="button" size="sm" variant="ghost" onClick={() => handleChange('systemLogo','')}>{tr("Reset")}</Button>}
                    </div>
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => { void selectBrandImage(e.target.files?.[0],'systemLogo',5*1024*1024); e.currentTarget.value=''; }} />
                  <p className="text-xs text-slate-500 mt-1">{tr("Used in the sidebar and all authentication screens. PNG, JPG, SVG or WebP; max 5 MB.")}</p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("Collapsed Sidebar Logo")}</label>
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <BrandImagePreview src={collapsedSidebarLogo} alt="Collapsed sidebar logo preview" variant="sidebar" />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline-emerald" onClick={() => collapsedSidebarLogoInputRef.current?.click()}>{tr("Upload Compact Logo")}</Button>
                      {collapsedSidebarLogo&&<Button type="button" size="sm" variant="ghost" onClick={() => handleChange('systemSidebarCollapsedLogo','')}>{tr("Reset")}</Button>}
                    </div>
                  </div>
                  <input ref={collapsedSidebarLogoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => { void selectBrandImage(e.target.files?.[0],'systemSidebarCollapsedLogo',5*1024*1024); e.currentTarget.value=''; }} />
                  <p className="text-xs text-slate-500 mt-1">{tr("Used only when the sidebar is collapsed. Square PNG, JPG, SVG or WebP; max 5 MB. Falls back to Application Logo when not configured.")}</p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">{tr("Browser Tab Icon (Favicon)")}</label>
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <BrandImagePreview src={config.systemFavicon} alt="Favicon preview" variant="favicon" />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline-emerald" onClick={() => faviconInputRef.current?.click()}>{tr("Upload Favicon")}</Button>
                      {config.systemFavicon&&<Button type="button" size="sm" variant="ghost" onClick={() => handleChange('systemFavicon','')}>{tr("Reset")}</Button>}
                    </div>
                  </div>
                  <input ref={faviconInputRef} type="file" accept="image/png,image/svg+xml,image/x-icon" className="hidden" onChange={(e) => { void selectBrandImage(e.target.files?.[0],'systemFavicon',1024*1024); e.currentTarget.value=''; }} />
                  <p className="text-xs text-slate-500 mt-1">{tr("Used in the browser tab. Square PNG, SVG or ICO; max 1 MB.")}</p>
                </div>
              </div>
            </div>
            <AppShortcutSection config={config} onChange={onChange} />
            <LoadingSettings
              variant={config.appearance?.loadingStyle}
              color={config.appearance?.loadingColor}
              onStyleChange={(value) => onChange({ ...config, appearance: { ...config.appearance, loadingStyle: value } })}
              onColorChange={(value) => onChange({ ...config, appearance: { ...config.appearance, loadingColor: value } })}
            />
          </div>
          </div>
        )}

        {activeTab === 'sign-in' && (
          <div className="space-y-6">
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Sign-in Screen")}</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Select
                  label={tr("Sign-in screen layout")}
                  value={config.appearance?.loginLayout ?? 'CLASSIC'}
                  enableSearch={false}
                  onChange={(val) => handleAppearanceChange('loginLayout', val)}
                  options={[
                    { label: 'Classic', value: 'CLASSIC' },
                    { label: tr('Split with product panel'), value: 'SPLIT' },
                  ]}
                />
              </div>
              {(config.appearance?.loginLayout ?? 'CLASSIC') === 'SPLIT' && (
                <LoginCarouselEditor value={config.appearance?.loginCarousel} logo={config.systemLogo} onChange={(value) => handleAppearanceChange('loginCarousel', value)} />
              )}
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Authentication Background")}</h3>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <PageBackgroundEditor title={tr("Authentication")} allowImage value={config.appearance?.authBackground} onChange={(value) => handleAppearanceChange('authBackground', value)} />
              </div>
            </div>
          </div>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-6">
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Sidebar")}</h3>
              <Checkbox
                id="showSidebarUserProfile"
                label={tr("Show signed-in user profile at the bottom of the sidebar")}
                checked={config.appearance?.showSidebarUserProfile??false}
                onChange={(checked) => handleAppearanceChange('showSidebarUserProfile',checked)}
              />
              <FieldHint indent className="mt-1">{tr("Shows the user&apos;s avatar, name and position. Collapsed sidebar: avatar only.")}</FieldHint>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Desktop Filters")}</h3>
              <Checkbox id="compactDesktopFilters" label={tr("Use compact desktop filters")}
                checked={config.appearance?.compactDesktopFilters??false}
                onChange={(checked) => handleAppearanceChange('compactDesktopFilters',checked)} />
              <FieldHint indent className="mt-1">{tr("Shows a Search box and a Filter button. Pick a field, set its values, then click Apply. Desktop only. Applies after Save.")}</FieldHint>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Record Lists")}</h3>
              <Checkbox id="alternatingRecordColors" label={tr("Use alternating record colors")}
                checked={config.appearance?.alternatingRecordColors ?? false}
                onChange={(checked) => handleAppearanceChange('alternatingRecordColors', checked)} />
              <FieldHint indent className="mt-1">{tr("Shades every other record. Status and selection colours stay on top. Applies after Save.")}</FieldHint>
              <div className="ml-7 mt-3 max-w-xs">
                <ColorPickerInput label={tr("Alternating row color")} value={config.appearance?.alternatingRecordColor ?? DEFAULT_ALTERNATING_RECORD_COLOR}
                  onChange={(value) => handleAppearanceChange('alternatingRecordColor', value)} disabled={!config.appearance?.alternatingRecordColors} />
              </div>
              <div className="mt-4">
                <Checkbox id="tableColumnDividers" label={tr("Show vertical column dividers")}
                  checked={config.appearance?.tableColumnDividers ?? false}
                  onChange={(checked) => handleAppearanceChange('tableColumnDividers', checked)} />
                <FieldHint indent className="mt-1">{tr("Adds a vertical line between table columns. Applies after Save.")}</FieldHint>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Dropdown Menus")}</h3>
              <p className="mb-3 text-xs text-slate-500">{tr("Colours of the text and of the icons in the items of every dropdown (action) menu, for every user. A red item (such as Terminate or Delete) keeps its own colour. Applies after Save.")}</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {(['menuTextColor', 'menuIconColor'] as const).map((field) => (
                  <div key={field} className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <ColorPickerInput label={field === 'menuTextColor' ? tr('Menu text color') : tr('Menu icon color')} value={config.appearance?.[field] || DEFAULT_MENU_COLOR}
                        onChange={(value) => handleAppearanceChange(field, value)} />
                    </div>
                    <Button type="button" size="sm" variant="outline" disabled={!config.appearance?.[field]} onClick={() => handleAppearanceChange(field, '')}>{tr("Use default")}</Button>
                  </div>
                ))}
              </div>
              <div className="mt-3 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-sm" aria-label={tr("Menu preview")}>
                {['View/Edit Profile', 'Reset Password', 'Suspend Account'].map((label) => (
                  <div key={label} className="flex items-center gap-2 px-3 py-2 text-xs font-medium" style={{ color: config.appearance?.menuTextColor || DEFAULT_MENU_COLOR }}>
                    <span className="h-4 w-4 rounded-sm border-2" style={{ borderColor: config.appearance?.menuIconColor || DEFAULT_MENU_COLOR }} aria-hidden="true" />
                    {tr(label)}
                  </div>
                ))}
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-500">
                  <span className="h-4 w-4 rounded-sm border-2 border-red-500" aria-hidden="true" />
                  {tr("Terminate Account")}
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Page Backgrounds")}</h3>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <PageBackgroundEditor title={tr("Main Layout")} value={config.appearance?.mainBackground} onChange={(value) => handleAppearanceChange('mainBackground', value)} />
                <PageBackgroundEditor title={tr("Knowledge Base")} value={config.appearance?.knowledgeBackground} onChange={(value) => handleAppearanceChange('knowledgeBackground', value)} />
              </div>
            </div>
          </div>
          </div>
        )}

        {activeTab === 'module-display' && (
          <div className="space-y-6">
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Training Management")}</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Select
                  label={tr("Training Materials layout")}
                  value={config.appearance?.trainingMaterialsLayout ?? 'TABLE'}
                  enableSearch={false}
                  onChange={(val) => handleAppearanceChange('trainingMaterialsLayout', val)}
                  options={[
                    { label: 'Table', value: 'TABLE' },
                    { label: tr('Tiles with a drop zone'), value: 'TILES' },
                  ]}
                />
              </div>
              <FieldHint className="mt-1">{tr("How training materials are shown. Table is a list with actions on each row; Tiles is a drop zone with a card per material. Applies to everyone after Save.")}</FieldHint>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Knowledge Base")}</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Select
                  label={tr("Folder names in the layout")}
                  value={config.appearance?.knowledgeFolderNames ?? 'FULL'}
                  enableSearch={false}
                  onChange={(val) => handleAppearanceChange('knowledgeFolderNames', val)}
                  options={[
                    { label: 'Full name', value: 'FULL' },
                    { label: 'Abbreviation', value: 'ABBREVIATION' },
                  ]}
                />
                <Select
                  label={tr("Folder names in the sidebar")}
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
                  label={tr("Open the Knowledge Base in a new browser tab")}
                  checked={config.appearance?.knowledgeOpenInNewTab ?? true}
                  onChange={(checked) => handleAppearanceChange('knowledgeOpenInNewTab', checked)}
                />
                <FieldHint indent className="mt-1">{tr("Off: the Knowledge Base replaces the current page.")}</FieldHint>
              </div>
            </div>
          </div>
            <NotificationInboxLayoutSection config={config} onChange={(key, value) => handleAppearanceChange(key, value)} />
            <AuditTabViewSection config={config} onChange={(key, value) => handleAppearanceChange(key, value)} />
            {extra ? <div className="border-t border-slate-200 pt-6">{extra}</div> : null}
          </div>
        )}

        {activeTab === 'system' && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Contact Information")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">
                    {tr("Admin Email")}
                  </label>
                  <input
                    type="email"
                    value={config.adminEmail}
                    onChange={(e) => handleChange('adminEmail',e.target.value)}
                    className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="admin@example.com"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    {tr("Receives the e-mail about maintenance windows and restore requests")}
                  </p>
                </div>
              </div>
            </div>

            {/* Localization */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Localization")}</h3>
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Date & Time")}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-slate-700 sm:text-sm">{tr("Date & Time Format")}</p>
                      <p className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">{tr("DD/MM/YYYY HH:mm:ss")}</p>
                      <p className="mt-1 text-xs text-slate-500">{tr("One format for the whole system: dates are dd/MM/yyyy and dates with a time are dd/MM/yyyy HH:mm:ss. It is not a setting.")}</p>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-slate-700 sm:text-sm">{tr("Time Zone")}</p>
                      <p className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">{tr("Asia/Ho_Chi_Minh (UTC+7)")}</p>
                      <p className="mt-1 text-xs text-slate-500">{tr("The zone of the site, for every screen, document and record. It is not a setting.")}</p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Language & Numbers")}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-slate-700 sm:text-sm">{tr("Language")}</p>
                      <p className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">{tr("English")}</p>
                      <p className="mt-1 text-xs text-slate-500">{tr("The system is written in English only. It is not a setting.")}</p>
                    </div>
                    <Select
                      label={tr("Number Format")}
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
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("System Maintenance")}</h3>
              <div className="space-y-4">
                <div>
                  <Checkbox
                    id="maintenanceMode"
                    label={tr("Enable Maintenance Mode")}
                    checked={config.maintenanceMode}
                    onChange={(checked) => handleChange('maintenanceMode',checked)}
                  />
                  <FieldHint indent>{tr("Only administrators can get in. Other users see a maintenance notice.")}</FieldHint>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && <ConfigHistory page="general" />}
    </ConfigTabs>
  );
};
