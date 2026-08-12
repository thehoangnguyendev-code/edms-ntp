import React from "react";
import { User as UserIcon, Briefcase, Shield } from "lucide-react";
import { InfoField, EditableField } from "../components/ProfileSectionCard";
import type { SectionKey } from "../components/ProfileSectionCard";
import { formatDate } from "@/utils/format";
import type { User } from "../types";
import { FormSection } from "@/components/ui/form/FormSection";
import { Button } from "@/components/ui/button/Button";
import { IconPencilMinus } from "@tabler/icons-react";
import { cn } from "@/components/ui/utils";

interface PersonalTabProps {
  user: User;
  draft: User;
  editingSection: SectionKey | null;
  isDraftDirty: boolean;
  fieldErrors: Partial<Record<keyof User, string>>;
  draftDepartments: string[];
  businessUnitOptions: { label: string; value: string }[];
  languageOptions: { label: string; value: string }[];
  managerOptions: { label: string; value: string }[];
  positionOptions: { label: string; value: string }[];
  yearsOfService: string | null;
  canEdit?: boolean;
  onSectionEdit: (section: SectionKey) => void;
  onSectionSave: (section: SectionKey) => void;
  onSectionCancel: () => void;
  onSectionReset: () => void;
  onDraftChange: (key: keyof User, value: string) => void;
}

