import { useEffect, useMemo, useState } from "react";
import { documentApi } from "@/services/api/documents";
import { authTokenStore } from "@/services/authTokenStore";
import type {
  RevisionActionCapabilitiesResponse,
  RevisionActionCapabilityDecision,
  RevisionActionCapabilityKey,
} from "@/features/documents/document-revisions/shared/revisionActionCapabilities";

const cachedCapabilities = new Map<string, { data: RevisionActionCapabilitiesResponse; expiresAt: number }>();
const cachedRequests = new Map<string, Promise<RevisionActionCapabilitiesResponse>>();
const CACHE_TTL_MS = 5_000;

const revisionCapabilityCacheKey = (revisionId: string) =>
  `${authTokenStore.get() ?? "anonymous"}::${revisionId}`;

export function useRevisionActionCapabilities(revisionId?: string | null) {
  const [capabilities, setCapabilities] = useState<RevisionActionCapabilitiesResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(revisionId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!revisionId) {
      setCapabilities(null);
      setLoading(false);
      setError(null);
      return;
    }

    const cacheKey = revisionCapabilityCacheKey(revisionId);
    const cached = cachedCapabilities.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setCapabilities(cached.data);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const request = cachedRequests.get(cacheKey) ?? documentApi.getRevisionActionCapabilities(revisionId);
    if (!cachedRequests.has(cacheKey)) {
      cachedRequests.set(cacheKey, request);
    }

    request
      .then((data) => {
        if (cancelled) return;
        cachedCapabilities.set(cacheKey, {
          data,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        setCapabilities(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setCapabilities(null);
        setError(
          (err as any)?.response?.data?.error?.message ||
            (err as any)?.response?.data?.message ||
            (err as Error)?.message ||
            "Unable to load revision action capabilities.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        cachedRequests.delete(cacheKey);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [revisionId]);

  const actions = useMemo(() => capabilities?.actions ?? {}, [capabilities]);

  const getAction = (action: RevisionActionCapabilityKey): RevisionActionCapabilityDecision | null =>
    capabilities?.actions?.[action] ?? null;

  // A missing or failed capability response is never permission to act. Domain
  // mutations enforce this again on the backend; this makes the UI fail closed too.
  const can = (action: RevisionActionCapabilityKey) => getAction(action)?.allowed === true;

  const refresh = async () => {
    if (!revisionId) return null;
    const cacheKey = revisionCapabilityCacheKey(revisionId);
    cachedCapabilities.delete(cacheKey);
    cachedRequests.delete(cacheKey);
    const data = await documentApi.getRevisionActionCapabilities(revisionId);
    cachedCapabilities.set(cacheKey, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    setCapabilities(data);
    return data;
  };

  return {
    capabilities,
    actions,
    loading,
    error,
    getAction,
    can,
    refresh,
  };
}

export function clearRevisionActionCapabilitiesCache(revisionId?: string | null) {
  if (!revisionId) return;
  const cacheKey = revisionCapabilityCacheKey(revisionId);
  cachedCapabilities.delete(cacheKey);
  cachedRequests.delete(cacheKey);
}
