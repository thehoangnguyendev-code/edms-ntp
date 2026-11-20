import { useCallback, useEffect, useState } from "react";
import { separationRulesApi, type SeparationRule } from "@/services/api";

/**
 * The Separation Rules of ONE module for the Segregation of Duties page: the rules as saved, the ticks the administrator has changed but not saved yet (`draft`), and the one save of all of them
 * under a single signature. Works like the Document Revision Integrity tab: the ticks change only while editing, and nothing is stored until Save.
 */
export function useSeparationRules(moduleKey: string | null) {
  const [rules, setRules] = useState<SeparationRule[]>([]);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!moduleKey) return;
    setIsLoading(true);
    setFailed(false);
    try {
      const loaded = await separationRulesApi.list({ moduleKey });
      setRules(loaded);
      setDraft(Object.fromEntries(loaded.map((r) => [r.id, r.enabled])));
    } catch {
      setFailed(true);
      setRules([]);
      setDraft({});
    } finally {
      setIsLoading(false);
    }
  }, [moduleKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const changed = rules.filter((r) => draft[r.id] !== r.enabled);
  const isDirty = changed.length > 0;

  const toggle = (id: string, checked: boolean) => setDraft((previous) => ({ ...previous, [id]: checked }));
  const reset = () => setDraft(Object.fromEntries(rules.map((r) => [r.id, r.enabled])));

  /** Saves every changed tick under one signature, then reloads what the server now holds. */
  const save = async (reason: string, signatureToken: string) => {
    await separationRulesApi.setMany(
      changed.map((r) => ({ id: r.id, enabled: draft[r.id] })),
      { reason, signatureToken },
    );
    await load();
  };

  return { rules, draft, isLoading, failed, isDirty, changed, toggle, reset, save };
}