export const PersonalTab: React.FC<PersonalTabProps> = ({
  user,
  draft,
  editingSection,
  isDraftDirty,
  fieldErrors,
  draftDepartments,
  businessUnitOptions,
  languageOptions,
  managerOptions,
  positionOptions,
  yearsOfService,
  canEdit = true,
  onSectionEdit,
  onSectionSave,
  onSectionCancel,
  onSectionReset,
  onDraftChange,
}) => {
  const isPersonalEditing = editingSection === "personal";
  const isWorkEditing = editingSection === "work";
  const isAccountEditing = editingSection === "account";

  const filteredPositionOptions = React.useMemo(() => {
    const base = [{ label: "Select Position", value: "" }];
    if (!draft.businessUnit || !draft.department) return base;
    if (positionOptions.length === 0) return base;
    return [...base, ...positionOptions];
  }, [draft.businessUnit, draft.department, positionOptions]);

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
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {/* Left — Personal Information */}
      <FormSection
        title="Personal Information"
        icon={<UserIcon className="h-4 w-4" />}
        className={cn(isPersonalEditing && "border-emerald-300 ring-1 ring-emerald-200")}
        headerRight={
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {isPersonalEditing && (
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 whitespace-nowrap">
                Editing
              </span>
            )}
            {isPersonalEditing ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline-emerald" size="sm" onClick={onSectionReset} disabled={!isDraftDirty}>Reset</Button>
                <Button variant="outline-emerald" size="sm" onClick={onSectionCancel}>Cancel</Button>
                <Button variant="outline-emerald" size="sm" onClick={() => onSectionSave("personal")}>Save</Button>
              </div>
            ) : canEdit && onSectionEdit && (
              <Button variant="default" size="sm" onClick={() => onSectionEdit("personal")} className="flex-shrink-0 gap-2 sm:h-9 sm:px-4 sm:text-sm">
                <IconPencilMinus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Edit
              </Button>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <EditableField
            label="Full Name" value={user.fullName} draftValue={draft.fullName}
            isEditing={isPersonalEditing}
            field={{ type: "text", fieldKey: "fullName" }}
            onChange={onDraftChange}
            error={fieldErrors.fullName}
            />
          <InfoField label="Employee ID" value={user.employeeCode} />
          <EditableField
            label="Phone Number" value={user.phone} draftValue={draft.phone}
            isEditing={isPersonalEditing}
            field={{ type: "tel", fieldKey: "phone" }}
            onChange={onDraftChange}
            error={fieldErrors.phone}
          />
          <EditableField
            label="Username" value={user.username} draftValue={draft.username}
            isEditing={isPersonalEditing}
            field={{ type: "text", fieldKey: "username" }}
            onChange={onDraftChange}
            error={fieldErrors.username}
            />
          <EditableField
            label="Email" value={user.email} draftValue={draft.email}
            isEditing={isPersonalEditing}
            field={{ type: "email", fieldKey: "email" }}
            onChange={onDraftChange}
            error={fieldErrors.email}
          />
          <EditableField
            label="Gender" value={user.gender} draftValue={draft.gender}
            isEditing={isPersonalEditing}
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
            isEditing={isPersonalEditing}
            field={{ type: "date", fieldKey: "dateOfBirth" }}
            onChange={onDraftChange}
            error={fieldErrors.dateOfBirth}
            />
          <EditableField
            label="Nationality" value={user.nationality} draftValue={draft.nationality}
            isEditing={isPersonalEditing}
            field={{ type: "text", fieldKey: "nationality" }}
            onChange={onDraftChange}
            error={fieldErrors.nationality}
            />
          <EditableField
            label="Language(s)" value={user.language} draftValue={draft.language}
            isEditing={isPersonalEditing}
            field={{ type: "select", fieldKey: "language", options: filteredLanguageOptions }}
            onChange={onDraftChange}
            error={fieldErrors.language}
            />
          <EditableField
            label="Personal ID / Passport No." value={user.idNumber} draftValue={draft.idNumber}
            isEditing={isPersonalEditing}
            field={{ type: "text", fieldKey: "idNumber" }}
            onChange={onDraftChange}
            error={fieldErrors.idNumber}
            />
          <EditableField
            label="Address" value={user.address} draftValue={draft.address}
            isEditing={isPersonalEditing}
            field={{ type: "text", fieldKey: "address" }}
            onChange={onDraftChange}
            className="col-span-2"
            error={fieldErrors.address}
            />
        </div>
      </FormSection>

      {/* Right — stacked: Work Profile + Account */}
      <div className="flex flex-col gap-5">
        {/* Work & Professional Profile */}
        <FormSection
          title="Work & Professional Profile"
          icon={<Briefcase className="h-4 w-4" />}
          className={cn(isWorkEditing && "border-emerald-300 ring-1 ring-emerald-200")}
          headerRight={
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {isWorkEditing && (
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 whitespace-nowrap">
                  Editing
                </span>
              )}
              {isWorkEditing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline-emerald" size="sm" onClick={onSectionReset} disabled={!isDraftDirty}>Reset</Button>
                  <Button variant="outline-emerald" size="sm" onClick={onSectionCancel}>Cancel</Button>
                  <Button variant="outline-emerald" size="sm" onClick={() => onSectionSave("work")}>Save</Button>
                </div>
              ) : canEdit && onSectionEdit && (
                <Button variant="default" size="sm" onClick={() => onSectionEdit("work")} className="flex-shrink-0 gap-2 sm:h-9 sm:px-4 sm:text-sm">
                  <IconPencilMinus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Edit
                </Button>
              )}
            </div>
          }
        >
          <div className="flex items-start justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{user.position || "—"}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {user.businessUnit}{user.department ? ` · ${user.department}` : ""}
              </p>
            </div>
            {yearsOfService && (
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                {yearsOfService}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <EditableField
              label="Business Unit" value={user.businessUnit} draftValue={draft.businessUnit}
              isEditing={isWorkEditing}
              field={{ type: "select", fieldKey: "businessUnit", options: businessUnitOptions }}
              onChange={onDraftChange}
              error={fieldErrors.businessUnit}
            />
            <EditableField
              label="Department" value={user.department} draftValue={draft.department}
              isEditing={isWorkEditing}
              field={{ type: "select", fieldKey: "department", options:
                draftDepartments.map((d) => ({ label: d, value: d })),
                disabled: !draft.businessUnit
              }}
              onChange={onDraftChange}
              error={fieldErrors.department}
            />
            <EditableField
              label="Position" value={user.position} draftValue={draft.position}
              isEditing={isWorkEditing}
              field={{
                type: "select",
                fieldKey: "position",
                options: filteredPositionOptions,
                disabled: !draft.businessUnit || !draft.department
              }}
              onChange={onDraftChange}
              className="col-span-2"
              error={fieldErrors.position}
            />
            <EditableField
              label="Employment Type" value={user.employmentType} draftValue={draft.employmentType}
              isEditing={isWorkEditing}
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
              label="Start Date"
              value={user.startDate ? formatDate(user.startDate) : null}
              draftValue={draft.startDate}
              isEditing={isWorkEditing}
              field={{ type: "date", fieldKey: "startDate" }}
              onChange={onDraftChange}
              error={fieldErrors.startDate}
            />
            <EditableField
              label="Direct Manager" value={user.managerName} draftValue={draft.managerName}
              isEditing={isWorkEditing}
              field={{ type: "select", fieldKey: "managerName", options: managerOptions }}
              onChange={onDraftChange}
              className="col-span-2"
              error={fieldErrors.managerName}
            />
          </div>
        </FormSection>

        {/* Account & Access Control */}
        <FormSection
          title="Account & Access Control"
          icon={<Shield className="h-4 w-4" />}
          className={cn(isAccountEditing && "border-emerald-300 ring-1 ring-emerald-200")}
          headerRight={
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {isAccountEditing && (
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 whitespace-nowrap">
                  Editing
                </span>
              )}
              {isAccountEditing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline-emerald" size="sm" onClick={onSectionReset} disabled={!isDraftDirty}>Reset</Button>
                  <Button variant="outline-emerald" size="sm" onClick={onSectionCancel}>Cancel</Button>
                  <Button variant="outline-emerald" size="sm" onClick={() => onSectionSave("account")}>Save</Button>
                </div>
              ) : null}
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <InfoField label="Account Status" value={user.status} />
            <InfoField label="Account Created" value={formatDate(user.createdDate)} />
            <InfoField label="Last Login" value={user.lastLogin !== "Never" ? user.lastLogin : "Never logged in"} className="col-span-2" />
          </div>
        </FormSection>
      </div>
    </div>
  );
};
