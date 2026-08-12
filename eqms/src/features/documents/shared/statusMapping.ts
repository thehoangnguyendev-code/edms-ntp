import type { StatusType } from "@/components/ui";
import type { DocumentStatus } from "@/types/document";

export interface StatusInfoLike {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  label?: string | null;
}

export interface WorkflowTransitionLike {
  actionType?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  changes?: {
    field?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
  }[] | null;
}

export const REVISION_WORKFLOW_STEPS: DocumentStatus[] = [
  "Draft",
  "Pending Review",
  "Pending Approval",
  "Pending Training",
  "Ready for Publishing",
  "Effective",
  "Obsoleted",
  "Closed - Cancelled",
];

export const DOCUMENT_WORKFLOW_STEPS: DocumentStatus[] = [
  "Draft",
  "Active",
  "Obsoleted",
  "Closed - Cancelled",
];

const REVISION_CODE_TO_LABEL: Record<string, DocumentStatus> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending Review",
  PENDING_APPROVAL: "Pending Approval",
  PENDING_TRAINING: "Pending Training",
  READY_FOR_PUBLISHING: "Ready for Publishing",
  EFFECTIVE: "Effective",
  PUBLISHED: "Effective",
  ACTIVE: "Effective",
  OBSOLETE: "Obsoleted",
  OBSOLETED: "Obsoleted",
  CLOSED_CANCELLED: "Closed - Cancelled",
  CANCELLED: "Closed - Cancelled",
  REJECTED: "Closed - Cancelled",
};

const DOCUMENT_CODE_TO_LABEL: Record<string, DocumentStatus> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  EFFECTIVE: "Active",
  OBSOLETE: "Obsoleted",
  OBSOLETED: "Obsoleted",
  CLOSED_CANCELLED: "Closed - Cancelled",
  CANCELLED: "Closed - Cancelled",
};

const LABEL_TO_BADGE: Record<string, StatusType> = {
  Draft: "draft",
  "Pending Review": "pendingReview",
  "Pending Approval": "pendingApproval",
  Approved: "approved",
  Rejected: "rejected",
  "Pending Training": "pendingTraining",
  "Ready for Publishing": "readyForPublishing",
  Published: "published",
  Effective: "effective",
  Active: "active",
  Obsoleted: "obsolete",
  Obsolete: "obsolete",
  "Closed - Cancelled": "cancelled",
};

export function resolveStatusCode(
  status?: string | null,
  statusInfo?: StatusInfoLike | null,
): string {
  return String(statusInfo?.id || statusInfo?.code || statusCodeFromLabel(status) || status || "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");
}

export function resolveStatusLabel(
  status?: string | null,
  statusInfo?: StatusInfoLike | null,
): string {
  const fromInfo = normalizeLegacyStatusLabel(String(statusInfo?.name || statusInfo?.label || "").trim());
  if (fromInfo) return fromInfo;

  const raw = String(status || "").trim();
  if (!raw) return "";

  const normalizedCode = raw.toUpperCase().replace(/[-\s]+/g, "_");
  if (REVISION_CODE_TO_LABEL[normalizedCode]) {
    return REVISION_CODE_TO_LABEL[normalizedCode];
  }
  if (DOCUMENT_CODE_TO_LABEL[normalizedCode]) {
    return DOCUMENT_CODE_TO_LABEL[normalizedCode];
  }

  return raw;
}

function normalizeLegacyStatusLabel(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.toLowerCase() === "obsolete") return "Obsoleted";
  if (normalized.toLowerCase() === "closed - cancelled") return "Closed - Cancelled";
  return normalized;
}

function statusCodeFromLabel(status?: string | null): string | null {
  const raw = String(status || "").trim();
  if (!raw) return null;

  const normalized = raw.toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "draft") return "DRAFT";
  if (normalized === "pendingreview") return "PENDING_REVIEW";
  if (normalized === "pendingapproval") return "PENDING_APPROVAL";
  if (normalized === "pendingtraining") return "PENDING_TRAINING";
  if (normalized === "readyforpublishing") return "READY_FOR_PUBLISHING";
  if (normalized === "effective" || normalized === "published") return "EFFECTIVE";
  if (normalized === "active") return "ACTIVE";
  if (normalized === "obsolete" || normalized === "obsoleted") return "OBSOLETED";
  if (normalized === "closedcancelled" || normalized === "cancelled" || normalized === "rejected") {
    return "CLOSED_CANCELLED";
  }

  return null;
}

