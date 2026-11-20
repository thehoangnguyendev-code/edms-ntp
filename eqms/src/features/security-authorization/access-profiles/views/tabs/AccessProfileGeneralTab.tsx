import React from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { flagColor } from "@/utils/status";
import { Switch } from "@/components/ui/switch/Switch";
import { cn } from "@/components/ui/utils";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import type { AccessProfileDetailResponse } from "@/services/api/settings";
import { formatDateTime } from "@/utils/format";
import { inputCls, textareaCls } from "./accessProfileDetailShared";

const labelCls = "text-xs sm:text-sm font-medium text-slate-700";
const readCls = "flex h-9 w-full items-center rounded-lg border border-slate-200 bg-slate-50/70 px-3";

const Field: React.FC<{ label: React.ReactNode; className?: string; children: React.ReactNode }> = ({ label, className, children }) => (
  <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
    <label className={labelCls}>{label}</label>
    {children}
  </div>
);

export const GeneralTab: React.FC<{
  profile: AccessProfileDetailResponse;
  isEditing: boolean;
  draft: { name: string; description: string; active: boolean };
  onChange: (field: string, value: string | boolean) => void;
  /** Red hint under the name, shown after a Save that found the name empty. */
  nameError?: string;
}> = ({ profile, isEditing, draft, onChange, nameError }) => {
  const active = isEditing ? draft.active : profile.active;
  return (
    <div className="grid grid-cols-1 gap-3 md:gap-4 md:grid-cols-2">
      <Field label="Created By">
        <div className={cn(readCls, CONTROL_STATE_CLASSES.readonly)}>
          <p className="truncate text-sm text-slate-600">{profile.createdBy || "—"}</p>
        </div>
      </Field>
      <Field label="Created Time">
        <div className={cn(readCls, CONTROL_STATE_CLASSES.readonly)}>
          <p className="truncate text-sm text-slate-600">{profile.createdAt ? formatDateTime(profile.createdAt) : "—"}</p>
        </div>
      </Field>

      <Field label={<>Profile Name <span className="text-red-500">*</span></>}>
        {isEditing ? (
          <>
            <input
              id="profile-field-name"
              className={cn(inputCls, nameError && "border-red-500 focus:border-red-500 focus:ring-red-500")}
              value={draft.name}
              onChange={e => onChange("name", e.target.value)}
              placeholder="e.g. Quality Assurance Manager"
              aria-invalid={Boolean(nameError)}
            />
            {nameError && <p role="alert" className="mt-1.5 text-xs text-red-600">{nameError}</p>}
          </>
        ) : (
          <div className={readCls}>
            <p className="truncate text-sm font-medium text-slate-900">{profile.name || "—"}</p>
          </div>
        )}
      </Field>
      <Field label="Code (Immutable)">
        <div className={cn(readCls, CONTROL_STATE_CLASSES.readonly)}>
          <p className="truncate text-sm text-slate-500">{profile.code || "—"}</p>
        </div>
      </Field>

      <Field label="Type">
        <div className="flex h-9 items-center">
          <Badge color={profile.type === "SYSTEM" ? "blue" : "teal"} size="sm">
            {profile.type === "SYSTEM" ? "System" : "Custom"}
          </Badge>
        </div>
      </Field>
      <Field label="Status">
        <div className="flex h-9 items-center gap-2.5">
          <Switch
            checked={active}
            onChange={checked => isEditing && onChange("active", checked)}
            disabled={!isEditing}
            size="sm"
          />
          <Badge size="sm" color={flagColor(active)}>{active ? "Active" : "Inactive"}</Badge>
        </div>
      </Field>

      <Field label="Description" className="md:col-span-2">
        {isEditing ? (
          <textarea
            className={textareaCls}
            rows={3}
            value={draft.description}
            onChange={e => onChange("description", e.target.value)}
            placeholder="Brief description of this profile's purpose"
          />
        ) : (
          <div className="min-h-[76px] w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
            <p className="whitespace-pre-line text-sm text-slate-700">
              {profile.description || "No description available."}
            </p>
          </div>
        )}
      </Field>
    </div>
  );
};
