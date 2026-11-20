import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api/client';

export const GIB = 1024 ** 3;

export type StorageScanState = {
  lastResult: string | null; lastAttemptAt: string | null; lastSuccessAt: string | null; stale: boolean;
  /** The last time the administrators were told that the usage reached the warning threshold, and how many of them (null when never). */
  warningSentAt?: string | null; warningRecipients?: number | null;
};
export type StorageUsageStatus = {
  policy: { budgetBytes: number | null; warningPercent: number };
  warning: boolean | null;
  scanState: StorageScanState | null;
};
/** What the two fields hold while they are being edited: text, exactly as typed. */
export type StoragePolicyDraft = { budget: string; threshold: string };
export type StoragePolicyErrors = { budget?: string; threshold?: string };
export type StoragePolicyValue = { budgetBytes: number | null; warningPercent: number };

const toDraft = (status: StorageUsageStatus): StoragePolicyDraft => ({
  budget: status.policy.budgetBytes == null ? '' : String(Number((status.policy.budgetBytes / GIB).toFixed(4))),
  threshold: String(status.policy.warningPercent),
});

/** The numbers behind the two fields, or what is wrong with them. An empty budget is valid: it means "no budget". */
export const parseStoragePolicy = (draft: StoragePolicyDraft): { value: StoragePolicyValue | null; errors: StoragePolicyErrors } => {
  const errors: StoragePolicyErrors = {};
  let budgetBytes: number | null = null;
  if (draft.budget.trim() !== '') {
    const gib = Number(draft.budget);
    const bytes = Math.round(gib * GIB);
    if (!Number.isFinite(gib) || !Number.isSafeInteger(bytes) || bytes <= 0) errors.budget = 'Enter a budget in GiB greater than 0, or leave it empty.';
    else budgetBytes = bytes;
  }
  const percent = Number(draft.threshold);
  if (draft.threshold.trim() === '' || !Number.isInteger(percent) || percent < 1 || percent > 100) errors.threshold = 'Enter a whole number from 1 to 100.';
  return { value: errors.budget || errors.threshold ? null : { budgetBytes, warningPercent: percent }, errors };
};

/**
 * The storage budget and the warning threshold of Configuration → Integrations → Storage Usage, held by the page so that they are saved, reset and guarded
 * like every other setting on it (one Save, one Reset, the leave-the-page guard). Loaded when the page is opened and kept while the tabs change.
 * The policy is written last by the page's Save, and only when it changed.
 */
export function useStoragePolicyDraft(enabled: boolean) {
  const [status, setStatus] = useState<StorageUsageStatus | null>(null);
  const [original, setOriginal] = useState<StoragePolicyDraft | null>(null);
  const [draft, setDraft] = useState<StoragePolicyDraft | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || original) return;
    let active = true;
    setFailed(false);
    api.get<StorageUsageStatus>('/settings/storage-usage/status').then((response) => {
      if (!active) return;
      const loaded = toDraft(response.data);
      setStatus(response.data);
      setOriginal(loaded);
      setDraft(loaded);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [enabled, original, attempt]);

  const parsed = useMemo(() => (draft ? parseStoragePolicy(draft) : null), [draft]);
  const isDirty = Boolean(draft && original && (draft.budget !== original.budget || draft.threshold !== original.threshold));
  /** False only when a change that is waiting to be saved cannot be saved as it stands. */
  const isValid = !isDirty || Boolean(parsed?.value);
  /** The policy the screen should reason with: the one being typed while it is valid, the saved one otherwise. */
  const effective: StoragePolicyValue | null = useMemo(() => {
    if (parsed?.value) return parsed.value;
    return status ? { budgetBytes: status.policy.budgetBytes, warningPercent: status.policy.warningPercent } : null;
  }, [parsed, status]);

  const save = useCallback(async () => {
    if (!draft || !isDirty || !parsed?.value) return;
    await api.put('/settings/storage-usage/policy', parsed.value);
    const response = await api.get<StorageUsageStatus>('/settings/storage-usage/status');
    const saved = toDraft(response.data);
    setStatus(response.data);
    setOriginal(saved);
    setDraft(saved);
  }, [draft, isDirty, parsed]);

  return {
    status, draft, setDraft, failed, retry: () => setAttempt((value) => value + 1),
    errors: parsed?.errors ?? {}, effective, isDirty, isValid, save, reset: () => setDraft(original),
  };
}

export type StoragePolicyController = ReturnType<typeof useStoragePolicyDraft>;
