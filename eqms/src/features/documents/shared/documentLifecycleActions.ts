import type { DocumentStatus } from "@/features/documents/types";

const normalizeStatus = (status?: string | null) =>
  String(status || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

const IN_PROGRESS_REVISION_STATUSES = new Set([
  "DRAFT",
  "PENDING_REVIEW",
  "PENDING_APPROVAL",
  "PENDING_TRAINING",
  "READY_FOR_PUBLISHING",
]);

type RevisionLikeStatus = {
  status?: string | null;
  statusInfo?: {
    id?: string | null;
    name?: string | null;
    code?: string | null;
    label?: string | null;
  } | null;
};

export const REVISION_CANCELABLE_STATUSES: DocumentStatus[] = [
  "Draft",
  "Pending Review",
  "Pending Approval",
  "Pending Training",
  "Ready for Publishing",
];

export const canCancelRevisionStatus = (status?: string | null) => {
  const normalized = normalizeStatus(status);
  return REVISION_CANCELABLE_STATUSES.some((allowed) => normalizeStatus(allowed) === normalized);
};

export const canObsoleteDocumentStatus = (status?: string | null) => normalizeStatus(status) === "ACTIVE";

export const hasEffectiveRevision = (revisions?: readonly RevisionLikeStatus[] | null) =>
  (revisions ?? []).some((revision) => {
    const normalized = normalizeStatus(
      revision?.statusInfo?.code ||
        revision?.statusInfo?.id ||
        revision?.statusInfo?.name ||
        revision?.statusInfo?.label ||
        revision?.status,
    );
    return normalized === "EFFECTIVE";
  });

export const hasOpenRevisionInProgress = (revisions?: readonly RevisionLikeStatus[] | null) =>
  (revisions ?? []).some((revision) => {
    const normalized = normalizeStatus(
      revision?.statusInfo?.code ||
        revision?.statusInfo?.id ||
        revision?.statusInfo?.name ||
        revision?.statusInfo?.label ||
        revision?.status,
    );
    return IN_PROGRESS_REVISION_STATUSES.has(normalized);
  });

export const canObsoleteDocumentWithRevisionHistory = (
  status?: string | null,
  revisions?: readonly RevisionLikeStatus[] | null,
) => canObsoleteDocumentStatus(status) && hasEffectiveRevision(revisions) && !hasOpenRevisionInProgress(revisions);
