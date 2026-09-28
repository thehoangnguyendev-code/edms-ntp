import React, { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { InfoField, EditableField } from "../components/ProfileSectionCard";
import { formatDate } from "@/utils/format";
import { cn } from "@/components/ui/utils";
import { useDebounce } from "@/hooks";
import { settingsApi } from "@/services/api/settings";
import type { User } from "../../types";

const EMPLOYEE_CODE_PREFIX = "NTP.";

interface EmployeeIdFieldProps {
  value?: string | null;
  draftValue?: string | null;
  isEditing: boolean;
  /** The record being edited's own id, so its own current Employee ID never flags itself as a
   *  conflict. Omit for a brand-new user (nothing to exclude yet). */
  excludeUserId?: string;
  onChange: (key: keyof User, value: string) => void;
  error?: string;
}

/** Employee ID -- system-suggested on create but always editable (including later, from the
 *  Detail/Edit screen once Edit is clicked), with a live "is this code already taken, and by
 *  whom" check against the server as the admin types, instead of a static once-only check. */
const EmployeeIdField: React.FC<EmployeeIdFieldProps> = ({ value, draftValue, isEditing, excludeUserId, onChange, error }) => {
  const rawDigits = (draftValue || "").startsWith(EMPLOYEE_CODE_PREFIX)
    ? (draftValue as string).slice(EMPLOYEE_CODE_PREFIX.length)
    : (draftValue || "");
  const debouncedDigits = useDebounce(rawDigits, 400);
  const [checking, setChecking] = useState(false);
  const [conflictUser, setConflictUser] = useState<{ id: string; fullName: string } | null>(null);

  useEffect(() => {
    if (!isEditing || debouncedDigits.length !== 4) {
      setConflictUser(null);
      setChecking(false);
      return;
    }
    const formatted = `${EMPLOYEE_CODE_PREFIX}${debouncedDigits}`;
    let active = true;
    setChecking(true);
    settingsApi.getUsers({ page: 1, limit: 5, search: formatted })
      .then((page) => {
        if (!active) return;
        const match = page.data.find((u) => u.employeeCode === formatted && u.id !== excludeUserId);
        setConflictUser(match ? { id: match.id, fullName: match.fullName } : null);
      })
      .catch(() => {
        if (active) setConflictUser(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedDigits, isEditing, excludeUserId]);

  if (!isEditing) {
    return <InfoField label="Employee ID" value={value} />;
  }

  return (
    <div className="min-w-0">
      <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
        Employee ID <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm font-medium text-slate-500">
          {EMPLOYEE_CODE_PREFIX}
        </span>
        <input
          type="text"
          value={rawDigits}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
            onChange("employeeCode", digits ? `${EMPLOYEE_CODE_PREFIX}${digits}` : "");
          }}
          placeholder="0008"
          maxLength={4}
          className={cn(
            "w-full h-9 pl-12 pr-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors font-medium",
            error ? "border-red-300 bg-red-50" : conflictUser ? "border-amber-300 bg-amber-50" : "border-slate-200",
          )}
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
      {!error && checking && <p className="text-xs text-slate-400 mt-1.5">Checking availability...</p>}
      {!error && !checking && conflictUser && (
        <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          This Employee ID is already assigned to {conflictUser.fullName}.
        </p>
      )}
    </div>
  );
};

interface PersonalTabProps {
  user: User;
  draft: User;
  /** One switch covers every field on this tab -- edit mode is unified per page now, not per
   *  card. See useUserProfile#isEditingProfile. */
  isEditing: boolean;
  fieldErrors: Partial<Record<keyof User, string>>;
  languageOptions: { label: string; value: string }[];
  onDraftChange: (key: keyof User, value: string) => void;
}

export const PersonalTab: React.FC<PersonalTabProps> = ({
  user,
  draft,
  isEditing,
  fieldErrors,
  languageOptions,
  onDraftChange,
}) => {
  const filteredLanguageOptions = React.useMemo(() => {
    const base = [{ label: "Select Language", value: "" }];
    const normalized = languageOptions.filter((option) => option.value && option.label);
    const current = (draft.language || "").trim();
    if (current && !normalized.some((option) => option.value === current)) {
      return [...base, { label: current, value: current }, ...normalized];
    }
    return [...base, ...normalized];
  }, [draft.language, languageOptions]);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        <EmployeeIdField
          value={user.employeeCode}
          draftValue={draft.employeeCode}
          isEditing={isEditing}
          excludeUserId={user.id || undefined}
          onChange={onDraftChange}
          error={fieldErrors.employeeCode}
        />
        <EditableField
          label="Full Name *" value={user.fullName} draftValue={draft.fullName}
          isEditing={isEditing}
          field={{ type: "text", fieldKey: "fullName" }}
          onChange={onDraftChange}
          error={fieldErrors.fullName}
          />
        <EditableField
          label="Phone Number" value={user.phone} draftValue={draft.phone}
          isEditing={isEditing}
          field={{ type: "tel", fieldKey: "phone" }}
          onChange={onDraftChange}
          error={fieldErrors.phone}
        />
        <EditableField
          label="Username *" value={user.username} draftValue={draft.username}
          isEditing={isEditing}
          field={{ type: "text", fieldKey: "username" }}
          onChange={onDraftChange}
          error={fieldErrors.username}
          />
        <EditableField
          label="Email *" value={user.email} draftValue={draft.email}
          isEditing={isEditing}
          field={{ type: "email", fieldKey: "email" }}
          onChange={onDraftChange}
          error={fieldErrors.email}
        />
        <EditableField
          label="Gender" value={user.gender} draftValue={draft.gender}
          isEditing={isEditing}
          field={{ type: "select", fieldKey: "gender", options: [
            { label: "Male", value: "Male" },
            { label: "Female", value: "Female" },
            { label: "Other", value: "Other" },
          ]}}
          onChange={onDraftChange}
          error={fieldErrors.gender}
          />
        <EditableField
          label="Date of Birth"
          value={user.dateOfBirth ? formatDate(user.dateOfBirth) : null}
          draftValue={draft.dateOfBirth}
          isEditing={isEditing}
          field={{ type: "date", fieldKey: "dateOfBirth" }}
          onChange={onDraftChange}
          error={fieldErrors.dateOfBirth}
          />
        <EditableField
          label="Nationality" value={user.nationality} draftValue={draft.nationality}
          isEditing={isEditing}
          field={{ type: "text", fieldKey: "nationality" }}
          onChange={onDraftChange}
          error={fieldErrors.nationality}
          />
        <EditableField
          label="Language(s)" value={user.language} draftValue={draft.language}
          isEditing={isEditing}
          field={{ type: "select", fieldKey: "language", options: filteredLanguageOptions }}
          onChange={onDraftChange}
          error={fieldErrors.language}
          />
        <EditableField
          label="Personal ID / Passport No." value={user.idNumber} draftValue={draft.idNumber}
          isEditing={isEditing}
          field={{ type: "text", fieldKey: "idNumber" }}
          onChange={onDraftChange}
          error={fieldErrors.idNumber}
          />
        <EditableField
          label="Address" value={user.address} draftValue={draft.address}
          isEditing={isEditing}
          field={{ type: "text", fieldKey: "address" }}
          onChange={onDraftChange}
          className="md:col-span-2"
          error={fieldErrors.address}
          />
      </div>
    </div>
  );
};
