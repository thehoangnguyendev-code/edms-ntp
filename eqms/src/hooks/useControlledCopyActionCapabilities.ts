import { useEffect, useMemo, useState } from "react";
import { documentApi } from "@/services/api/documents";
import { authTokenStore } from "@/services/authTokenStore";
import type {
  ControlledCopyActionCapabilities,
  ControlledCopyActionCode,
  ControlledCopyActionDecision,
} from "@/features/documents/controlled-copies/controlledCopyCapabilities";
import { emptyControlledCopyDecision } from "@/features/documents/controlled-copies/controlledCopyCapabilities";

const CACHE_TTL_MS = 5_000;

type CacheEntry = { data: ControlledCopyActionCapabilities; expiresAt: number };

const copyCapabilitiesCache = new Map<string, CacheEntry>();
const copyCapabilitiesRequests = new Map<string, Promise<ControlledCopyActionCapabilities>>();
const batchCapabilitiesCache = new Map<string, CacheEntry>();
const batchCapabilitiesRequests = new Map<string, Promise<ControlledCopyActionCapabilities>>();

const loadCapabilities = async (
  id: string,
  kind: "copy" | "batch",
): Promise<ControlledCopyActionCapabilities> => {
  if (kind === "copy") {
    return documentApi.getControlledCopyActionCapabilities(id);
  }
  return documentApi.getControlledCopyBatchActionCapabilities(id);
};

const getCache = (kind: "copy" | "batch") => (kind === "copy" ? copyCapabilitiesCache : batchCapabilitiesCache);
const getRequests = (kind: "copy" | "batch") => (kind === "copy" ? copyCapabilitiesRequests : batchCapabilitiesRequests);
const capabilityCacheKey = (id: string) => `${authTokenStore.get() ?? "anonymous"}::${id}`;

function useControlledCopyCapabilitiesInternal(id?: string | null, kind: "copy" | "batch" = "copy") {
  const [capabilities, setCapabilities] = useState<ControlledCopyActionCapabilities | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setCapabilities(null);
      setLoading(false);
      setError(null);
      return;
    }

    const cache = getCache(kind);
    const requests = getRequests(kind);
    const cacheKey = capabilityCacheKey(id);
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setCapabilities(cached.data);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const request = requests.get(cacheKey) ?? loadCapabilities(id, kind);
    if (!requests.has(cacheKey)) {
      requests.set(cacheKey, request);
    }

    request
      .then((data) => {
        if (cancelled) return;
        cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        setCapabilities(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setCapabilities(null);
        setError(
          (err as any)?.response?.data?.error?.message ||
            (err as any)?.response?.data?.message ||
            (err as Error)?.message ||
            "Unable to load controlled copy capabilities.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        requests.delete(cacheKey);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, kind]);

  const actions = useMemo(() => capabilities?.actions ?? {}, [capabilities]);

  const getAction = (action: ControlledCopyActionCode): ControlledCopyActionDecision =>
    capabilities?.actions?.[action] ?? emptyControlledCopyDecision;

  const can = (action: ControlledCopyActionCode) => getAction(action)?.allowed === true;

  const refresh = async () => {
    if (!id) return null;
    const cache = getCache(kind);
    const requests = getRequests(kind);
    const cacheKey = capabilityCacheKey(id);
    cache.delete(cacheKey);
    requests.delete(cacheKey);
    const data = await loadCapabilities(id, kind);
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
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

export function useControlledCopyActionCapabilities(copyId?: string | null) {
  return useControlledCopyCapabilitiesInternal(copyId, "copy");
}

export function useControlledCopyBatchActionCapabilities(batchId?: string | null) {
  return useControlledCopyCapabilitiesInternal(batchId, "batch");
}

export function clearControlledCopyActionCapabilitiesCache(id?: string | null, kind: "copy" | "batch" = "copy") {
  if (!id) return;
  const cache = getCache(kind);
  const requests = getRequests(kind);
  const cacheKey = capabilityCacheKey(id);
  cache.delete(cacheKey);
  requests.delete(cacheKey);
}
