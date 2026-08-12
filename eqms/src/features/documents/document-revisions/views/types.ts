import type { DocumentType, DocumentStatus } from "@/features/documents/types";
import type { DocumentRelationBase } from "@/features/documents/shared/documentRelation.types";

export interface RelatedDocument extends DocumentRelationBase {
  type?: DocumentType;
  state?: DocumentStatus;
}

export interface CorrelatedDocument extends DocumentRelationBase {
  type?: DocumentType;
  state?: DocumentStatus;
}

export interface RevisionParticipant {
  id: string;
  fullName?: string;
  username?: string;
  position?: string;
  email?: string;
  department?: string;
  actionStatus?: string | null;
  status?: string | null;
  actedAt?: string | null;
  actionComment?: string | null;
  sequenceOrder?: number | null;
}

export interface Revision {
    id: string;
    documentId?: string;
    documentName: string;
    documentTitle?: string;
    documentNumber: string;
    displayLabel?: string;
    revisionNumber: string;
    created: string;
    openedBy: string;
  revisionName: string;
  state: DocumentStatus;
  author: string;
  effectiveDate: string;
  validUntil: string;
  type: DocumentType;
  department: string;
  businessUnit: string;
    hasRelatedDocuments?: boolean;
    hasCorrelatedDocuments?: boolean;
    isTemplate?: boolean;
    reviewers?: RevisionParticipant[];
    approvers?: RevisionParticipant[];
    canReviewRevision?: boolean;
    canApproveRevision?: boolean;
    canCompleteTraining?: boolean;
    canPublishRevision?: boolean;
    canRequestControlledCopy?: boolean;
    relatedDocuments?: RelatedDocument[];
    correlatedDocuments?: CorrelatedDocument[];
    canEditRevision?: boolean;
    canSubmitForReview?: boolean;
    statusCode?: string;
  statusInfo?: {
    id: string;
    name: string;
  };
}
