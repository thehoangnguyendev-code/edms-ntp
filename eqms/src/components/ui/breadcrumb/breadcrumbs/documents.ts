import type { BreadcrumbItem } from "../Breadcrumb";
import { dashboard } from "./shared";
import { ROUTES } from "@/app/routes.constants";

type NavigateFn = (path: string) => void;

// --- Helpers ---

/** Base breadcrumb path for Document Control module */
const docControlBase = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Document Control" },
];

const REVISION_PARENT_MAP = [
  { key: ROUTES.DOCUMENTS.ALL, label: "All Documents" },
  { key: ROUTES.DOCUMENTS.OWNED, label: "Documents Owned By Me" },
  { key: ROUTES.DOCUMENTS.REVISIONS.OWNED, label: "Revisions Owned By Me" },
  { key: ROUTES.DOCUMENTS.REVISIONS.PENDING_REVIEW, label: "Pending My Review" },
  { key: ROUTES.DOCUMENTS.REVISIONS.PENDING_APPROVAL, label: "Pending My Approval" },
];

const getRevisionParent = (from?: string, navigate?: NavigateFn): BreadcrumbItem => {
  const match = REVISION_PARENT_MAP.find(p => from === p.key);
  if (match) {
    return { label: match.label, onClick: () => navigate?.(match.key) };
  }
  return { label: "All Revisions", onClick: () => navigate?.(ROUTES.DOCUMENTS.REVISIONS.ALL) };
};

const CONTROLLED_COPY_PARENT_MAP = [
  { key: ROUTES.DOCUMENTS.CONTROLLED_COPIES.READY, label: "Ready for Distribution" },
  { key: ROUTES.DOCUMENTS.CONTROLLED_COPIES.DISTRIBUTED, label: "Distributed Copies" },
];

const getControlledCopyParent = (from?: string, navigate?: NavigateFn): BreadcrumbItem => {
  const match = CONTROLLED_COPY_PARENT_MAP.find(p => from === p.key);
  if (match) {
    return { label: match.label, onClick: () => navigate?.(match.key) };
  }
  return { label: "All Controlled Copies", onClick: () => navigate?.(ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL) };
};

const documentRevisionsLabel = { label: "Document Revisions" };
const controlledCopiesLabel = { label: "Controlled Copies" };

// --- Exported Breadcrumb Builders ---

export const documentList = (
  navigate?: NavigateFn,
  activeTab?: string
): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  { label: activeTab === "owned" ? "Documents Owned By Me" : "All Documents", isActive: true },
];

export const knowledgeBase = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  { label: "Knowledge Base", isActive: true },
];

export const newDocument = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  { label: "All Documents", onClick: () => navigate?.(ROUTES.DOCUMENTS.ALL) },
  { label: "New Document", isActive: true },
];

export const documentDetail = (
  navigate?: NavigateFn,
  options?: { fromOwned?: boolean }
): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  {
    label: options?.fromOwned
      ? "Documents Owned By Me"
      : "All Documents",
    onClick: () => navigate?.(
      options?.fromOwned
        ? ROUTES.DOCUMENTS.OWNED
        : ROUTES.DOCUMENTS.ALL
    )
  },
  { label: "Document Details", isActive: true },
];

export const revisionList = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  documentRevisionsLabel,
  { label: "All Revisions", isActive: true },
];

export const publishingWorkspace = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "All Revisions", onClick: () => navigate?.(ROUTES.DOCUMENTS.REVISIONS.ALL) },
  {
    label: "Create Revision",
    onClick: () => navigate?.(ROUTES.DOCUMENTS.REVISIONS.CREATE),
  },
  { label: "Publishing Workspace", isActive: true },
];

export const revisionsOwnedByMe = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  documentRevisionsLabel,
  { label: "Revisions Owned By Me", isActive: true },
];

export const pendingDocuments = (
  navigate?: NavigateFn,
  activeTab?: string
): BreadcrumbItem[] => {
  const tabLabels: Record<string, string> = {
    "pending-review": "Pending My Review",
    "pending-approval": "Pending My Approval",
  };
  return [
    ...docControlBase(navigate),
    documentRevisionsLabel,
    { label: tabLabels[activeTab || ""] || "Pending Documents", isActive: true },
  ];
};

export const requestControlledCopy = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  documentRevisionsLabel,
  getRevisionParent(from, navigate),
  { label: "Request Controlled Copy", isActive: true },
];

export const revisionWorkspace = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  documentRevisionsLabel,
  getRevisionParent(from, navigate),
  { label: "Revision", isActive: true },
];

export const createRevision = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  documentRevisionsLabel,
  getRevisionParent(from, navigate),
  { label: "Create Revision", isActive: true },
];

export const revisionDetail = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  documentRevisionsLabel,
  getRevisionParent(from, navigate),
  { label: "Revision Details", isActive: true },
];

export const revisionReview = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  documentRevisionsLabel,
  getRevisionParent(from || ROUTES.DOCUMENTS.REVISIONS.PENDING_REVIEW, navigate),
  { label: "Review Revision", isActive: true },
];

export const revisionApproval = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  documentRevisionsLabel,
  getRevisionParent(from || ROUTES.DOCUMENTS.REVISIONS.PENDING_APPROVAL, navigate),
  { label: "Approve Revision", isActive: true },
];

export const revisionTraining = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  documentRevisionsLabel,
  getRevisionParent(from || ROUTES.DOCUMENTS.REVISIONS.ALL, navigate),
  { label: "Training Revision", isActive: true },
];

export const controlledCopies = (
  navigate?: NavigateFn,
  activeTab?: string
): BreadcrumbItem[] => {
  const tabLabels: Record<string, string> = {
    all: "All Controlled Copies",
    ready: "Ready for Distribution",
    distributed: "Distributed Copies",
  };
  return [
    ...docControlBase(navigate),
    controlledCopiesLabel,
    { label: tabLabels[activeTab || "all"] || "All Controlled Copies", isActive: true },
  ];
};

export const controlledCopyBatchStatusDiscrepancies = (
  navigate?: NavigateFn
): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  controlledCopiesLabel,
  { label: "Needs Review", isActive: true },
];

export const controlledCopyDetail = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  controlledCopiesLabel,
  getControlledCopyParent(from, navigate),
  { label: "Controlled Copy Details", isActive: true },
];

export const destroyControlledCopy = (
  navigate?: NavigateFn,
  from?: string,
  reportType?: string
): BreadcrumbItem[] => [
  ...docControlBase(navigate),
  controlledCopiesLabel,
  getControlledCopyParent(from, navigate),
  { label: reportType ? `Report ${reportType} Controlled Copy` : "Controlled Copy Destruction Report", isActive: true },
];
