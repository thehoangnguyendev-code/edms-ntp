import { useEffect, useState } from 'react';
import {
  LOCALIZATION_UPDATED_EVENT,
  readSystemLocalizationSettings,
  type SystemLocalizationSettings,
} from '@/config/localization';

/** Reactively reads the administrator-managed global regional formats. */
export const useLocalizationPreferences = (): SystemLocalizationSettings => {
  const [preferences, setPreferences] = useState<SystemLocalizationSettings>(readSystemLocalizationSettings);

  useEffect(() => {
    const syncFromStorage = () => setPreferences(readSystemLocalizationSettings());
    syncFromStorage();

    window.addEventListener(LOCALIZATION_UPDATED_EVENT, syncFromStorage);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener(LOCALIZATION_UPDATED_EVENT, syncFromStorage);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  return preferences;
};
