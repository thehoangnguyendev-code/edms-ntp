type ControlledCopyStatusInfo = {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  label?: string | null;
};

type ControlledCopyRelation = {
  id?: string | null;
  documentNumber?: string | null;
  documentName?: string | null;
  created?: string | null;
  openedBy?: string | null;
  status?: string | null;
  statusInfo?: ControlledCopyStatusInfo | null;
  type?: string | null;
  revisionNumber?: string | null;
  department?: string | null;
  author?: string | null;
  effectiveDate?: string | null;
  validUntil?: string | null;
  reviewDate?: string | null;
};

type ControlledCopyRequestDocumentListItem = {
  id?: string | null;
  documentNumber?: string | null;
  documentName?: string | null;
  revisionNumber?: string | null;
  currentEffectiveRevisionNumber?: string | null;
  currentEffectiveRevisionId?: string | null;
  hasEffectiveRevision?: boolean;
  status?: string | null;
  statusInfo?: ControlledCopyStatusInfo | null;
  type?: string | null;
  businessUnit?: string | null;
  effectiveDate?: string | null;
  validUntil?: string | null;
};

type ControlledCopyRequestRevisionLike = {
  id?: string | null;
  documentId?: string | null;
  documentNumber?: string | null;
  documentName?: string | null;
  revisionNumber?: string | null;
  revisionName?: string | null;
  status?: string | null;
  statusInfo?: ControlledCopyStatusInfo | null;
  type?: string | null;
  businessUnit?: string | null;
  effectiveDate?: string | null;
  validUntil?: string | null;
  originalDocument?: {
    id?: string | null;
    status?: string | null;
    statusInfo?: ControlledCopyStatusInfo | null;
  } | null;
};

type ControlledCopyRequestNavigationState = {
  documentId: string;
  documentNumber?: string;
  documentTitle: string;
  documentVersion: string;
  revisionId: string;
  sourceRevisionId?: string;
  documentName?: string;
  documentType?: string;
  businessUnit?: string;
  effectiveDate?: string;
  validUntil?: string;
  status?: string;
  revisionName?: string;
};

export type ControlledCopyRequestRouteState = ControlledCopyRequestNavigationState & {
  from?: string;
  returnTo?: string;
  workspaceReturnPath?: string;
  preloadedRevisionDetail?: ControlledCopyRequestRevisionLike | null;
};

const normalizeStatus = (value?: string | null, info?: ControlledCopyStatusInfo | null) =>
  String(value || info?.code || info?.label || info?.name || "").trim().toLowerCase();

export const isActiveDocumentMaster = (
  status?: string | null,
  statusInfo?: ControlledCopyStatusInfo | null,
) => normalizeStatus(status, statusInfo) === "active";

export const isDraftDocumentMaster = (
  status?: string | null,
  statusInfo?: ControlledCopyStatusInfo | null,
) => normalizeStatus(status, statusInfo) === "draft";

export const isEffectiveRevision = (
  status?: string | null,
  statusInfo?: ControlledCopyStatusInfo | null,
) => normalizeStatus(status, statusInfo) === "effective";

export const findLatestEffectiveRevision = <
  T extends {
    status?: string | null;
    statusLabel?: string | null;
    statusInfo?: ControlledCopyStatusInfo | null;
  },
>(
  revisions?: T[] | null,
) =>
  (revisions ?? []).find((revision) =>
    normalizeStatus(revision?.status || revision?.statusLabel, revision?.statusInfo) === "effective",
  ) ?? null;

export const canRequestControlledCopyFromDocument = (
  document?: ControlledCopyRequestDocumentListItem | null,
) => Boolean(
  document &&
    isActiveDocumentMaster(document.status, document.statusInfo) &&
    Boolean(document.currentEffectiveRevisionId || document.hasEffectiveRevision),
);

export const canRequestControlledCopyFromDocumentDetail = (
  document?: { status?: string | null; statusInfo?: ControlledCopyStatusInfo | null } | null,
  latestEffectiveRevision?: { id?: string | null } | null,
) => Boolean(
  document &&
    isActiveDocumentMaster(document.status, document.statusInfo) &&
    Boolean(latestEffectiveRevision?.id),
);

