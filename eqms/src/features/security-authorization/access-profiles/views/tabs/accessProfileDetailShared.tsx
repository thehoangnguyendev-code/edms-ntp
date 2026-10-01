import { Drawer, type DrawerHandle } from "@/components/ui/drawer";
import React, { useRef } from "react";
import { Check, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";

export const labelCls =
  "mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm";
export const inputCls =
  "h-9 w-full rounded-lg border border-slate-200 px-3 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
export const textareaCls =
  "w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

export const parseScopeCount = (scope?: string | null) => {
  if (!scope || scope.trim().toLowerCase() === "all") return 0;
  return scope
    .split(/[,\n;|]/)
    .map((value) => value.trim())
    .filter(Boolean).length;
};

export const scopeStringToList = (scope?: string | null): string[] => {
  if (!scope || scope.trim().toLowerCase() === "all") return [];
  return scope
    .split(/[,\n;|]/)
    .map((value) => value.trim())
    .filter(Boolean);
};

export const scopeListToString = (values: string[]): string | null =>
  values.length ? values.join(", ") : null;

export interface WorkflowRolePreview {
  code: string;
  label: string;
  description?: string | null;
  policies: Array<{
    actionCode: string;
    actionLabel: string;
    fromStatus: string;
    active: boolean;
  }>;
}

/** Uses the same portal, responsive drawer shell and animation contract as Shared Permission Sets. */
export const WorkflowRoleDrawer: React.FC<{
  role: WorkflowRolePreview | null;
  onClose: () => void;
}> = ({ role, onClose }) => {
  const drawer = React.useRef<DrawerHandle>(null);
  const closeWithAnimation = () => drawer.current?.close();


  if (!role) return null;
  const policies = role.policies.filter((policy) => policy.active);
  const stages = [
    ...new Set(policies.map((policy) => policy.fromStatus.replace(/_/g, " "))),
  ];


  return <Drawer
    ref={drawer}
    onClose={onClose}
    title={role.label}
    subtitle="Workflow Role"
    icon={<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50"><Workflow className="h-4 w-4 text-emerald-600" /></span>}
    headerActions={<Badge color="slate" size="sm">{role.code}</Badge>}
    description={role.description || "No description has been configured for this workflow role."}
    bodyClassName="space-y-4"
    footer={<>
      <Button
        variant="outline-emerald"
        size="sm"
        className="w-fit"
        onClick={closeWithAnimation}
      >
        Close
      </Button>
    </>}
  >

    <RoleDetailSection title="Workflow Stages">
      {stages.length ? (
        <div className="flex flex-wrap gap-1.5">
          {stages.map((stage) => (
            <Badge key={stage} size="sm" color="emerald">
              {stage}
            </Badge>
          ))}
        </div>
      ) : (
        <EmptyRoleDetail text="No active workflow policy references this workflow capacity." />
      )}
    </RoleDetailSection>
    <RoleDetailSection title="Available Actions">
      {policies.length ? (
        <div className="space-y-2">
          {policies.map((policy) => (
            <div
              key={`${policy.actionCode}-${policy.fromStatus}`}
              className="flex items-center gap-2"
            >
              <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="text-sm text-slate-700">
                {policy.actionLabel ||
                  policy.actionCode.replace(/_/g, " ")}
              </span>
              <Badge size="sm" color="slate">
                {policy.fromStatus.replace(/_/g, " ")}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <EmptyRoleDetail text="No active workflow policy references this workflow capacity." />
      )}
    </RoleDetailSection>

  </Drawer>;
};

const RoleDetailSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
      {title}
    </div>
    <div className="p-4">{children}</div>
  </div>
);
const EmptyRoleDetail: React.FC<{ text: string }> = ({ text }) => (
  <p className="text-sm italic text-slate-400">{text}</p>
);
