// Shared types for subtabs
import { User, DocumentSummary } from '@/types';
import type { DocumentRelationBase } from "@/features/documents/shared/documentRelation.types";

// Document Revisions
export interface Revision {
    id: string;
    documentId?: string;
    revisionNumber: string;
    created: string;
    openedBy: string;
    revisionName: string;
    status:
        | "draft"
        | "pendingReview"
        | "pendingApproval"
        | "pendingTraining"
        | "readyForPublishing"
        | "approved"
        | "effective"
        | "obsolete"
        | "cancelled"
        | "rejected";
    statusLabel?: string;
    /** Server-evaluated authoring entry capability for this exact revision. */
    canOpenAuthoringWorkspace?: boolean;
}

// Document Relationships
export interface ParentDocument extends DocumentRelationBase {}

export interface RelatedDocument extends DocumentRelationBase {}

// Reviewers & Approvers
export interface Reviewer extends Pick<User, 'id' | 'fullName' | 'username' | 'position' | 'email' | 'department'> {
    order: number;
    actionStatus?: string | null;
    actedAt?: string | null;
    actionComment?: string | null;
}

export interface Approver extends Pick<User, 'id' | 'fullName' | 'username' | 'position' | 'email' | 'department'> {
    actionStatus?: string | null;
    actedAt?: string | null;
    actionComment?: string | null;
}

export type ReviewFlowType = 'sequential' | 'parallel';

// Controlled Copies
export interface ControlledCopy {
    id: string;
    controlledCopiesName: string;
    /** Sequence of the copy within its document (e.g. "22"), as shown in the "Copy Number" column. */
    copyNumber: string;
    /** The copy's own unique number (e.g. "CC.SOP.10110.022"), shown in the "Document Number" column. */
    controlledCopyNumber?: string;
    /** Revision the copy was issued from, for the Document Revision link. */
    sourceRevisionId?: string;
    created: string;
    status: "draft" | "pendingReview" | "approved" | "effective" | "obsolete";
    openedBy: string;
    validUntil: string;
    documentRevision: string;
    documentNumber: string;
}

// Knowledge Base
export interface Knowledge {
    id: string;
    title: string;
    category: string;
    tags: string[];
    dateAdded: string;
}
