import React, { useCallback, useEffect, useState } from 'react';
import { Globe, Type } from 'lucide-react';
import { Select } from '@/components/ui/select/Select';
import { Switch } from '@/components/ui';
import { FormSection } from '@/components/ui/form/FormSection';
import { localizationApi, type UserLocalizationPreferences } from '@/services/api/localization';
import {
  APPLICATION_FONT_OPTIONS,
  DEFAULT_LOCALIZATION_SETTINGS,
  readSystemLocalizationSettings,
  writeSystemLocalizationSettings,
  type SystemLocalizationSettings,
} from '@/config/localization';

interface LocalizationTabProps {
  onRegisterSaveHandler?: ((handler: (() => Promise<void>) | null) => void);
  onRegisterResetHandler?: ((handler: (() => void) | null) => void);
}

const DATE_TIME_FORMATS = ['DD/MM/YYYY HH:mm:ss', 'DD/MM/YYYY HH:mm', 'MM/DD/YYYY HH:mm:ss', 'MM/DD/YYYY HH:mm', 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'DD-MMM-YYYY HH:mm:ss', 'DD-MMM-YYYY HH:mm', 'MMMM DD, YYYY HH:mm:ss', 'MMMM DD, YYYY HH:mm'].map(value => ({ value, label: value }));
const NUMBER_FORMATS = [{ value: 'en-US', label: '1,234.56 (US/UK)' }, { value: 'de-DE', label: '1.234,56 (EU)' }, { value: 'fr-FR', label: '1 234,56 (FR)' }, { value: 'ja-JP', label: '1,234.56 (JP)' }];
const TIME_ZONES = ['Asia/Ho_Chi_Minh', 'UTC', 'Asia/Tokyo', 'Asia/Seoul', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles'].map(value => ({ value, label: value.replace('_', ' ') }));

export const LocalizationTab: React.FC<LocalizationTabProps> = ({ onRegisterSaveHandler, onRegisterResetHandler }) => {
  const [system, setSystem] = useState<SystemLocalizationSettings>(readSystemLocalizationSettings);
  const [preferences, setPreferences] = useState<UserLocalizationPreferences>({ useSystemDefaults: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void localizationApi.getSystem().then(value => setSystem({ ...DEFAULT_LOCALIZATION_SETTINGS, ...value, language: 'en' })).catch(() => setSystem(readSystemLocalizationSettings));
    void localizationApi.getMine().then(setPreferences).finally(() => setLoading(false));
  }, []);

  const effective = { ...DEFAULT_LOCALIZATION_SETTINGS, ...(preferences.useSystemDefaults ? system : { ...system, ...preferences }), language: 'en' };
  const setValue = <K extends Exclude<keyof SystemLocalizationSettings, 'language'>>(key: K, value: SystemLocalizationSettings[K]) => setPreferences(current => ({ ...current, useSystemDefaults: false, [key]: value }));

  const saveChanges = useCallback(async () => {
    const { language: _language, ...regionalPreferences } = preferences;
    const saved = await localizationApi.updateMine(preferences.useSystemDefaults ? { useSystemDefaults: true } : regionalPreferences);
    setPreferences({ ...saved, language: 'en' });
    const next = saved.useSystemDefaults ? system : { ...system, ...saved, language: 'en' };
    writeSystemLocalizationSettings(next);
  }, [preferences, system]);

  useEffect(() => { onRegisterSaveHandler?.(saveChanges); return () => onRegisterSaveHandler?.(null); }, [onRegisterSaveHandler, saveChanges]);
  useEffect(() => {
    const resetToSystemDefaults = () => setPreferences({ useSystemDefaults: true });
    onRegisterResetHandler?.(resetToSystemDefaults);
    return () => onRegisterResetHandler?.(null);
  }, [onRegisterResetHandler]);

  return <div className="p-1 animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">The application language is English. You may customize regional formats for your account; resetting restores the administrator's current values.</div>
    <FormSection title="Regional Format Preferences" icon={<Globe className="h-4 w-4" />}>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3"><div><p className="text-sm font-medium text-slate-900">Use system defaults</p><p className="text-xs text-slate-500">Follow the localization configured by your administrator.</p></div><Switch checked={preferences.useSystemDefaults} onChange={(checked) => setPreferences(checked ? { useSystemDefaults: true } : { ...effective, useSystemDefaults: false })} disabled={loading} /></div>
        {!preferences.useSystemDefaults && <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select label="Date & Time Format" value={effective.dateTimeFormat} options={DATE_TIME_FORMATS} onChange={value => setValue('dateTimeFormat', value)} />
          <Select label="Time Zone" value={effective.timeZone} options={TIME_ZONES} onChange={value => setValue('timeZone', value)} />
          <Select label="Number Format" value={effective.numberFormat} options={NUMBER_FORMATS} onChange={value => setValue('numberFormat', value)} />
          <Select label="Application Font" value={effective.fontFamily} options={[...APPLICATION_FONT_OPTIONS]} onChange={value => setValue('fontFamily', String(value) as SystemLocalizationSettings['fontFamily'])} />
        </div>}
        {preferences.useSystemDefaults && <div className="grid grid-cols-1 gap-3 text-sm text-slate-600 md:grid-cols-2"><p>Language: <strong>English</strong></p><p>Date & time: <strong>{system.dateTimeFormat}</strong></p><p>Time zone: <strong>{system.timeZone}</strong></p><p>Number: <strong>{new Intl.NumberFormat(system.numberFormat).format(1234567.89)}</strong></p><p className="flex items-center gap-1.5"><Type className="h-3.5 w-3.5" />Font: <strong>{APPLICATION_FONT_OPTIONS.find(option => option.value === system.fontFamily)?.label || 'Inter'}</strong></p></div>}
      </div>
    </FormSection>
  </div>;
};
