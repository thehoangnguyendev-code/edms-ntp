import React from "react";
import { Badge } from "@/components/ui/badge/Badge";
import type { RestoreRequestStatus } from "@/services/api/backupRestore";
import { statusLabel } from "../types";

const STATUS_COLOR: Record<RestoreRequestStatus, "amber" | "emerald" | "red"> = {
  PENDING_APPROVAL: "amber",
  APPROVED: "emerald",
  REJECTED: "red",
};

/** The one status badge of a restore request, used by the list and by the detail screen. */
export const RestoreStatusBadge: React.FC<{ status: RestoreRequestStatus }> = ({ status }) => (
  <Badge color={STATUS_COLOR[status]}>{statusLabel(status)}</Badge>
);
