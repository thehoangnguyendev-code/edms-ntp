import { useCallback, useEffect, useState } from 'react';
import { settingsApi, type IntegrationChecks } from '@/services/api/settings';

/**
 * The last "Test connection" result of Storage and OnlyOffice, held by the page so that both tabs show the same facts and a test run in one tab is visible at once.
 * Loaded when the page is opened. It is only a convenience for the screen: when it cannot be read the tabs simply show "not tested yet", and the tests still work.
 */
export function useIntegrationChecks(enabled: boolean) {
  const [checks, setChecks] = useState<IntegrationChecks>({});
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      setChecks(await settingsApi.getIntegrationChecks());
    } catch {
      // keep what the screen already shows
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  return { checks, loaded, reload };
}

export type IntegrationChecksController = ReturnType<typeof useIntegrationChecks>;
