import React, { useCallback, useEffect, useState } from 'react';
import { Globe, Type } from 'lucide-react';
import { Select } from '@/components/ui/select/Select';
import { Switch } from '@/components/ui';
import { FormSection } from '@/components/ui/form/FormSection';
import { localizationApi, type UserLocalizationPreferences } from '@/services/api/localization';
import {
  APPLICATION_FONT_OPTIONS,
  DEFAULT_LOCALIZATION_SETTINGS,
  normalizeApplicationLanguage,
  readSystemLocalizationSettings,
  writeSystemLocalizationSettings,
  type SystemLocalizationSettings,
} from '@/config/localization';
import { LANGUAGE_OPTIONS, useLanguage } from '@/i18n';

interface LocalizationTabProps {
  onRegisterSaveHandler?: ((handler: (() => Promise<void>) | null) => void);
  onRegisterResetHandler?: ((handler: (() => void) | null) => void);
  onDirtyChange?: (dirty: boolean) => void;
}

const NUMBER_FORMATS = [{ value: 'en-US', label: '1,234.56 (US/UK)' }, { value: 'de-DE', label: '1.234,56 (EU)' }, { value: 'fr-FR', label: '1 234,56 (FR)' }, { value: 'ja-JP', label: '1,234.56 (JP)' }];

export const LocalizationTab: React.FC<LocalizationTabProps> = ({ onRegisterSaveHandler, onRegisterResetHandler, onDirtyChange }) => {
  const { t, setLanguage } = useLanguage();
  const [system, setSystem] = useState<SystemLocalizationSettings>(readSystemLocalizationSettings);
  const [preferences, setPreferences] = useState<UserLocalizationPreferences>({ useSystemDefaults: true });
  const [originalPreferences, setOriginalPreferences] = useState<UserLocalizationPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void localizationApi.getSystem().then(value => setSystem({ ...DEFAULT_LOCALIZATION_SETTINGS, ...value })).catch(() => setSystem(readSystemLocalizationSettings));
    void localizationApi.getMine().then((value) => { setPreferences(value); setOriginalPreferences(value); }).finally(() => setLoading(false));
  }, []);

  const isDirty = originalPreferences !== null && JSON.stringify(preferences) !== JSON.stringify(originalPreferences);
  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, onDirtyChange]);

  const effective = { ...DEFAULT_LOCALIZATION_SETTINGS, ...(preferences.useSystemDefaults ? system : { ...system, ...preferences }) };
  const effectiveLanguage = normalizeApplicationLanguage(preferences.language ?? effective.language);
  const setValue = <K extends Exclude<keyof SystemLocalizationSettings, 'language'>>(key: K, value: SystemLocalizationSettings[K]) => setPreferences(current => ({ ...current, useSystemDefaults: false, [key]: value }));

  // The language is the person's own choice, independent of the regional formats: apply it at once, keep the rest.
  const chooseLanguage = useCallback((value: string | number) => {
    const next = normalizeApplicationLanguage(value);
    setPreferences(current => ({ ...current, language: next }));
    void setLanguage(next);
  }, [setLanguage]);

  const saveChanges = useCallback(async () => {
    const saved = await localizationApi.updateMine({ ...preferences, language: effectiveLanguage });
    setPreferences(saved);
    setOriginalPreferences(saved);
    const next = saved.useSystemDefaults ? { ...system, language: saved.language ?? system.language } : { ...system, ...saved };
    writeSystemLocalizationSettings(next);
  }, [preferences, system, effectiveLanguage]);

  useEffect(() => { onRegisterSaveHandler?.(saveChanges); return () => onRegisterSaveHandler?.(null); }, [onRegisterSaveHandler, saveChanges]);
  useEffect(() => {
    const resetToSystemDefaults = () => setPreferences({ useSystemDefaults: true });
    onRegisterResetHandler?.(resetToSystemDefaults);
    return () => onRegisterResetHandler?.(null);
  }, [onRegisterResetHandler]);

  const languageLabel = LANGUAGE_OPTIONS.find(option => option.value === effectiveLanguage)?.label ?? LANGUAGE_OPTIONS[0].label;

  return <div className="p-1 animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
    <FormSection title={t('preferences.language', 'Language')} icon={<Globe className="h-4 w-4" />}>
      <div className="space-y-2">
        <Select
          label={t('preferences.language', 'Language')}
          value={effectiveLanguage}
          options={LANGUAGE_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
          onChange={chooseLanguage}
          enableSearch={false}
        />
        <p className="text-xs text-slate-500">{t('preferences.languageHint', 'The interface language for your account.')}</p>
      </div>
    </FormSection>

    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">{t('preferences.languageBanner', 'The interface language is saved for each account. You may customize regional formats; resetting restores the administrator values.')}</div>

    <FormSection title={t('preferences.regional', 'Regional Format Preferences')} icon={<Globe className="h-4 w-4" />}>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-900">{t('preferences.useSystemDefaults', 'Use system defaults')}</p>
            <p className="text-xs text-slate-500">{t('preferences.useSystemDefaultsHint', 'Follow the localization configured by your administrator.')}</p>
          </div>
          <Switch checked={preferences.useSystemDefaults} onChange={(checked) => setPreferences(checked ? { useSystemDefaults: true } : { ...effective, useSystemDefaults: false })} disabled={loading} />
        </div>
        {!preferences.useSystemDefaults && <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div><p className="mb-1.5 text-xs font-medium text-slate-700 sm:text-sm">{t('preferences.dateTime', 'Date & Time Format')}</p><p className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">DD/MM/YYYY HH:mm:ss</p><p className="mt-1 text-xs text-slate-500">{t('preferences.fixedHint', 'The same for everybody; it is not a preference.')}</p></div>
          <div><p className="mb-1.5 text-xs font-medium text-slate-700 sm:text-sm">{t('preferences.timeZone', 'Time Zone')}</p><p className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">Asia/Ho_Chi_Minh (UTC+7)</p><p className="mt-1 text-xs text-slate-500">{t('preferences.fixedHint', 'The zone of the site; it is not a preference.')}</p></div>
          <Select label={t('preferences.numberFormat', 'Number Format')} value={effective.numberFormat} options={NUMBER_FORMATS} onChange={value => setValue('numberFormat', value)} />
          <Select label={t('preferences.font', 'Application Font')} value={effective.fontFamily} options={[...APPLICATION_FONT_OPTIONS]} onChange={value => setValue('fontFamily', String(value) as SystemLocalizationSettings['fontFamily'])} />
        </div>}
        {preferences.useSystemDefaults && <div className="grid grid-cols-1 gap-3 text-sm text-slate-600 md:grid-cols-2">
          <p>{t('preferences.language', 'Language')}: <strong>{languageLabel}</strong></p>
          <p>{t('preferences.dateTime', 'Date & time')}: <strong>{system.dateTimeFormat}</strong></p>
          <p>{t('preferences.timeZone', 'Time zone')}: <strong>{system.timeZone}</strong></p>
          <p>{t('preferences.numberFormat', 'Number')}: <strong>{new Intl.NumberFormat(system.numberFormat).format(1234567.89)}</strong></p>
          <p className="flex items-center gap-1.5"><Type className="h-3.5 w-3.5" />{t('preferences.font', 'Font')}: <strong>{APPLICATION_FONT_OPTIONS.find(option => option.value === system.fontFamily)?.label || 'Inter'}</strong></p>
        </div>}
      </div>
    </FormSection>
  </div>;
};
