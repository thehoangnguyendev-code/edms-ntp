import React, { useEffect, useRef } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import type { SharingLevel, SharingNode, SharingNodeRef } from "@/services/api/knowledge";

export const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data?.error?.message ?? fallback;

/** What a level is called to the person who reads it. */
export const LEVEL_LABEL: Record<SharingLevel, string> = {
  ADMIN: "Administrator",
  UNIT_HEAD: "Head of Unit",
  DEPARTMENT_HEAD: "Department Head",
  DELEGATE: "Shares for the Head",
  NONE: "No access",
};

/** What the server needs to know about the item: the same four ids the folder or document was resolved to. */
export const refOf = (node: SharingNode): SharingNodeRef => ({
  kind: node.kind ?? "DOCUMENT",
  businessUnitId: node.kind === "BUSINESS_UNIT" ? node.businessUnitId : undefined,
  departmentId: node.kind === "BUSINESS_UNIT" ? undefined : node.departmentId,
  documentTypeId: node.documentTypeId,
  documentId: node.documentId,
});

/** The main action of a tab (Share, Make link, Add): the dialog shows it in its footer, outside the frame of the tabs, beside Close. */
export interface FooterAction {
  label: string;
  disabled: boolean;
  loading: boolean;
  destructive?: boolean;
  onClick: () => void;
}

/** The active tab hands its main action to the dialog; a tab that is not shown (kept mounted for its state) hands over nothing. */
export const useShareAction = (active: boolean, register: (action: FooterAction | null) => void, action: FooterAction) => {
  const click = useRef(action.onClick);
  click.current = action.onClick;
  const { label, disabled, loading, destructive } = action;
  useEffect(() => {
    if (active) register({ label, disabled, loading, destructive, onClick: () => click.current() });
  }, [active, register, label, disabled, loading, destructive]);
};

/** The mark on a person a Head named to share ("delegate"): so the Head sees at a glance who may share. */
export const CanShareBadge: React.FC<{ className?: string }> = ({ className }) => (
  <Badge color="emerald" size="xs" className={cn("gap-1", className)} title="A person a Head named: may share like the Head, but never excludes and never removes what a Head shared">
    <ShieldCheck className="h-3 w-3" />
    Can share
  </Badge>
);
