import React from "react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import {
  FileSignature,
  Mail,
  Archive,
  AlertTriangle,
  MoreVertical
} from "lucide-react";
import { IconInfoCircle, IconFileDownload, IconHistory, IconMatrix } from "@tabler/icons-react";
import { cn } from "@/components/ui/utils";
import { ROUTES } from "@/app/routes.constants";
import type { EmployeeTrainingFile } from "@/features/training/types";
import type { PortalDropdownPosition } from "@/hooks";

interface EmployeeDropdownMenuProps {
  employee: EmployeeTrainingFile;
  isOpen: boolean;
  onClose: () => void;
  position: PortalDropdownPosition;
  onNavigate: (path: string) => void;
  onOpenPendingSignatures: (employee: EmployeeTrainingFile) => void;
  onOpenHistory: (employee: EmployeeTrainingFile) => void;
  pendingSignaturesCount: number;
}

export const EmployeeDropdownMenu: React.FC<EmployeeDropdownMenuProps> = ({
  employee,
  isOpen,
  onClose,
  position,
  onNavigate,
  onOpenPendingSignatures,
  onOpenHistory,
  pendingSignaturesCount,
}) => {
  if (!isOpen) return null;

  const menuItems = [
    {
      icon: IconMatrix,
      label: "Go to Matrix for Gaps",
      onClick: () => {
        onNavigate(`${ROUTES.TRAINING.TRAINING_MATRIX}?search=${encodeURIComponent(employee.employeeName)}`);
        onClose();
      },
      color: "text-slate-500"
    },
    ...(employee.coursesObsolete > 0 ? [{
      icon: AlertTriangle,
      label: "View Obsolete Details",
      onClick: () => {
        console.log("View obsolete details for:", employee.id);
        onClose();
      },
      color: "text-slate-500"
    }] : []),
    {
      icon: FileSignature,
      label: "Pending Signatures",
      badge: pendingSignaturesCount > 0 ? pendingSignaturesCount : null,
      onClick: () => {
        onOpenPendingSignatures(employee);
        onClose();
      },
      color: "text-slate-500"
    },
    {
      icon: IconInfoCircle,
      label: "View Dossier",
      onClick: () => {
        onNavigate(ROUTES.TRAINING.EMPLOYEE_DOSSIER(employee.id));
        onClose();
      },
      color: "text-slate-500"
    },
    {
      icon: IconHistory,
      label: "Version History",
      onClick: () => {
        onOpenHistory(employee);
        onClose();
      },
      color: "text-slate-500 font-bold"
    },
    {
      icon: IconFileDownload,
      label: "Export Training Dossier",
      onClick: () => {
        console.log("Export dossier for:", employee.id);
        onClose();
      },
      color: "text-slate-500"
    },
    {
      icon: Mail,
      label: "Send Reminder",
      onClick: () => {
        console.log("Send reminder to:", employee.id);
        onClose();
      },
      color: "text-slate-500"
    },
    {
      icon: Archive,
      label: "Archive Record",
      onClick: () => {
        console.log("Archive:", employee.id);
        onClose();
      },
      color: "text-slate-500 hover:text-red-600 hover:bg-red-50"
    },
  ];

  return (
    <PortalDropdownMenu isOpen={isOpen} onClose={onClose} position={position} minWidth={220}>
      <div className="py-1">
        {menuItems.map((item, i) => {
          const mi = item as any;
          const Icon = mi.icon;
          return (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                mi.onClick();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-slate-50 active:bg-slate-100",
                mi.color
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="font-medium flex-1 text-left">{mi.label}</span>
              {mi.badge != null && (
                <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-2xs font-bold text-white">
                  {mi.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </PortalDropdownMenu>
  );
};
