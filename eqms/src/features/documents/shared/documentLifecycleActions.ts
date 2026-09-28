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
