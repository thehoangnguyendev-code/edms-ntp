import type { StatusType } from "@/components/ui";

export interface StatusInfoLike {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  label?: string | null;
}

/** Colour of the badge for a status, by its machine code. The status list itself comes from the server. */
const CODE_TO_BADGE: Record<string, StatusType> = {
  DRAFT: "draft",
  PENDING_REVIEW: "pendingReview",
  PENDING_APPROVAL: "pendingApproval",
  PENDING_TRAINING: "pendingTraining",
  READY_FOR_PUBLISHING: "readyForPublishing",
  EFFECTIVE: "effective",
  ACTIVE: "active",
  OBSOLETED: "obsolete",
  CLOSED_CANCELLED: "cancelled",
};

/** Machine code of a status: the server's code when it sent one, otherwise the stored value written as a code. */
export function resolveStatusCode(
  status?: string | null,
  statusInfo?: StatusInfoLike | null,
): string {
  return String(statusInfo?.id || statusInfo?.code || status || "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");
}

/** Label of a status as the server names it. */
export function resolveStatusLabel(
  status?: string | null,
  statusInfo?: StatusInfoLike | null,
): string {
  return String(statusInfo?.name || statusInfo?.label || status || "").trim();
}

export function toStatusBadge(
  status?: string | null,
  statusInfo?: StatusInfoLike | null,
): StatusType {
  return CODE_TO_BADGE[resolveStatusCode(status, statusInfo)] || "draft";
}

export interface RevisionSummaryLike {
  id: string;
  revisionNumber: string;
  created: string;
  openedBy: string;
  revisionName: string;
  status?: string | null;
  statusCode?: string | null;
  statusInfo?: StatusInfoLike | null;
  canOpenAuthoringWorkspace?: boolean;
}

export function mapRevisionSummaryFromApi<T extends RevisionSummaryLike>(revision: T) {
  const statusCode = resolveStatusCode(revision.statusCode || revision.status, revision.statusInfo);

  // Three different things, each under its own name: the code (what logic decides on), the label (what people read), the badge key (the colour).
  // `status` is left exactly as the server sent it; it used to be overwritten with the badge key, so it meant three things in the screens.
  return {
    ...revision,
    statusBadge: toStatusBadge(statusCode),
    statusLabel: resolveStatusLabel(revision.status, revision.statusInfo),
    statusCode,
  };
}