export const canRequestControlledCopyFromRevision = (
  revision?: ControlledCopyRequestRevisionLike | null,
) => Boolean(
  revision &&
    isEffectiveRevision(revision.status, revision.statusInfo) &&
    isActiveDocumentMaster(revision.originalDocument?.status, revision.originalDocument?.statusInfo),
);

export const buildControlledCopyRequestStateFromDocument = (
  document: ControlledCopyRequestDocumentListItem,
): ControlledCopyRequestNavigationState => ({
  documentId: document.id || document.documentNumber || "",
  documentNumber: document.documentNumber || "",
  documentTitle: document.documentName || "",
  documentVersion: document.currentEffectiveRevisionNumber || document.revisionNumber || "",
  revisionId: document.currentEffectiveRevisionId || "",
  sourceRevisionId: document.currentEffectiveRevisionId || "",
  documentName: document.documentName || "",
  documentType: document.type || "",
  businessUnit: document.businessUnit || "",
  effectiveDate: document.effectiveDate || "",
  validUntil: document.validUntil || "",
  status: "Effective",
  revisionName: [document.documentName || "", document.currentEffectiveRevisionNumber || document.revisionNumber || ""].filter(Boolean).join("_"),
});

export const buildControlledCopyRequestStateFromDocumentDetail = (
  document: {
    id?: string | null;
    documentNumber?: string | null;
    documentName?: string | null;
    revisionNumber?: string | null;
    type?: string | null;
    businessUnit?: string | null;
    effectiveDate?: string | null;
    validUntil?: string | null;
    status?: string | null;
  },
  latestEffectiveRevision: { id?: string | null; revisionNumber?: string | null } | null,
): ControlledCopyRequestNavigationState => ({
  documentId: document.id || document.documentNumber || "",
  documentNumber: document.documentNumber || "",
  documentTitle: document.documentName || "",
  documentVersion: latestEffectiveRevision?.revisionNumber || document.revisionNumber || "",
  revisionId: latestEffectiveRevision?.id || "",
  sourceRevisionId: latestEffectiveRevision?.id || "",
  documentName: document.documentName || "",
  documentType: document.type || "",
  businessUnit: document.businessUnit || "",
  effectiveDate: document.effectiveDate || "",
  validUntil: document.validUntil || "",
  status: "Effective",
  revisionName: [document.documentName || "", latestEffectiveRevision?.revisionNumber || document.revisionNumber || ""].filter(Boolean).join("_"),
});

export const buildControlledCopyRequestStateFromRevision = (
  revision: ControlledCopyRequestRevisionLike,
): ControlledCopyRequestNavigationState => ({
  documentId: revision.documentId || revision.originalDocument?.id || revision.documentNumber || "",
  documentNumber: revision.documentNumber || "",
  documentTitle: revision.documentName || "",
  documentVersion: revision.revisionNumber || "",
  revisionId: revision.id || "",
  sourceRevisionId: revision.id || "",
  documentName: revision.documentName || "",
  documentType: revision.type || "",
  businessUnit: revision.businessUnit || "",
  effectiveDate: revision.effectiveDate || "",
  validUntil: revision.validUntil || "",
  status: revision.status || "",
  revisionName: revision.revisionName || revision.documentName || "",
});

export const buildControlledCopyRequestRouteStateFromRevision = (
  revision: ControlledCopyRequestRevisionLike,
  options?: {
    from?: string;
    returnTo?: string;
    workspaceReturnPath?: string;
    preloadedRevisionDetail?: ControlledCopyRequestRevisionLike | null;
  },
): ControlledCopyRequestRouteState => ({
  ...buildControlledCopyRequestStateFromRevision(revision),
  from: options?.from,
  returnTo: options?.returnTo,
  workspaceReturnPath: options?.workspaceReturnPath,
  preloadedRevisionDetail: options?.preloadedRevisionDetail ?? revision,
});
