import { useEffect, useState } from "react";
import { dictionaryApi } from "@/services/api/dictionary";
import type { MultiSelectOption } from "@/components/ui/select/MultiSelect";

/** Business Unit / Department options for the Access Profile scope fields —
 * shared by RoleSetupWizardView and AccessProfileGeneralTab so both present
 * the same dictionary-backed choices instead of free text. */
export function useScopeOptions() {
  const [businessUnitOptions, setBusinessUnitOptions] = useState<MultiSelectOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<MultiSelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([dictionaryApi.getBusinessUnits(), dictionaryApi.getDepartments()])
      .then(([businessUnits, departments]) => {
        if (cancelled) return;
        setBusinessUnitOptions(
          businessUnits.filter((bu) => bu.isActive).map((bu) => ({ label: bu.name, value: bu.name })),
        );
        setDepartmentOptions(
          departments.filter((d) => d.isActive).map((d) => ({ label: d.name, value: d.name })),
        );
      })
      .catch(() => { /* fields degrade to empty option lists; scope stays optional */ })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { businessUnitOptions, departmentOptions, isLoading };
}
