import React from "react";
import { EditableField, InfoField } from "../components/ProfileSectionCard";
import { formatDate } from "@/utils/format";
import type { User } from "../../types";

interface EmploymentTabProps {
  user: User;
  draft: User;
  /** One switch covers every field on this tab -- edit mode is unified per page now, not per
   *  card. See useUserProfile#isEditingProfile. */
  isEditing: boolean;
  fieldErrors: Partial<Record<keyof User, string>>;
  draftDepartments: string[];
  businessUnitOptions: { label: string; value: string }[];
  managerOptions: { label: string; value: string }[];
  positionOptions: { label: string; value: string }[];
  yearsOfService: string | null;
  onDraftChange: (key: keyof User, value: string) => void;
}

export const EmploymentTab: React.FC<EmploymentTabProps> = ({
  user,
  draft,
  isEditing,
  fieldErrors,
  draftDepartments,
  businessUnitOptions,
  managerOptions,
  positionOptions,
  yearsOfService,
  onDraftChange,
}) => {
  const filteredPositionOptions = React.useMemo(() => {
    const base = [{ label: "Select Position", value: "" }];
    if (!draft.businessUnit || !draft.department) return base;
    if (positionOptions.length === 0) return base;
    return [...base, ...positionOptions];
  }, [draft.businessUnit, draft.department, positionOptions]);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        <EditableField
          label="Business Unit *" value={user.businessUnit} draftValue={draft.businessUnit}
          isEditing={isEditing}
          field={{ type: "select", fieldKey: "businessUnit", options: businessUnitOptions }}
          onChange={onDraftChange}
          error={fieldErrors.businessUnit}
        />
        <EditableField
          label="Department *" value={user.department} draftValue={draft.department}
          isEditing={isEditing}
          field={{ type: "select", fieldKey: "department", options:
            draftDepartments.map((d) => ({ label: d, value: d })),
            disabled: !draft.businessUnit
          }}
          onChange={onDraftChange}
          error={fieldErrors.department}
        />
        <EditableField
          label="Position *" value={user.position} draftValue={draft.position}
          isEditing={isEditing}
          field={{
            type: "select",
            fieldKey: "position",
            options: filteredPositionOptions,
            disabled: !draft.businessUnit || !draft.department
          }}
          onChange={onDraftChange}
          error={fieldErrors.position}
        />
        <EditableField
          label="Direct Manager" value={user.managerName} draftValue={draft.managerName}
          isEditing={isEditing}
          field={{ type: "select", fieldKey: "managerName", options: managerOptions }}
          onChange={onDraftChange}
          error={fieldErrors.managerName}
        />
        <EditableField
          label="Employment Type" value={user.employmentType} draftValue={draft.employmentType}
          isEditing={isEditing}
          field={{ type: "select", fieldKey: "employmentType", options: [
            { label: "Full-time", value: "Full-time" },
            { label: "Part-time", value: "Part-time" },
            { label: "Contract", value: "Contract" },
            { label: "Intern", value: "Intern" },
          ]}}
          onChange={onDraftChange}
          error={fieldErrors.employmentType}
        />
        <EditableField
          label="Start Date *"
          value={user.startDate ? formatDate(user.startDate) : null}
          draftValue={draft.startDate}
          isEditing={isEditing}
          field={{ type: "date", fieldKey: "startDate" }}
          onChange={onDraftChange}
          error={fieldErrors.startDate}
        />
        <InfoField label="Timeserving" value={yearsOfService} />
      </div>
    </div>
  );
};
