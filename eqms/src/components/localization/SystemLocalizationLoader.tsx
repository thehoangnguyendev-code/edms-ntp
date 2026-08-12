import { useEffect } from 'react';
import { api } from '@/services/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { localizationApi } from '@/services/api/localization';
import { createSharedPollingResource, type SharedPollingResource } from '@/services/sharedPollingResource';
import {
  LOCALIZATION_UPDATED_EVENT,
  type SystemLocalizationSettings,
  writeSystemLocalizationSettings,
} from '@/config/localization';

const REFRESH_INTERVAL_MS = 30_000;

/** Loads the administrator-managed formatting rules for every active user. */
export const SystemLocalizationLoader = () => {
  const { isAuthenticated, user } = useAuth();
  useEffect(() => {
    const resource = getLocalizationResource(isAuthenticated, user?.id);
    const apply = () => {
      const value = resource.getSnapshot();
      if (value) writeSystemLocalizationSettings(value);
    };
    const unsubscribe = resource.subscribe(apply);
    apply();
    const handleUpdated = () => void resource.refresh();
    window.addEventListener(LOCALIZATION_UPDATED_EVENT, handleUpdated);
    return () => {
      unsubscribe();
      window.removeEventListener(LOCALIZATION_UPDATED_EVENT, handleUpdated);
    };
  }, [isAuthenticated, user?.id]);
  return null;
};

const localizationResources = new Map<string, SharedPollingResource<SystemLocalizationSettings>>();
const getLocalizationResource = (authenticated: boolean, userId?: string) => {
  // Personal localization (including font) must never be reused from a
  // previous account after logout/login or an account switch.
  const resourceKey = authenticated ? `user:${userId || 'current'}` : 'anonymous';
  const existing = localizationResources.get(resourceKey);
  if (existing) return existing;
  const resource = createSharedPollingResource(async () => {
    const response = await api.get<SystemLocalizationSettings>('/localization');
    if (!authenticated) return response.data;
    const personal = await localizationApi.getMine();
    return personal.useSystemDefaults ? response.data : { ...response.data, ...personal };
  }, REFRESH_INTERVAL_MS);
  localizationResources.set(resourceKey, resource);
  return resource;
};
