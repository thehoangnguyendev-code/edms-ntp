import React from "react";
import { Info, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { FormSection } from "@/components/ui/form/FormSection";
import { Switch } from "@/components/ui/switch/Switch";
import { cn } from "@/components/ui/utils";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import type { AccessProfileDetailResponse } from "@/services/api/settings";
import { inputCls, textareaCls, scopeListToString, scopeStringToList } from "./accessProfileDetailShared";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import { useScopeOptions } from "@/features/security-authorization/access-profiles/shared/useScopeOptions";
import { IconCube } from "@tabler/icons-react";

export const GeneralTab: React.FC<{
  profile: AccessProfileDetailResponse;
  isEditing: boolean;
  draft: { name: string; description: string; businessUnitScope: string; departmentScope: string; active: boolean };
  onChange: (field: string, value: string | boolean) => void;
}> = ({ profile, isEditing, draft, onChange }) => {
  const { businessUnitOptions, departmentOptions, isLoading: scopeOptionsLoading } = useScopeOptions();
  return (
  <div className="space-y-4 max-w-2xl">
    <FormSection
      title="Basic Information"
      icon={<Info className="h-4 w-4" />}
      contentClassName="p-4 md:p-5 flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Name <span className="text-red-500">*</span>
          </label>
          {isEditing ? (
            <input
              className={inputCls}
              value={draft.name}
              onChange={e => onChange("name", e.target.value)}
              placeholder="e.g. Quality Assurance Manager"
            />
          ) : (
            <div className="h-9 w-full flex items-center rounded-lg border border-slate-200 bg-slate-50/70 px-3">
              <p className="text-sm font-medium text-slate-900 truncate">{profile.name || "—"}</p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Code (immutable)</label>
          <div className={cn("h-9 w-full flex items-center rounded-lg border border-slate-200 bg-slate-50/70 px-3", CONTROL_STATE_CLASSES.readonly)}>
            <p className="text-sm text-slate-500 truncate">{profile.code || "—"}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs sm:text-sm font-medium text-slate-700">Description</label>
        {isEditing ? (
          <textarea
            className={textareaCls}
            rows={3}
            value={draft.description}
            onChange={e => onChange("description", e.target.value)}
            placeholder="Brief description of this profile's purpose"
          />
        ) : (
          <div className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 min-h-[76px]">
            <p className="text-sm text-slate-700 whitespace-pre-line">
              {profile.description || "No description available."}
            </p>
          </div>
        )}
      </div>
    </FormSection>

    <FormSection
      title="Scope & Status"
      icon={<IconCube className="h-4 w-4" />}
      contentClassName="p-4 md:p-5 flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Type</label>
          <div className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 flex items-center">
            <Badge color={profile.type === "SYSTEM" ? "purple" : "slate"} size="sm">
              {profile.type === "SYSTEM" ? "System" : "Custom"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Business Unit Scope</label>
          {isEditing ? (
            <MultiSelect
              value={scopeStringToList(draft.businessUnitScope)}
              onChange={(values) => onChange("businessUnitScope", scopeListToString(values.map(String)) ?? "")}
              options={businessUnitOptions}
              placeholder="All Business Units"
              isLoading={scopeOptionsLoading}
            />
          ) : (
            <div className="h-9 w-full flex items-center rounded-lg border border-slate-200 bg-slate-50/70 px-3">
              <p className="text-sm text-slate-700 truncate">{profile.businessUnitScope || "All"}</p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Department Scope</label>
          {isEditing ? (
            <MultiSelect
              value={scopeStringToList(draft.departmentScope)}
              onChange={(values) => onChange("departmentScope", scopeListToString(values.map(String)) ?? "")}
              options={departmentOptions}
              placeholder="All Departments"
              isLoading={scopeOptionsLoading}
            />
          ) : (
            <div className="h-9 w-full flex items-center rounded-lg border border-slate-200 bg-slate-50/70 px-3">
              <p className="text-sm text-slate-700 truncate">{profile.departmentScope || "All"}</p>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-700">Status</p>
          <p className="text-xs text-slate-500 mt-0.5">Current availability of this access profile</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Switch
            checked={isEditing ? draft.active : profile.active}
            onChange={checked => isEditing && onChange("active", checked)}
            disabled={!isEditing}
            size="sm"
          />
          <Badge size="xs" color={(isEditing ? draft.active : profile.active) ? "emerald" : "slate"}>
            {(isEditing ? draft.active : profile.active) ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>
    </FormSection>
  </div>
  );
};

export const NewProfileForm: React.FC<{
  draft: { name: string; description: string; businessUnitScope: string; departmentScope: string; active: boolean };
  onChange: (field: string, value: string | boolean) => void;
}> = ({ draft, onChange }) => {
  const { businessUnitOptions, departmentOptions, isLoading: scopeOptionsLoading } = useScopeOptions();
  return (
  <div className="space-y-4 max-w-2xl">
    <FormSection
      title="Basic Information"
      icon={<Info className="h-4 w-4" />}
      description="Name and description for the new access profile"
      contentClassName="p-4 md:p-5 flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-xs sm:text-sm font-medium text-slate-700">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          className={inputCls}
          value={draft.name}
          onChange={e => onChange("name", e.target.value)}
          placeholder="e.g. Quality Assurance Manager"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs sm:text-sm font-medium text-slate-700">Description</label>
        <textarea
          className={textareaCls}
          rows={3}
          value={draft.description}
          onChange={e => onChange("description", e.target.value)}
          placeholder="Brief description of this profile's purpose"
        />
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3 text-xs text-slate-600">
        <span className="font-semibold text-slate-700">Code</span> will be generated after the first save and remains read-only afterward.
      </div>
    </FormSection>

    <FormSection
      title="Scope & Status"
      icon={<ShieldCheck className="h-4 w-4" />}
      description="Organizational scope and active state"
      contentClassName="p-4 md:p-5 flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Business Unit Scope</label>
          <MultiSelect
            value={scopeStringToList(draft.businessUnitScope)}
            onChange={(values) => onChange("businessUnitScope", scopeListToString(values.map(String)) ?? "")}
            options={businessUnitOptions}
            placeholder="All Business Units"
            isLoading={scopeOptionsLoading}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Department Scope</label>
          <MultiSelect
            value={scopeStringToList(draft.departmentScope)}
            onChange={(values) => onChange("departmentScope", scopeListToString(values.map(String)) ?? "")}
            options={departmentOptions}
            placeholder="All Departments"
            isLoading={scopeOptionsLoading}
          />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-700">Active on creation</p>
          <p className="text-xs text-slate-500 mt-0.5">Profile will be immediately available if enabled</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Switch checked={draft.active} onChange={checked => onChange("active", checked)} size="sm" />
          <Badge size="xs" color={draft.active ? "emerald" : "slate"}>
            {draft.active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>
    </FormSection>
  </div>
  );
};
