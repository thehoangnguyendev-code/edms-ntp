import { useEffect, useState } from 'react';
import { api } from '@/services/api/client';

export type NetworkAccessSettings = {
  enabled: boolean;
  allowedNetworks: string[];
  trustedProxies: string[];
  emergencyUserId: string | null;
};

export type NetworkAccessDraft = Omit<NetworkAccessSettings, 'allowedNetworks' | 'trustedProxies'> & {
  allowedNetworks: string;
  trustedProxies: string;
};

const toDraft = (value: NetworkAccessSettings): NetworkAccessDraft => ({
  ...value,
  allowedNetworks: value.allowedNetworks.join('\n'),
  trustedProxies: value.trustedProxies.join('\n'),
});

export const networkAccessPayload = (value: NetworkAccessDraft): NetworkAccessSettings => {
  const lines = (text: string) => text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return { ...value, allowedNetworks: lines(value.allowedNetworks), trustedProxies: lines(value.trustedProxies) };
};

/** Loaded only when Security is opened; the draft survives tab unmounts. */
export function useNetworkAccessDraft(enabled: boolean) {
  const [draft, setDraft] = useState<NetworkAccessDraft | null>(null);
  const [original, setOriginal] = useState<NetworkAccessDraft | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled || original) return;
    let active = true;
    setFailed(false);
    api.get<NetworkAccessSettings>('/settings/network-access').then(response => {
      if (!active) return;
      const loaded = toDraft(response.data);
      setOriginal(loaded);
      setDraft(loaded);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [enabled, original]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(original);
  const save = async () => {
    if (!draft || !isDirty) return;
    const response = await api.put<NetworkAccessSettings>('/settings/network-access', networkAccessPayload(draft));
    const saved = toDraft(response.data);
    setOriginal(saved);
    setDraft(saved);
  };
  return { draft, setDraft, failed, isDirty, save, reset: () => setDraft(original) };
}
