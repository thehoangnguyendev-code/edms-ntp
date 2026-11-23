import React, { useEffect, useState } from "react";
import { trainingWorkPositionApi } from "@/services/api/trainingActivities";
import { EditableField, InfoField, FieldGroup } from "../components/ProfileSectionCard";
import { formatDate } from "@/utils/format";
import type { User } from "../../types";
import { tr } from "@/i18n";

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
  // The work position of the person for Training (the matrix and the job assignment): read only, and not the same as the Position above, which is the title of the person.
  const [workPosition, setWorkPosition] = useState<{ positionName?: string; source?: string }>({});
  useEffect(() => {
    let live = true;
    setWorkPosition({});
    if (user.id) trainingWorkPositionApi.of(String(user.id)).then((p) => { if (live) setWorkPosition(p); }).catch(() => { if (live) setWorkPosition({}); });
    return () => { live = false; };
  }, [user.id]);

  const filteredPositionOptions = React.useMemo(() => {
    const base = [{ label: tr("Select Position"), value: "" }];
    if (!draft.businessUnit || !draft.department) return base;
    if (positionOptions.length === 0) return base;
    return [...base, ...positionOptions];
  }, [draft.businessUnit, draft.department, positionOptions]);

  return (
    <div>
      <FieldGroup title={tr("Position")}>
        <EditableField
          label={tr("Business Unit *")} value={user.businessUnit} draftValue={draft.businessUnit}
          isEditing={isEditing}
          field={{ type: "select", fieldKey: "businessUnit", options: businessUnitOptions }}
          onChange={onDraftChange}
          error={fieldErrors.businessUnit}
        />
        <EditableField
          label={tr("Department *")} value={user.department} draftValue={draft.department}
          isEditing={isEditing}
          field={{ type: "select", fieldKey: "department", options:
            draftDepartments.map((d) => ({ label: d, value: d })),
            disabled: !draft.businessUnit
          }}
          onChange={onDraftChange}
          error={fieldErrors.department}
        />
        <EditableField
          label={tr("Position *")} value={user.position} draftValue={draft.position}
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
        {workPosition.positionName && (
          <InfoField label={tr("Work Position (Training)")} value={workPosition.positionName} />
        )}
        <EditableField
          label={tr("Direct Manager")} value={user.managerName} draftValue={draft.managerName}
          isEditing={isEditing}
          field={{ type: "select", fieldKey: "managerName", options: managerOptions }}
          onChange={onDraftChange}
          error={fieldErrors.managerName}
        />
      </FieldGroup>
      <FieldGroup title={tr("Contract")} divided>
        <EditableField
          label={tr("Employment Type")} value={user.employmentType} draftValue={draft.employmentType}
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
          label={tr("Start Date *")}
          value={user.startDate ? formatDate(user.startDate) : null}
          draftValue={draft.startDate}
          isEditing={isEditing}
          field={{ type: "date", fieldKey: "startDate" }}
          onChange={onDraftChange}
          error={fieldErrors.startDate}
        />
        <InfoField label={tr("Timeserving")} value={yearsOfService} />
      </FieldGroup>
    </div>
  );
};