function normalizeByCodeOrLabel(
  codeMap: Record<string, DocumentStatus>,
  status?: string | null,
  statusInfo?: StatusInfoLike | null,
): DocumentStatus {
  const code = resolveStatusCode(status, statusInfo);
  if (code && codeMap[code]) {
    return codeMap[code];
  }

  const label = resolveStatusLabel(status, statusInfo);
  const normalized = label.toLowerCase().replace(/[\s_-]+/g, "");

  if (normalized.includes("pendingreview")) return "Pending Review";
  if (normalized.includes("pendingapproval")) return "Pending Approval";
  if (normalized.includes("pendingtraining")) return "Pending Training";
  if (normalized.includes("readyforpublishing")) return "Ready for Publishing";
  if (normalized === "effective" || normalized === "published") return "Effective";
  if (normalized === "active") return codeMap === DOCUMENT_CODE_TO_LABEL ? "Active" : "Effective";
  if (normalized.includes("obsolete")) return "Obsoleted";
  if (normalized.includes("cancel") || normalized.includes("closed") || normalized.includes("reject")) {
    return "Closed - Cancelled";
  }
  if (normalized.includes("draft")) return "Draft";

  if (REVISION_WORKFLOW_STEPS.includes(label as DocumentStatus)) {
    return label as DocumentStatus;
  }
  if (DOCUMENT_WORKFLOW_STEPS.includes(label as DocumentStatus)) {
    return label as DocumentStatus;
  }

  return "Draft";
}

export function normalizeRevisionStatusForStepper(
  status?: string | null,
  statusInfo?: StatusInfoLike | null,
): DocumentStatus {
  return normalizeByCodeOrLabel(REVISION_CODE_TO_LABEL, status, statusInfo);
}

export function normalizeDocumentStatusForStepper(
  status?: string | null,
  statusInfo?: StatusInfoLike | null,
): DocumentStatus {
  const normalized = normalizeByCodeOrLabel(DOCUMENT_CODE_TO_LABEL, status, statusInfo);
  return normalized === "Effective" ? "Active" : normalized;
}

export function toRevisionBadgeStatus(
  status?: string | null,
  statusInfo?: StatusInfoLike | null,
): StatusType {
  const label = normalizeRevisionStatusForStepper(status, statusInfo);
  return LABEL_TO_BADGE[label] || "draft";
}

export function toDocumentBadgeStatus(
  status?: string | null,
  statusInfo?: StatusInfoLike | null,
): StatusType {
  const label = normalizeDocumentStatusForStepper(status, statusInfo);
  return LABEL_TO_BADGE[label] || "draft";
}

export function revisionWorkflowStepIndex(
  status?: string | null,
  statusInfo?: StatusInfoLike | null,
): number {
  const current = normalizeRevisionStatusForStepper(status, statusInfo);
  const index = REVISION_WORKFLOW_STEPS.indexOf(current);
  return index !== -1 ? index : 0;
}

export function documentWorkflowStepIndex(
  status?: string | null,
  statusInfo?: StatusInfoLike | null,
): number {
  const current = normalizeDocumentStatusForStepper(status, statusInfo);
  const index = DOCUMENT_WORKFLOW_STEPS.indexOf(current);
  return index !== -1 ? index : DOCUMENT_WORKFLOW_STEPS.indexOf("Active");
}

export function isTerminalWorkflowStatus(
  status?: string | null,
  statusInfo?: StatusInfoLike | null,
): boolean {
  const label = resolveStatusLabel(status, statusInfo).toLowerCase();
  return label === "obsoleted" || label === "obsolete" || label === "closed - cancelled" || label === "closed-cancelled" || label === "cancelled";
}

const normalizeWorkflowActionType = (actionType?: string | null) =>
  String(actionType || "")
    .replace(/[_\s-]+/g, "")
    .trim()
    .toUpperCase();

const extractStatusFromTransition = (transition?: WorkflowTransitionLike | null) => {
  if (!transition) {
    return "";
  }
  const fromStatus = String(transition.fromStatus || "").trim();
  if (fromStatus) {
    return fromStatus;
  }
  const statusChange = (transition.changes || []).find((change) =>
    String(change.field || "").trim().toLowerCase() === "status",
  );
  return String(statusChange?.oldValue || "").trim();
};

