import { useEffect, useState } from "react";
import { useDebounce } from "@/hooks";
import { settingsApi, type SodProfileCombinationViolationResponse } from "@/services/api/settings";

/**
 * Live SoD check for a proposed SET of Access Profiles (e.g. while picking profiles for a user).
 * Debounces the id list and re-checks the combination via the server whenever it settles.
 */
export function useSodAccessProfileCheck(profileIds: string[], enabled: boolean = true) {
  const [violations, setViolations] = useState<SodProfileCombinationViolationResponse[]>([]);
  const [checking, setChecking] = useState(false);
  const debouncedIds = useDebounce(profileIds, 400);

  useEffect(() => {
    if (!enabled || debouncedIds.length === 0) {
      setViolations([]);
      return;
    }
    let active = true;
    setChecking(true);
    settingsApi
      .checkSodAccessProfileCombination(debouncedIds)
      .then((result) => {
        if (active) setViolations(result);
      })
      .catch(() => {
        if (active) setViolations([]);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, debouncedIds]);

  return {
    violations,
    checking,
    hasBlockingViolation: violations.some((v) => v.severity === "BLOCK"),
  };
}
