import type { Document as GlobalDocument, DocumentSummary } from "@/types";
import type { DocumentRelationBase } from "@/features/documents/shared/documentRelation.types";

export type DocumentViewType = "all" | "owned-by-me";

export interface LookupItem {
  id: string | null;
  name: string;
  code: string;
  label: string;
  value: string;
}

export interface DocumentListItem {
  id: string;
  documentNumber: string;
  documentName: string;
  revisionNumber: string;
  currentEffectiveRevisionNumber?: string | null;
  currentEffectiveRevisionId?: string | null;
  hasEffectiveRevision?: boolean;
  hasAnyRevision?: boolean;
  version?: string;
  status: string;
  statusCode?: string;
  statusInfo?: {
    id: string;
    name: string;
  };
  type: string;
  businessUnit: string;
  department: string;
  author: string;
  owner: string;
  openedBy: string;
  created: string;
  createdDate: string;
  effectiveDate: string;
  validUntil: string;
  reviewDate?: string | null;
  hasRelatedDocuments: boolean;
  hasCorrelatedDocuments: boolean;
  isTemplate: boolean;
  lastModifiedDate: string;
  lastModifiedBy: string;
  relatedDocuments?: RelatedDocument[];
  correlatedDocuments?: CorrelatedDocument[];
  previewVersionToken?: string | null;
  canRequestControlledCopy?: boolean;
  /** Server-evaluated eligibility to edit the initial Draft from assigned permission codes. */
  canStartInitialAuthoring?: boolean;
  /** Server-evaluated capability to upload a source file as a new revision. */
  canUploadRevision?: boolean;
}

export interface DocumentListQuery {
  scope?: DocumentViewType;
  search?: string;
  ids?: string;
  status?: string;
  documentType?: string;
  businessUnit?: string;
  department?: string;
  authorId?: string;
  author?: string;
  relatedDocument?: string;
  correlatedDocument?: string;
  isTemplate?: string;
  createdFrom?: string;
  createdTo?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  validFrom?: string;
  validTo?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface DocumentFiltersLookup {
  statuses: LookupItem[];
  documentTypes: LookupItem[];
  businessUnits: LookupItem[];
  departments: LookupItem[];
  authors: LookupItem[];
}

export interface DocumentDraftCreateRequest {
  documentName: string;
  titleLocalLanguage?: string | null;
  documentType: string;
  author: string;
  businessUnit: string;
  department: string;
  knowledgeBase?: string;
  subType?: string;
  periodicReviewCycle?: number;
  periodicReviewNotification?: number;
  language?: string;
  requiresTraining?: boolean;
  trainingPeriodDays?: number;
  reasonForSkippingTraining?: string;
  reviewDate?: string;
  description?: string;
  isTemplate?: boolean;
  coAuthorIds?: string[];
  reviewerUserIds?: string[];
  approverUserIds?: string[];
  relatedDocumentIds?: string[];
  correlatedDocumentIds?: string[];
}

export interface DocumentParticipantItem {
  id: string;
  fullName: string;
  username: string;
  position: string;
  email: string;
  department: string;
  sequenceOrder?: number | null;
  actionStatus?: string | null;
  actedAt?: string | null;
  actionComment?: string | null;
}

export interface DocumentRelationItem {
  id: string;
  documentNumber: string;
  documentName: string;
  displayLabel?: string;
  revisionNumber: string;
  status: string;
  statusCode?: string;
  statusInfo?: {
    id: string;
    name: string;
  };
  type: string;
  businessUnit: string;
  department: string;
  author: string;
  openedBy: string;
  created: string;
  effectiveDate: string;
  validUntil: string;
  relationType: string;
  reviewDate?: string;
  hasRelatedDocuments: boolean;
  hasCorrelatedDocuments: boolean;
  isTemplate: boolean;
}

export interface DocumentRevisionItem {
  id: string;
  revisionNumber: string;
  created: string;
  openedBy: string;
  revisionName: string;
  status: string;
  statusCode?: string;
  statusInfo?: {
    id: string;
    name: string;
  };
  /** Server-evaluated authoring entry capability for this exact revision. */
  canOpenAuthoringWorkspace?: boolean;
}

export interface DocumentAuditTrailChangeItem {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface DocumentAuditTrailUserItem {
  id: string;
  fullName: string;
  employeeCode: string;
  role: string;
  position: string;
  department: string;
}

export interface DocumentAuditTrailItem {
  id: string;
  timestamp: string;
  user: DocumentAuditTrailUserItem;
  action: string;
  actionType: string;
  changes?: DocumentAuditTrailChangeItem[];
  reason?: string;
  ipAddress?: string;
  device?: string;
}

export interface KnowledgeBaseDocumentItem {
  id: string;
  documentNumber: string;
  documentName: string;
  revisionNumber: string;
  revisionStatus: string;
  documentStatus: string;
  documentType: string;
  businessUnit: string;
  department: string;
  openedBy: string;
  created: string;
  effectiveDate: string;
  validUntil: string;
  hasRelatedDocuments: boolean;
  hasCorrelatedDocuments: boolean;
  isTemplate: boolean;
}

export interface KnowledgeBaseFolderItem {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  documentCount: number;
  documents: KnowledgeBaseDocumentItem[];
}

export interface KnowledgeBaseDepartmentItem {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  documentCount: number;
}

export interface KnowledgeBaseResponse {
  totalDocuments: number;
  folders: KnowledgeBaseFolderItem[];
}

export interface DocumentDetailResponse extends DocumentListItem {
  titleLocalLanguage?: string | null;
  description?: string | null;
  knowledgeBase?: string | null;
  subType?: string | null;
  periodicReviewCycle?: number | null;
  periodicReviewNotification?: number | null;
  language?: string | null;
  requiresTraining?: boolean;
  trainingPeriodDays?: number | null;
  reasonForSkippingTraining?: string | null;
  owner: string;
  coAuthors: DocumentParticipantItem[];
  reviewers: DocumentParticipantItem[];
  approvers: DocumentParticipantItem[];
  reviewerCount?: number;
  approverCount?: number;
  signatures?: {
    actionBy: string;
    actionByName: string;
    actionOn: string;
    actionOnValue: string;
  }[];
  relatedDocuments: DocumentRelationItem[];
  correlatedDocuments: DocumentRelationItem[];
  revisions: DocumentRevisionItem[];
  previewVersionToken?: string | null;
  canCancel?: boolean;
  canObsolete?: boolean;
  canStartInitialAuthoring?: boolean;
  canUploadRevision?: boolean;
  /** Server-computed preview of the number the next Draft revision will receive (display only). */
  nextDraftRevisionNumber?: string;
  authorId?: string | null;
}

export interface RelatedDocument extends DocumentRelationBase {}

export interface CorrelatedDocument extends DocumentRelationBase {}

export interface Document extends GlobalDocument {
  openedBy: string;
  created: string; // Mapping back to GlobalDocument.createdDate if needed, but keeping for local compatibility
  hasRelatedDocuments?: boolean;
  hasCorrelatedDocuments?: boolean;
  isTemplate?: boolean;
  relatedDocuments?: RelatedDocument[];
  correlatedDocuments?: CorrelatedDocument[];
}