export function resolveTerminalProgressStep(
  status?: string | null,
  transitions?: WorkflowTransitionLike[] | null,
): string {
  if (!isTerminalWorkflowStatus(status)) {
    return "";
  }

  const terminalTransition = [...(transitions || [])]
    .reverse()
    .find((transition) => {
      const actionType = normalizeWorkflowActionType(transition?.actionType);
      const toStatus = String(transition?.toStatus || "")
        .trim()
        .toUpperCase()
        .replace(/[-\s]+/g, "_");
      const matchesTerminalTransition =
        actionType.includes("CANCEL") ||
        actionType.includes("OBSOLETE") ||
        toStatus === "CLOSED_CANCELLED" ||
        toStatus === "OBSOLETED";
      if (!matchesTerminalTransition) {
        return false;
      }
      // A row with the terminal toStatus but no fromStatus/status-change isn't the actual
      // transition into that terminal state — it's a side-effect log (e.g. evidence uploaded
      // in the same operation) that happens to carry a toStatus snapshot. Skip it so the real
      // transition record (which does carry fromStatus) is the one used to resolve progress.
      return Boolean(extractStatusFromTransition(transition));
    });

  return extractStatusFromTransition(terminalTransition);
}

/**
 * Determines which revision workflow steps were not actually visited.
 *
 * A workflow can legitimately bypass a stage (for example Pending Training
 * when training is not required), or be cancelled from an earlier stage. The
 * stepper must not portray those stages as completed merely because they are
 * positioned before a terminal state such as Obsoleted or Closed - Cancelled.
 */
export function resolveRevisionSkippedSteps(
  status?: string | null,
  transitions?: WorkflowTransitionLike[] | null,
  requiresTraining?: boolean | null,
): DocumentStatus[] {
  const skipped = new Set<DocumentStatus>();
  const history = transitions ?? [];

  if (requiresTraining === false) {
    skipped.add("Pending Training");
  }

  // Older records may not have workflow history. Retain the explicit training
  // rule in that case rather than inferring unvisited stages without evidence.
  if (history.length === 0) {
    return [...skipped];
  }

  const visited = new Set<DocumentStatus>(["Draft"]);
  for (const transition of history) {
    const from = normalizeRevisionStatusForStepper(transition.fromStatus);
    const to = normalizeRevisionStatusForStepper(transition.toStatus);
    if (REVISION_WORKFLOW_STEPS.includes(from)) visited.add(from);
    if (REVISION_WORKFLOW_STEPS.includes(to)) visited.add(to);
  }

  const current = normalizeRevisionStatusForStepper(status);
  if (REVISION_WORKFLOW_STEPS.includes(current)) visited.add(current);

  const terminalProgress = resolveTerminalProgressStep(status, history);
  const progressLabel = isTerminalWorkflowStatus(status) && terminalProgress
    ? normalizeRevisionStatusForStepper(terminalProgress)
    : current;
  const progressIndex = REVISION_WORKFLOW_STEPS.indexOf(progressLabel);

  // Only classify stages up to the actual point of progress. Steps between a
  // terminal transition and the terminal display state are rendered as gaps by
  // WorkflowStepper itself.
  if (progressIndex >= 0) {
    REVISION_WORKFLOW_STEPS.slice(0, progressIndex + 1).forEach((step) => {
      if (!visited.has(step)) skipped.add(step);
    });
  }

  skipped.delete(current);
  return [...skipped];
}

export interface RevisionSummaryLike {
  id: string;
  revisionNumber: string;
  created: string;
  openedBy: string;
  revisionName: string;
  status?: string | null;
  state?: string | null;
  statusCode?: string | null;
  statusInfo?: StatusInfoLike | null;
  canOpenAuthoringWorkspace?: boolean;
}

export function mapRevisionSummaryFromApi<T extends RevisionSummaryLike>(revision: T) {
  const statusLabel = resolveStatusLabel(revision.status || revision.state, revision.statusInfo);
  const statusCode = resolveStatusCode(revision.statusCode || revision.status || revision.state, revision.statusInfo);

  return {
    ...revision,
    status: toRevisionBadgeStatus(statusLabel, { id: statusCode, name: statusLabel }),
    statusLabel: normalizeRevisionStatusForStepper(statusLabel, { id: statusCode, name: statusLabel }),
    statusCode,
  };
}
