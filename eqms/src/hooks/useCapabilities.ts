import { useState, useEffect } from 'react';
import { settingsApi } from '@/services/api/settings';

export interface Capabilities {
  canViewDocuments: boolean;
  canCreateDocument: boolean;
  canEditDocumentMetadata: boolean;
  canSubmitRevision: boolean;
  canReviewRevision: boolean;
  canApproveRevision: boolean;
  canPublishRevision: boolean;
  canManageTraining: boolean;
  canCompleteTraining: boolean;
  canViewAuditTrail: boolean;
  canRequestControlledCopy: boolean;
  canDistributeControlledCopy: boolean;
  canRecallControlledCopy: boolean;
  canManageUsers: boolean;
  canManageRoles: boolean;
  canManageSystemConfiguration: boolean;
  canManageEmailTemplates: boolean;
  canManageDictionaries: boolean;
  canViewSystemInfo: boolean;
  isSuperAdmin: boolean;
}

let cachedCapabilities: Capabilities | null = null;

export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(cachedCapabilities);
  const [loading, setLoading] = useState(cachedCapabilities === null);

  useEffect(() => {
    if (cachedCapabilities !== null) return;
    let cancelled = false;
    setLoading(true);
    settingsApi
      .getMyCapabilities()
      .then((data) => {
        if (!cancelled) {
          cachedCapabilities = data as unknown as Capabilities;
          setCapabilities(cachedCapabilities);
        }
      })
      .catch(() => {
        // fallback: no capabilities
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { capabilities, loading };
}

/** Call this on logout so capabilities are re-fetched on next login */
export function clearCapabilitiesCache() {
  cachedCapabilities = null;
}
