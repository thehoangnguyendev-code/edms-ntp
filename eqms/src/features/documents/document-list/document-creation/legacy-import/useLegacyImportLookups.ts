import { useCallback, useEffect, useMemo, useState } from "react";
import type { SelectOption } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast";
import { dictionaryApi } from "@/services/api/dictionary";
import { securityApi } from "@/services/api/security";
import { settingsApi } from "@/services/api/settings";
import { formatDocumentTypeLookupLabel } from "@/features/documents/shared/documentTypeDisplay";
import { errorMessage, type DepartmentOption, type DocumentFormState, type DocumentTypeOption, type SubTypeOption, type UserOption } from "./legacyImportModel";

/** What the form needs from the server before the person types: the Document Properties settings, the dictionaries and the users to choose from. */
export function useLegacyImportLookups(form: DocumentFormState) {
  const { showToast } = useToast();
  const [documentTypeOptions, setDocumentTypeOptions] = useState<
    DocumentTypeOption[]
  >([]);
  const [businessUnitOptions, setBusinessUnitOptions] = useState<
    SelectOption[]
  >([]);
  const [departmentOptions, setDepartmentOptions] = useState<
    DepartmentOption[]
  >([]);
  const [subTypeOptions, setSubTypeOptions] = useState<SubTypeOption[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [maxFileSizeMB, setMaxFileSizeMB] = useState(25);
  const [serialNumberDigits, setSerialNumberDigits] = useState(4);
  const [revisionNumberSeed, setRevisionNumberSeed] = useState<"0.0.1" | "0.1">(
    "0.0.1",
  );

  useEffect(() => {
    let alive = true;
    settingsApi
      .getDocumentsOperationalConfig()
      .then((config) => {
        if (!alive) return;
        const typed = config as {
          maxFileSizeMB?: number;
          serialNumberDigits?: number;
          revisionNumberSeed?: string;
        };
        const maxSize = Number(typed?.maxFileSizeMB);
        if (Number.isFinite(maxSize) && maxSize > 0) setMaxFileSizeMB(maxSize);
        const digits = Number(typed?.serialNumberDigits);
        if (Number.isFinite(digits) && digits >= 1 && digits <= 9)
          setSerialNumberDigits(digits);
        if (typed?.revisionNumberSeed === "0.1") setRevisionNumberSeed("0.1");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [types, businessUnits, departments, subTypes] = await Promise.all(
          [
            dictionaryApi.getDocumentTypes(),
            dictionaryApi.getBusinessUnits(),
            dictionaryApi.getDepartments(),
            dictionaryApi.getSubTypes(),
          ],
        );
        if (!alive) return;
        const businessUnitIdByName = new Map(
          businessUnits
            .filter((b) => b.isActive)
            .map((b) => [String(b.name).trim(), b.id]),
        );
        setDocumentTypeOptions(
          types
            .filter((t) => t.isActive)
            .map((t) => ({
              label: formatDocumentTypeLookupLabel(t.shortCode, t.name),
              value: t.id,
              shortCode: t.shortCode,
            })),
        );
        setBusinessUnitOptions(
          businessUnits
            .filter((b) => b.isActive)
            .map((b) => ({ label: b.name, value: b.id })),
        );
        setDepartmentOptions(
          departments
            .filter((d) => d.isActive)
            .map((d) => ({
              label: d.name,
              value: d.id,
              businessUnit:
                businessUnitIdByName.get(String(d.businessUnit).trim()) ||
                String(d.businessUnit || ""),
            })),
        );
        setSubTypeOptions(
          subTypes
            .filter((s) => s.isActive)
            .map((s) => ({
              label: s.name,
              value: s.id,
              documentTypeId: s.documentTypeId,
            })),
        );
      } catch (error) {
        showToast({
          type: "error",
          title: "Failed to load",
          message: errorMessage(
            error,
            "Unable to load Document Type / Business Unit / Department.",
          ),
        });
      } finally {
        if (alive) setLoadingLookups(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [showToast]);

  // Live server-side search for Document Type / Business Unit, on top of the small cached
  // full-list fetch above -- these dictionaries are tens-scale today, but typing now hits the
  // real paged/search endpoint instead of only filtering the already-loaded array, so the picker
  // stays correct (not silently capped) if either dictionary grows.
  const searchDocumentTypeOptions = useCallback(async (query: string) => {
    const page = await dictionaryApi.getDocumentTypesPage({ search: query, status: "Active", limit: 50 });
    return page.data.map((t) => ({
      label: formatDocumentTypeLookupLabel(t.shortCode, t.name),
      value: t.id,
    }));
  }, []);

  const searchBusinessUnitOptions = useCallback(async (query: string) => {
    const page = await dictionaryApi.getBusinessUnitsPage({ search: query, status: "Active", limit: 50 });
    return page.data.map((b) => ({ label: b.name, value: b.id }));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const results = await securityApi.getEligibleUsers(
          "documents.document.view",
          "",
        );
        if (!alive) return;
        setUserOptions(
          results.map((u) => ({
            label: `${u.employeeCode ? `${u.employeeCode} - ` : ""}${u.fullName} (${u.department})`,
            value: u.id,
          })),
        );
      } catch (error) {
        showToast({
          type: "error",
          title: "Failed to load",
          message: errorMessage(
            error,
            "Unable to load the user directory for Author / Reviewer / Approver.",
          ),
        });
      } finally {
        if (alive) setLoadingUsers(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [showToast]);

  // Stable reference (useCallback, no deps) is required here -- Select/MultiSelect's internal
  // debounced-search effect depends on this function's identity. A plain inline function gets
  // recreated on every LegacyImportView render (e.g. right after picking a reviewer updates
  // `sections` state), which re-triggers that effect and refetches/reopens the dropdown even
  // though the search query itself never changed -- the exact "dropdown reloads after selecting
  // someone" symptom this fixes.
  const searchUsers = useCallback(async (query: string) => {
    const results = await securityApi.getEligibleUsers(
      "documents.document.view",
      query,
    );
    return results.map((u) => ({
      label: `${u.employeeCode ? `${u.employeeCode} - ` : ""}${u.fullName} (${u.department})`,
      value: u.id,
    }));
  }, []);

  const filteredDepartmentOptions = useMemo(
    () =>
      form.businessUnit
        ? departmentOptions.filter(
            (d) => !d.businessUnit || d.businessUnit === form.businessUnit,
          )
        : [],
    [departmentOptions, form.businessUnit],
  );

  const subTypeOptionsForSelectedDocumentType = useMemo(
    () =>
      form.documentType
        ? subTypeOptions.filter((s) => s.documentTypeId === form.documentType)
        : [],
    [subTypeOptions, form.documentType],
  );

  const documentTypeName = useMemo(
    () =>
      documentTypeOptions.find((o) => o.value === form.documentType)?.label ??
      "",
    [documentTypeOptions, form.documentType],
  );

  return {
    documentTypeOptions,
    businessUnitOptions,
    subTypeOptionsForSelectedDocumentType,
    filteredDepartmentOptions,
    loadingLookups,
    userOptions,
    loadingUsers,
    maxFileSizeMB,
    serialNumberDigits,
    revisionNumberSeed,
    documentTypeName,
    searchDocumentTypeOptions,
    searchBusinessUnitOptions,
    searchUsers,
  };
}
