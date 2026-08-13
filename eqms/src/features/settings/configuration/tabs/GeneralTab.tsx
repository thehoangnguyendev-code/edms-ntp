import React, { useState, useEffect } from 'react';
import { GeneralConfig } from '../types';
import { Select } from '@/components/ui/select/Select';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { TimePicker } from '@/components/ui/datetime-picker';
import { Palette, Database, Globe, Wrench, ImageIcon, PanelTop } from 'lucide-react';
import { IconAddressBook } from '@tabler/icons-react';
import { Button } from '@/components/ui/button/Button';
import { useToast } from '@/components/ui/toast/Toast';
import { settingsApi } from '@/services/api/settings';
import { useTranslation } from '@/i18n';

interface GeneralTabProps {
  config: GeneralConfig;
  onChange: (config: GeneralConfig) => void;
  onValidationChange?: (isValid: boolean) => void;
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



export const GeneralTab: React.FC<GeneralTabProps> = ({ config, onChange, onValidationChange }) => {
  const [timeZones, setTimeZones] = useState<Array<{ label: string; value: string }>>([]);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const collapsedSidebarLogoInputRef = React.useRef<HTMLInputElement>(null);
  const faviconInputRef = React.useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const { t } = useTranslation();

  const backupSettings = config.backupSettings || {} as any;
  const locale = config.locale || {} as any;

  // Fetch time zones using Intl API
  useEffect(() => {
    try {
      // Get all supported time zones from browser
      const zones = Intl.supportedValuesOf('timeZone');

      // Format time zones with offset information
      const formatted = zones.map((zone) => {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: zone,
          timeZoneName: 'shortOffset',
        });

        // Get current time to calculate offset
        const parts = formatter.formatToParts(new Date());
        const offset = parts.find((part) => part.type === 'timeZoneName')?.value || '';

        return {
          label: `${zone.replace(/_/g, ' ')} ${offset}`,
          value: zone,
        };
      });

      // Sort by zone name
      formatted.sort((a, b) => a.value.localeCompare(b.value));

      setTimeZones(formatted);
    } catch (error) {
      console.error('Failed to load time zones:', error);
      // Fallback to basic options
      setTimeZones([
        { label: 'UTC', value: 'UTC' },
        { label: 'Asia/Bangkok (UTC+7)', value: 'Asia/Bangkok' },
        { label: 'Asia/Ho_Chi_Minh (UTC+7)', value: 'Asia/Ho_Chi_Minh' },
        { label: 'America/New_York (EST)', value: 'America/New_York' },
        { label: 'America/Los_Angeles (PST)', value: 'America/Los_Angeles' },
        { label: 'Europe/London (GMT)', value: 'Europe/London' },
      ]);
    }
  }, []);

  const handleChange = (key: keyof GeneralConfig, value: any) => {
    if (key === 'systemSidebarCollapsedLogo') {
      onChange({
        ...config,
        appearance: {
          primaryColor: config.appearance?.primaryColor ?? '#10b981',
          compactMode: config.appearance?.compactMode ?? false,
          showBreadcrumbs: config.appearance?.showBreadcrumbs ?? true,
          sidebarDefaultCollapsed: config.appearance?.sidebarDefaultCollapsed ?? false,
          animationsEnabled: config.appearance?.animationsEnabled ?? true,
          theme: config.appearance?.theme ?? 'light',
          systemSidebarCollapsedLogo: value,
        },
      });
      return;
    }
    onChange({ ...config, [key]: value });
  };

  const collapsedSidebarLogo = config.appearance?.systemSidebarCollapsedLogo || config.systemSidebarCollapsedLogo || '';

  const handleBackupSettingsChange = (key: keyof GeneralConfig['backupSettings'], value: any) => {
    onChange({
      ...config,
      backupSettings: {
        ...(config.backupSettings || {}),
        [key]: value,
      } as any,
    });
  };

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
      showToast({ type: 'error', title: t('systemConfiguration.invalidImageTitle'), message: t('systemConfiguration.invalidImageMessage') });
      return;
    }
    if (file.size > maxBytes) {
      const label = key === 'systemFavicon' ? 'favicon' : key === 'systemSidebarCollapsedLogo' ? 'collapsed sidebar logo' : 'logo';
      showToast({
        type: 'error',
        title: t('systemConfiguration.imageTooLargeTitle'),
        message: t('systemConfiguration.imageTooLargeMessage', { label, size: Math.round(maxBytes / 1024) }),
      });
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
    <div className="p-4 md:p-5 space-y-4">
      {/* Branding */}
      <SettingsCard title="Branding" icon={<Palette className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              System Name (Internal)
            </label>
            <input
              type="text"
              value={config.systemName}
              onChange={(e) => handleChange('systemName', e.target.value)}
              className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="EQMS Enterprise"
            />
            <p className="text-xs text-slate-500 mt-1">
              Internal system identifier
            </p>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              Display Name (Browser Tab)
            </label>
            <input
              type="text"
              value={config.systemDisplayName}
              onChange={(e) => handleChange('systemDisplayName', e.target.value)}
              className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="EQMS - Quality Management System"
            />
            <p className="text-xs text-slate-500 mt-1">
              Displayed in browser tab title
            </p>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">System Footer</label>
          <textarea
            value={config.systemFooter ?? '© {year} Ngoc Thien Pharma. All rights reserved.'}
            onChange={(e) => handleChange('systemFooter', e.target.value.slice(0, 500))}
            rows={2}
            maxLength={500}
            className="w-full resize-y rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            placeholder="© {year} Your Company. All rights reserved."
          />
          <p className="mt-1 text-xs text-slate-500">Shown in the footer across the system. Use <code>{'{year}'}</code> to insert the current year.</p>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Application Logo</label>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
              <BrandImagePreview src={config.systemLogo} alt="Application logo preview" variant="logo" />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => logoInputRef.current?.click()}>Upload logo</Button>
                {config.systemLogo && <Button type="button" size="sm" variant="ghost" onClick={() => handleChange('systemLogo', '')}>Reset</Button>}
              </div>
            </div>
            <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => { void selectBrandImage(e.target.files?.[0], 'systemLogo', 5 * 1024 * 1024); e.currentTarget.value = ''; }} />
            <p className="text-xs text-slate-500 mt-1">Used in the sidebar and all authentication screens. PNG, JPG, SVG or WebP; max 5 MB.</p>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Collapsed Sidebar Logo</label>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
              <BrandImagePreview src={collapsedSidebarLogo} alt="Collapsed sidebar logo preview" variant="sidebar" />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => collapsedSidebarLogoInputRef.current?.click()}>Upload compact logo</Button>
                {collapsedSidebarLogo && <Button type="button" size="sm" variant="ghost" onClick={() => handleChange('systemSidebarCollapsedLogo', '')}>Reset</Button>}
              </div>
            </div>
            <input ref={collapsedSidebarLogoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => { void selectBrandImage(e.target.files?.[0], 'systemSidebarCollapsedLogo', 5 * 1024 * 1024); e.currentTarget.value = ''; }} />
            <p className="text-xs text-slate-500 mt-1">Used only when the sidebar is collapsed. Square PNG, JPG, SVG or WebP; max 5 MB. Falls back to Application Logo when not configured.</p>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Browser Tab Icon (Favicon)</label>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
              <BrandImagePreview src={config.systemFavicon} alt="Favicon preview" variant="favicon" />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => faviconInputRef.current?.click()}>Upload favicon</Button>
                {config.systemFavicon && <Button type="button" size="sm" variant="ghost" onClick={() => handleChange('systemFavicon', '')}>Reset</Button>}
              </div>
            </div>
            <input ref={faviconInputRef} type="file" accept="image/png,image/svg+xml,image/x-icon" className="hidden" onChange={(e) => { void selectBrandImage(e.target.files?.[0], 'systemFavicon', 1024 * 1024); e.currentTarget.value = ''; }} />
            <p className="text-xs text-slate-500 mt-1">Used in the browser tab. Square PNG, SVG or ICO; max 1 MB.</p>
          </div>
        </div>
      </SettingsCard>

      {/* System Information */}
      <SettingsCard title="Contact Information" icon={<IconAddressBook className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              Admin Email
            </label>
            <input
              type="email"
              value={config.adminEmail}
              onChange={(e) => handleChange('adminEmail', e.target.value)}
              className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="admin@example.com"
            />
            <p className="text-xs text-slate-500 mt-1">
              Primary contact for system notifications
            </p>
          </div>
        </div>
      </SettingsCard>


      {/* Backup & Data Management */}
      <SettingsCard title="Backup & Data Management" icon={<Database className="h-4 w-4" />}>
        <div className="space-y-4">
          <div>
            <Checkbox
              id="enableAutoBackup"
              label="Enable Automatic Backup"
              checked={!!backupSettings.enableAutoBackup}
              onChange={(checked) => handleBackupSettingsChange('enableAutoBackup', checked)}
            />
            <p className="text-xs text-slate-500 ml-7">
              Automatically backup system data at scheduled intervals
            </p>
          </div>

          {!!backupSettings.enableAutoBackup && (
            <div className="ml-4 sm:ml-7 p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Select
                  label="Backup Frequency"
                  value={backupSettings.backupFrequency || 'daily'}
                  onChange={(val) => handleBackupSettingsChange('backupFrequency', val as 'daily' | 'weekly' | 'monthly')}
                  options={[
                    { label: 'Daily', value: 'daily' },
                    { label: 'Weekly', value: 'weekly' },
                    { label: 'Monthly', value: 'monthly' },
                  ]}
                />
                <TimePicker
                  label="Backup Time"
                  value={backupSettings.backupTime || ''}
                  onChange={(val) => handleBackupSettingsChange('backupTime', val)}
                  placeholder="00:00"
                />
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Retention Period (Days)
                  </label>
                  <input
                    type="number"
                    value={backupSettings.retentionDays ?? 30}
                    onChange={(e) => handleBackupSettingsChange('retentionDays', parseInt(e.target.value))}
                    className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    min={7}
                    max={365}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Keep backups for {backupSettings.retentionDays ?? 30} days
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Backup Location"
                  value={backupSettings.backupLocation || 'cloud'}
                  onChange={(val) => handleBackupSettingsChange('backupLocation', val as 'local' | 'cloud' | 's3')}
                  options={[
                    { label: 'Local Server', value: 'local' },
                    { label: 'Cloud Storage', value: 'cloud' },
                    { label: 'Amazon S3', value: 's3' },
                  ]}
                />
                <div className="flex items-center sm:pt-8">
                  <Checkbox
                    id="notifyOnBackupFailure"
                    label="Notify on Backup Failure"
                    checked={!!backupSettings.notifyOnBackupFailure}
                    onChange={(checked) => handleBackupSettingsChange('notifyOnBackupFailure', checked)}
                  />
                </div>
              </div>


            </div>
          )}
        </div>
      </SettingsCard>

      {/* Localization */}
      <SettingsCard title="Localization" icon={<Globe className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Date & Time Format"
            value={config.dateTimeFormat}
            onChange={(val) => handleChange('dateTimeFormat', val)}
            options={[
              { label: 'DD/MM/YYYY HH:mm:ss', value: 'DD/MM/YYYY HH:mm:ss' },
              { label: 'DD/MM/YYYY HH:mm', value: 'DD/MM/YYYY HH:mm' },
              { label: 'MM/DD/YYYY HH:mm:ss', value: 'MM/DD/YYYY HH:mm:ss' },
              { label: 'MM/DD/YYYY HH:mm', value: 'MM/DD/YYYY HH:mm' },
              { label: 'YYYY-MM-DD HH:mm:ss', value: 'YYYY-MM-DD HH:mm:ss' },
              { label: 'YYYY-MM-DD HH:mm', value: 'YYYY-MM-DD HH:mm' },
              { label: 'DD-MMM-YYYY HH:mm:ss', value: 'DD-MMM-YYYY HH:mm:ss' },
              { label: 'DD-MMM-YYYY HH:mm', value: 'DD-MMM-YYYY HH:mm' },
              { label: 'MMMM DD, YYYY HH:mm:ss', value: 'MMMM DD, YYYY HH:mm:ss' },
              { label: 'MMMM DD, YYYY HH:mm', value: 'MMMM DD, YYYY HH:mm' },
            ]}
          />
          <Select
            label="Time Zone"
            value={config.timeZone}
            onChange={(val) => handleChange('timeZone', val)}
            options={timeZones}
            enableSearch
            placeholder="Select time zone..."
          />
          <Select
            label="Language"
            value={locale.language || 'en'}
            onChange={(val) => handleLocaleChange('language', val)}
            options={[
              { label: 'English', value: 'en' },
              { label: 'Vietnamese (Tiếng Việt)', value: 'vi' },
              { label: 'Japanese (日本語)', value: 'ja' },
              { label: 'Korean (한국어)', value: 'ko' },
              { label: 'Chinese Simplified (简体中文)', value: 'zh-CN' },
              { label: 'French (Français)', value: 'fr' },
              { label: 'German (Deutsch)', value: 'de' },
              { label: 'Spanish (Español)', value: 'es' },
            ]}
          />
          <Select
            label="Number Format"
            value={locale.numberFormat || 'en-US'}
            onChange={(val) => handleLocaleChange('numberFormat', val)}
            options={[
              { label: '1,234.56 (US/UK)', value: 'en-US' },
              { label: '1.234,56 (EU)', value: 'de-DE' },
              { label: '1 234,56 (FR)', value: 'fr-FR' },
              { label: '1,234.56 (JP)', value: 'ja-JP' },
            ]}
          />
        </div>
      </SettingsCard>


      {/* System Maintenance */}
      <SettingsCard title="System Maintenance" icon={<Wrench className="h-4 w-4" />}>
        <div className="space-y-3">
          <div>
            <Checkbox
              id="maintenanceMode"
              label="Enable Maintenance Mode"
              checked={config.maintenanceMode}
              onChange={(checked) => handleChange('maintenanceMode', checked)}
            />
            <p className="text-xs text-slate-500 ml-7">
              When enabled, only administrators can access the system. Regular users will see a maintenance notice.
            </p>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};
